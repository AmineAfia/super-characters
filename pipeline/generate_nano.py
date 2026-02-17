#!/usr/bin/env python3
"""
Nano Banana 3D Character Image Generator

Generates a "Nano Banana" style 3D figurine image from an input photo using
Stable Diffusion with img2img. The prompt technique creates a commercialized
1/7 scale figurine look that works well for 3D mesh conversion.

Requirements:
    pip install diffusers torch transformers accelerate pillow

Usage:
    python generate_nano.py --input input.png --output nano_output.png [--prompt "custom prompt"]
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
        import diffusers
    except ImportError:
        missing.append("diffusers")
    try:
        from PIL import Image
    except ImportError:
        missing.append("pillow")

    if missing:
        print(json.dumps({
            "status": "error",
            "error": f"Missing dependencies: {', '.join(missing)}. "
                     f"Install with: pip install {' '.join(missing)}"
        }))
        sys.exit(1)


def get_device():
    """Determine the best available device (MPS for Mac, CUDA for GPU, CPU fallback)."""
    import torch
    if torch.backends.mps.is_available():
        return "mps"
    elif torch.cuda.is_available():
        return "cuda"
    return "cpu"


def generate_nano_banana(input_path, output_path, custom_prompt=None, strength=0.65, steps=30):
    """
    Generate a Nano Banana figurine-style image from an input photo.

    Args:
        input_path: Path to the source image
        output_path: Path to save the generated image
        custom_prompt: Optional custom prompt (uses default Nano Banana prompt if None)
        strength: How much to transform the image (0.0-1.0)
        steps: Number of diffusion steps
    """
    import torch
    from diffusers import StableDiffusionImg2ImgPipeline
    from PIL import Image

    device = get_device()
    dtype = torch.float16 if device != "cpu" else torch.float32

    print(json.dumps({"status": "progress", "step": "loading_model", "message": "Loading Stable Diffusion model..."}))

    # Use Realistic Vision for high-quality figurine-style output
    model_id = "SG161222/Realistic_Vision_V5.1_noVAE"
    pipe = StableDiffusionImg2ImgPipeline.from_pretrained(
        model_id,
        torch_dtype=dtype,
        safety_checker=None,
    )
    pipe = pipe.to(device)

    # Enable memory optimizations
    if device == "mps":
        pipe.enable_attention_slicing()
    elif device == "cuda":
        pipe.enable_xformers_memory_efficient_attention()

    # Load and prepare input image
    print(json.dumps({"status": "progress", "step": "loading_image", "message": "Loading input image..."}))
    init_image = Image.open(input_path).convert("RGB")
    init_image = init_image.resize((512, 512), Image.LANCZOS)

    # Nano Banana prompt technique
    if custom_prompt:
        prompt = custom_prompt
    else:
        prompt = (
            "Create a 1/7 scale commercialized figurine of the character in the picture, "
            "in a realistic style, in a real environment. "
            "3D rendered figurine, chibi proportions, smooth plastic material, "
            "studio lighting, product photography, high detail, anime figure style, "
            "collectible toy, display base"
        )

    negative_prompt = (
        "blurry, low quality, distorted face, extra limbs, deformed, "
        "text, watermark, signature, oversaturated, ugly"
    )

    print(json.dumps({"status": "progress", "step": "generating", "message": "Generating Nano Banana image..."}))

    result = pipe(
        prompt=prompt,
        negative_prompt=negative_prompt,
        image=init_image,
        strength=strength,
        num_inference_steps=steps,
        guidance_scale=7.5,
    )

    output_image = result.images[0]
    output_image.save(output_path, "PNG")

    print(json.dumps({
        "status": "success",
        "output": output_path,
        "message": "Nano Banana image generated successfully"
    }))


def main():
    parser = argparse.ArgumentParser(description="Generate Nano Banana figurine image")
    parser.add_argument("--input", required=True, help="Path to input image")
    parser.add_argument("--output", required=True, help="Path for output image")
    parser.add_argument("--prompt", default=None, help="Custom generation prompt")
    parser.add_argument("--strength", type=float, default=0.65, help="Transform strength (0.0-1.0)")
    parser.add_argument("--steps", type=int, default=30, help="Number of diffusion steps")
    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(json.dumps({"status": "error", "error": f"Input file not found: {args.input}"}))
        sys.exit(1)

    check_dependencies()
    generate_nano_banana(args.input, args.output, args.prompt, args.strength, args.steps)


if __name__ == "__main__":
    main()
