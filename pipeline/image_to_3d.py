#!/usr/bin/env python3
"""
Image to 3D Model Converter using TripoSR

Converts a single image into a 3D mesh (GLB format) using the TripoSR model.
TripoSR is optimized for single-image 3D reconstruction and runs efficiently
on Apple Silicon via PyTorch MPS.

Requirements:
    pip install torch tsr pillow trimesh

    TripoSR must be cloned locally:
    git clone https://github.com/VAST-AI-Research/TripoSR

Usage:
    python image_to_3d.py --image input.png --output model.glb [--triposr-path /path/to/TripoSR]
"""

import argparse
import os
import sys
import json


def check_dependencies():
    """Check if required Python packages are installed."""
    missing = []
    try:
        import torch
    except ImportError:
        missing.append("torch")
    try:
        from PIL import Image
    except ImportError:
        missing.append("pillow")
    try:
        import trimesh
    except ImportError:
        missing.append("trimesh")

    if missing:
        print(json.dumps({
            "status": "error",
            "error": f"Missing dependencies: {', '.join(missing)}. "
                     f"Install with: pip install {' '.join(missing)}"
        }))
        sys.exit(1)


def get_device():
    """Determine the best available device."""
    import torch
    if torch.backends.mps.is_available():
        return "mps"
    elif torch.cuda.is_available():
        return "cuda"
    return "cpu"


def convert_image_to_3d(image_path, output_path, triposr_path=None, resolution=256):
    """
    Convert a single image to a 3D GLB model using TripoSR.

    Args:
        image_path: Path to the input image
        output_path: Path to save the GLB model
        triposr_path: Path to the TripoSR repository (optional, uses pip-installed tsr if available)
        resolution: Marching cubes resolution (higher = more detail, more RAM)
    """
    import torch
    from PIL import Image

    device = get_device()

    # Add TripoSR to path if specified
    if triposr_path and os.path.isdir(triposr_path):
        sys.path.insert(0, triposr_path)

    print(json.dumps({"status": "progress", "step": "loading_model", "message": "Loading TripoSR model..."}))

    try:
        from tsr.system import TSR
    except ImportError:
        print(json.dumps({
            "status": "error",
            "error": "TripoSR not found. Install via: pip install tsr, or clone "
                     "https://github.com/VAST-AI-Research/TripoSR and pass --triposr-path"
        }))
        sys.exit(1)

    # Load the model
    model = TSR.from_pretrained(
        "stabilityai/TripoSR",
        config_name="config.yaml",
        weight_name="model.ckpt",
    )
    model.renderer.set_chunk_size(8192)
    model.to(device)

    # Load and preprocess image
    print(json.dumps({"status": "progress", "step": "processing_image", "message": "Processing input image..."}))
    image = Image.open(image_path).convert("RGB")

    # Run inference
    print(json.dumps({"status": "progress", "step": "generating_3d", "message": "Generating 3D mesh..."}))
    with torch.no_grad():
        scene_codes = model([image], device=device)

    # Extract mesh
    print(json.dumps({"status": "progress", "step": "extracting_mesh", "message": "Extracting mesh..."}))
    meshes = model.extract_mesh(scene_codes, resolution=resolution)

    # Save as GLB
    print(json.dumps({"status": "progress", "step": "saving", "message": "Saving GLB model..."}))
    mesh = meshes[0]
    mesh.export(output_path, file_type="glb")

    file_size = os.path.getsize(output_path)
    print(json.dumps({
        "status": "success",
        "output": output_path,
        "file_size": file_size,
        "message": f"3D model saved ({file_size / 1024:.1f} KB)"
    }))


def main():
    parser = argparse.ArgumentParser(description="Convert image to 3D model using TripoSR")
    parser.add_argument("--image", required=True, help="Path to input image")
    parser.add_argument("--output", required=True, help="Path to output GLB file")
    parser.add_argument("--triposr-path", default=None, help="Path to TripoSR repository")
    parser.add_argument("--resolution", type=int, default=256, help="Mesh resolution (default: 256)")
    args = parser.parse_args()

    if not os.path.exists(args.image):
        print(json.dumps({"status": "error", "error": f"Input file not found: {args.image}"}))
        sys.exit(1)

    check_dependencies()
    convert_image_to_3d(args.image, args.output, args.triposr_path, args.resolution)


if __name__ == "__main__":
    main()
