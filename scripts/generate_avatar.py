#!/usr/bin/env python3
"""
Generate a custom avatar GLB by extracting face texture from a photo
and applying it to a template Ready Player Me avatar.

Uses MediaPipe FaceLandmarker (Tasks API) for face detection and UV extraction,
and pygltflib for GLB manipulation (preserves morph targets/skeleton).

Usage:
    python3 generate_avatar.py --input photo.jpg --output avatar.glb [--template template.glb] [--thumbnail thumb.png]
"""

import argparse
import os
import sys
import urllib.request
from io import BytesIO
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import mediapipe as mp
from mediapipe.tasks.python import vision
from mediapipe.tasks.python.core import base_options as base_options_module

# URL for the face landmarker model
_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task"
_SCRIPT_DIR = Path(__file__).resolve().parent
_MODEL_PATH = _SCRIPT_DIR / "face_landmarker.task"


def _ensure_model() -> str:
    """Download the FaceLandmarker model if not already cached."""
    if _MODEL_PATH.exists():
        return str(_MODEL_PATH)

    print(f"Downloading face landmarker model to {_MODEL_PATH}...")
    urllib.request.urlretrieve(_MODEL_URL, str(_MODEL_PATH))
    print("Model downloaded.")
    return str(_MODEL_PATH)


def get_face_landmarks(image_path: str) -> np.ndarray | None:
    """Detect face landmarks using MediaPipe FaceLandmarker (Tasks API).

    Returns a (478, 2) array of pixel coordinates, or None if no face found.
    """
    image = cv2.imread(image_path)
    if image is None:
        print(f"Error: Could not read image: {image_path}", file=sys.stderr)
        return None

    h, w = image.shape[:2]

    model_path = _ensure_model()

    options = vision.FaceLandmarkerOptions(
        base_options=base_options_module.BaseOptions(model_asset_path=model_path),
        num_faces=1,
        min_face_detection_confidence=0.5,
        min_face_presence_confidence=0.5,
    )

    with vision.FaceLandmarker.create_from_options(options) as landmarker:
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_image)
        result = landmarker.detect(mp_image)

        if not result.face_landmarks:
            print("Error: No face detected in image", file=sys.stderr)
            return None

        landmarks = result.face_landmarks[0]
        # Use first 468 landmarks (compatible with classic face mesh)
        num_landmarks = min(len(landmarks), 468)
        points = np.array(
            [(lm.x * w, lm.y * h) for lm in landmarks[:num_landmarks]],
            dtype=np.float32,
        )
        return points


def extract_face_texture(
    image_path: str,
    landmarks: np.ndarray,
    texture_size: int = 1024,
) -> Image.Image:
    """Extract face texture from photo, mapped to RPM avatar UV layout.

    Uses anchor point correspondence (eyes, nose, chin) between the photo
    and the known RPM head mesh UV positions to warp only the face region.
    """
    image = cv2.imread(image_path)
    rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    # MediaPipe landmark indices for key facial features
    LEFT_EYE = 159      # left eye upper lid center
    RIGHT_EYE = 386     # right eye upper lid center
    NOSE_TIP = 1
    CHIN = 152
    FOREHEAD = 10
    LEFT_CHEEK = 234    # left face boundary
    RIGHT_CHEEK = 454   # right face boundary

    # Source points from the photo (MediaPipe landmarks)
    src_pts = np.array([
        landmarks[LEFT_EYE],
        landmarks[RIGHT_EYE],
        landmarks[NOSE_TIP],
        landmarks[CHIN],
    ], dtype=np.float32)

    # Target points in RPM texture UV space (1024x1024 pixels)
    # Derived from the Wolf3D_Head mesh vertex positions → UV coordinates
    dst_pts = np.array([
        [342, 262],    # left eye
        [680, 265],    # right eye
        [511, 408],    # nose tip
        [527, 781],    # chin
    ], dtype=np.float32)

    # Compute perspective transform (4 points)
    M = cv2.getPerspectiveTransform(src_pts, dst_pts)

    # Warp the photo to match the RPM texture layout
    warped = cv2.warpPerspective(
        rgb_image, M, (texture_size, texture_size),
        borderMode=cv2.BORDER_REFLECT,
    )

    # Build a face-only mask from the convex hull of warped face landmarks
    # Transform all face outline landmarks to texture space
    # MediaPipe face oval landmarks (silhouette)
    FACE_OVAL = [
        10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
        397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
        172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
    ]

    face_pts = landmarks[FACE_OVAL].reshape(-1, 1, 2).astype(np.float32)
    warped_face_pts = cv2.perspectiveTransform(face_pts, M)
    warped_face_pts = warped_face_pts.reshape(-1, 2).astype(np.int32)

    # Clip to texture bounds
    warped_face_pts = np.clip(warped_face_pts, 0, texture_size - 1)

    # Create convex hull mask
    hull = cv2.convexHull(warped_face_pts)
    mask = np.zeros((texture_size, texture_size), dtype=np.uint8)
    cv2.fillConvexPoly(mask, hull, 255)

    # Feather the mask edges for smooth blending (erode then blur)
    kernel = np.ones((15, 15), np.uint8)
    mask_eroded = cv2.erode(mask, kernel, iterations=2)
    mask_feathered = cv2.GaussianBlur(mask_eroded, (41, 41), 0)

    return warped, mask_feathered


def _find_skin_image_index(gltf) -> int | None:
    """Find the face/skin texture image index by tracing mesh → material → texture → image."""
    # Strategy 1: Find via mesh name containing "head"
    for mesh in (gltf.meshes or []):
        if "head" in (mesh.name or "").lower():
            for prim in mesh.primitives:
                if prim.material is not None:
                    mat = gltf.materials[prim.material]
                    pbr = mat.pbrMetallicRoughness
                    if pbr and pbr.baseColorTexture is not None:
                        tex = gltf.textures[pbr.baseColorTexture.index]
                        if tex.source is not None:
                            print(f"Found head texture: mesh '{mesh.name}' → material '{mat.name}' → image[{tex.source}]")
                            return tex.source

    # Strategy 2: material name containing "skin"
    for mat in (gltf.materials or []):
        if "skin" in (mat.name or "").lower():
            pbr = mat.pbrMetallicRoughness
            if pbr and pbr.baseColorTexture is not None:
                tex = gltf.textures[pbr.baseColorTexture.index]
                if tex.source is not None:
                    print(f"Found head texture: material '{mat.name}' → image[{tex.source}]")
                    return tex.source

    return None


def _extract_glb_image(gltf, image_index: int) -> np.ndarray | None:
    """Extract an image from the GLB binary blob as a numpy RGB array."""
    img_info = gltf.images[image_index]
    if img_info.bufferView is None:
        return None
    bv = gltf.bufferViews[img_info.bufferView]
    blob = gltf.binary_blob()
    img_data = blob[bv.byteOffset : bv.byteOffset + bv.byteLength]
    pil_img = Image.open(BytesIO(img_data)).convert("RGB")
    return np.array(pil_img)


def replace_texture_in_glb(
    template_path: str,
    warped_face: np.ndarray,
    face_mask: np.ndarray,
    output_path: str,
) -> bool:
    """Replace the face region in the GLB skin texture.

    Extracts the original texture, blends the warped face onto it using
    the feathered mask, and writes the result back into the GLB.
    """
    try:
        from pygltflib import GLTF2
    except ImportError:
        print("Error: pygltflib not installed", file=sys.stderr)
        return False

    gltf = GLTF2.load(template_path)
    face_image_index = _find_skin_image_index(gltf)
    if face_image_index is None:
        print("Error: No suitable face/skin texture found in template GLB", file=sys.stderr)
        return False

    # Extract original texture
    original = _extract_glb_image(gltf, face_image_index)
    if original is None:
        print("Error: Could not extract original skin texture", file=sys.stderr)
        return False

    tex_h, tex_w = original.shape[:2]
    print(f"Original texture size: {tex_w}x{tex_h}")

    # Resize warped face and mask to match original texture size if needed
    if warped_face.shape[0] != tex_h or warped_face.shape[1] != tex_w:
        warped_face = cv2.resize(warped_face, (tex_w, tex_h), interpolation=cv2.INTER_LINEAR)
        face_mask = cv2.resize(face_mask, (tex_w, tex_h), interpolation=cv2.INTER_LINEAR)

    # Blend: result = original * (1 - alpha) + warped * alpha
    alpha = face_mask.astype(np.float32) / 255.0
    alpha_3d = np.stack([alpha] * 3, axis=-1)
    blended = (
        warped_face.astype(np.float32) * alpha_3d
        + original.astype(np.float32) * (1.0 - alpha_3d)
    ).astype(np.uint8)

    # Encode blended texture as PNG
    blended_img = Image.fromarray(blended)
    buf = BytesIO()
    blended_img.save(buf, format="PNG")
    png_bytes = buf.getvalue()

    print(f"Replacing image[{face_image_index}] ({len(png_bytes)} bytes)")

    image = gltf.images[face_image_index]
    if image.bufferView is not None:
        bv = gltf.bufferViews[image.bufferView]
        if gltf.binary_blob() is not None:
            blob = bytearray(gltf.binary_blob())
            old_length = bv.byteLength
            new_length = len(png_bytes)

            if new_length <= old_length:
                blob[bv.byteOffset : bv.byteOffset + new_length] = png_bytes
                blob[bv.byteOffset + new_length : bv.byteOffset + old_length] = (
                    b"\x00" * (old_length - new_length)
                )
                bv.byteLength = new_length
            else:
                new_offset = len(blob)
                while new_offset % 4 != 0:
                    blob.append(0)
                    new_offset += 1
                blob.extend(png_bytes)
                bv.byteOffset = new_offset
                bv.byteLength = new_length
                if gltf.buffers:
                    gltf.buffers[0].byteLength = len(blob)

            gltf.set_binary_blob(bytes(blob))
        image.mimeType = "image/png"

    gltf.save(output_path)
    print(f"Saved modified GLB to {output_path}")
    return True


def create_thumbnail(
    image_path: str,
    landmarks: np.ndarray,
    output_path: str,
    size: int = 128,
):
    """Create a circular thumbnail of the detected face."""
    image = cv2.imread(image_path)
    rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    pil_image = Image.fromarray(rgb_image)

    x_min, y_min = landmarks.min(axis=0).astype(int)
    x_max, y_max = landmarks.max(axis=0).astype(int)

    pad = int((x_max - x_min) * 0.2)
    x_min = max(0, x_min - pad)
    y_min = max(0, y_min - pad)
    x_max = min(pil_image.width, x_max + pad)
    y_max = min(pil_image.height, y_max + pad)

    face = pil_image.crop((x_min, y_min, x_max, y_max))

    w, h = face.size
    max_dim = max(w, h)
    square = Image.new("RGB", (max_dim, max_dim), (0, 0, 0))
    square.paste(face, ((max_dim - w) // 2, (max_dim - h) // 2))
    square = square.resize((size, size), Image.Resampling.LANCZOS)

    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size - 1, size - 1), fill=255)

    output = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    output.paste(square, (0, 0))
    output.putalpha(mask)

    output.save(output_path, format="PNG")
    print(f"Saved thumbnail to {output_path}")


def generate_standalone_avatar(
    image_path: str,
    face_texture: Image.Image,
    output_path: str,
):
    """Generate a standalone GLB with the face texture on a simple plane.

    For full avatar functionality (morph targets, lip-sync), a template GLB is required.
    """
    texture_path = output_path.replace(".glb", ".png")
    face_texture.save(texture_path, format="PNG")

    print(
        f"Warning: No template GLB provided. Saved face texture to {texture_path}",
        file=sys.stderr,
    )
    print(
        "For full 3D avatar with lip-sync, provide a template GLB with --template",
        file=sys.stderr,
    )

    try:
        from pygltflib import (
            GLTF2,
            Buffer,
            BufferView,
            Image as GLTFImage,
            Material,
            Mesh,
            Node,
            Primitive,
            Scene,
            Texture,
            Accessor,
            Asset,
            FLOAT,
            UNSIGNED_SHORT,
            SCALAR,
            VEC2,
            VEC3,
            TRIANGLES,
            ELEMENT_ARRAY_BUFFER,
            ARRAY_BUFFER,
        )

        vertices = np.array(
            [[-0.5, -0.5, 0], [0.5, -0.5, 0], [0.5, 0.5, 0], [-0.5, 0.5, 0]],
            dtype=np.float32,
        )
        uvs = np.array([[0, 1], [1, 1], [1, 0], [0, 0]], dtype=np.float32)
        indices = np.array([0, 1, 2, 0, 2, 3], dtype=np.uint16)

        indices_bytes = indices.tobytes()
        vertices_bytes = vertices.tobytes()
        uvs_bytes = uvs.tobytes()

        img_buf = BytesIO()
        face_texture.save(img_buf, format="PNG")
        png_bytes = img_buf.getvalue()

        def align4(n):
            return (n + 3) & ~3

        idx_len = len(indices_bytes)
        vtx_len = len(vertices_bytes)
        uv_len = len(uvs_bytes)
        img_len = len(png_bytes)

        buffer_data = bytearray()
        buffer_data.extend(indices_bytes)
        buffer_data.extend(b"\x00" * (align4(idx_len) - idx_len))

        vtx_offset = len(buffer_data)
        buffer_data.extend(vertices_bytes)
        buffer_data.extend(b"\x00" * (align4(vtx_len) - vtx_len))

        uv_offset = len(buffer_data)
        buffer_data.extend(uvs_bytes)
        buffer_data.extend(b"\x00" * (align4(uv_len) - uv_len))

        img_offset = len(buffer_data)
        buffer_data.extend(png_bytes)
        buffer_data.extend(b"\x00" * (align4(img_len) - img_len))

        gltf = GLTF2(
            asset=Asset(version="2.0", generator="super-characters-avatar"),
            scene=0,
            scenes=[Scene(nodes=[0])],
            nodes=[Node(mesh=0)],
            meshes=[
                Mesh(
                    primitives=[
                        Primitive(
                            attributes={"POSITION": 1, "TEXCOORD_0": 2},
                            indices=0,
                            material=0,
                            mode=TRIANGLES,
                        )
                    ]
                )
            ],
            materials=[
                Material(
                    pbrMetallicRoughness={
                        "baseColorTexture": {"index": 0},
                        "metallicFactor": 0.0,
                        "roughnessFactor": 1.0,
                    },
                    doubleSided=True,
                )
            ],
            textures=[Texture(source=0)],
            images=[GLTFImage(bufferView=3, mimeType="image/png")],
            accessors=[
                Accessor(
                    bufferView=0,
                    componentType=UNSIGNED_SHORT,
                    count=6,
                    type=SCALAR,
                    max=[3],
                    min=[0],
                ),
                Accessor(
                    bufferView=1,
                    componentType=FLOAT,
                    count=4,
                    type=VEC3,
                    max=[0.5, 0.5, 0],
                    min=[-0.5, -0.5, 0],
                ),
                Accessor(
                    bufferView=2,
                    componentType=FLOAT,
                    count=4,
                    type=VEC2,
                    max=[1, 1],
                    min=[0, 0],
                ),
            ],
            bufferViews=[
                BufferView(
                    buffer=0, byteOffset=0, byteLength=idx_len,
                    target=ELEMENT_ARRAY_BUFFER,
                ),
                BufferView(
                    buffer=0, byteOffset=vtx_offset, byteLength=vtx_len,
                    target=ARRAY_BUFFER,
                ),
                BufferView(
                    buffer=0, byteOffset=uv_offset, byteLength=uv_len,
                    target=ARRAY_BUFFER,
                ),
                BufferView(
                    buffer=0, byteOffset=img_offset, byteLength=img_len,
                ),
            ],
            buffers=[Buffer(byteLength=len(buffer_data))],
        )

        gltf.set_binary_blob(bytes(buffer_data))
        gltf.save(output_path)
        print(f"Saved standalone avatar GLB to {output_path}")
        return True

    except Exception as e:
        print(f"Warning: Could not create standalone GLB: {e}", file=sys.stderr)
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Generate a custom avatar from a photo"
    )
    parser.add_argument("--input", required=True, help="Input photo path")
    parser.add_argument("--output", required=True, help="Output GLB path")
    parser.add_argument("--template", help="Template GLB with morph targets")
    parser.add_argument("--thumbnail", help="Output thumbnail path")
    parser.add_argument(
        "--texture-size", type=int, default=1024, help="Face texture size"
    )
    args = parser.parse_args()

    print("Detecting face landmarks...")
    landmarks = get_face_landmarks(args.input)
    if landmarks is None:
        sys.exit(1)
    print(f"Found {len(landmarks)} face landmarks")

    print("Extracting face texture...")
    warped_face, face_mask = extract_face_texture(args.input, landmarks, args.texture_size)

    if args.template and os.path.exists(args.template):
        print(f"Applying face texture to template: {args.template}")
        success = replace_texture_in_glb(args.template, warped_face, face_mask, args.output)
        if not success:
            print("Error: Failed to apply texture to template", file=sys.stderr)
            sys.exit(1)
    else:
        print("No template provided, generating standalone avatar...")
        face_texture = Image.fromarray(warped_face)
        generate_standalone_avatar(args.input, face_texture, args.output)

    if args.thumbnail:
        print("Generating thumbnail...")
        create_thumbnail(args.input, landmarks, args.thumbnail)

    print("Avatar generation complete!")


if __name__ == "__main__":
    main()
