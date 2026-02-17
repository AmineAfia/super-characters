#!/usr/bin/env python3
"""
Text-to-Speech using Moshi

Generates speech audio from text using the Moshi speech-text foundation model.
Moshi supports full-duplex realtime dialogue and runs locally on Mac (M1+)
with ~200ms latency.

Requirements:
    pip install moshi torch

Usage:
    python moshi_tts.py --text "Hello world" --output audio.wav
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

    if missing:
        print(json.dumps({
            "status": "error",
            "error": f"Missing dependencies: {', '.join(missing)}. "
                     f"Install with: pip install {' '.join(missing)}"
        }))
        sys.exit(1)


def synthesize_speech(text, output_path, voice="default"):
    """
    Synthesize speech from text using Moshi TTS.

    Falls back to a simple sine-wave placeholder if Moshi is not installed,
    allowing the pipeline to be tested end-to-end without the full model.

    Args:
        text: Text to synthesize
        output_path: Path to save the WAV audio
        voice: Voice preset name
    """
    import torch
    import struct
    import math

    # Try Moshi first
    try:
        from moshi import MoshiTTS
        print(json.dumps({"status": "progress", "step": "moshi", "message": "Using Moshi TTS..."}))

        model = MoshiTTS.from_pretrained("kyutai/moshi-tts")
        audio = model.synthesize(text)
        audio.save(output_path)

        print(json.dumps({
            "status": "success",
            "output": output_path,
            "message": "Speech synthesized with Moshi"
        }))
        return
    except ImportError:
        print(json.dumps({
            "status": "progress",
            "step": "fallback",
            "message": "Moshi not available. Note: The app uses ElevenLabs TTS by default. "
                       "This script is for the optional offline TTS pipeline."
        }))

    # Fallback: Generate a simple placeholder audio (silence with gentle tone)
    # In production, ElevenLabs handles TTS. This is only for pipeline testing.
    sample_rate = 24000
    duration = max(1.0, len(text.split()) * 0.3)  # ~300ms per word
    num_samples = int(sample_rate * duration)

    print(json.dumps({
        "status": "progress",
        "step": "generating_placeholder",
        "message": f"Generating {duration:.1f}s placeholder audio"
    }))

    # Generate silence (the actual TTS happens via ElevenLabs in the main app)
    samples = []
    for i in range(num_samples):
        t = i / sample_rate
        # Very quiet tone to indicate audio presence
        sample = int(0.01 * 32767 * math.sin(2 * math.pi * 440 * t))
        samples.append(sample)

    # Write WAV file
    with open(output_path, "wb") as f:
        num_channels = 1
        bits_per_sample = 16
        byte_rate = sample_rate * num_channels * bits_per_sample // 8
        block_align = num_channels * bits_per_sample // 8
        data_size = num_samples * block_align

        # WAV header
        f.write(b"RIFF")
        f.write(struct.pack("<I", 36 + data_size))
        f.write(b"WAVE")
        f.write(b"fmt ")
        f.write(struct.pack("<I", 16))  # chunk size
        f.write(struct.pack("<H", 1))   # PCM
        f.write(struct.pack("<H", num_channels))
        f.write(struct.pack("<I", sample_rate))
        f.write(struct.pack("<I", byte_rate))
        f.write(struct.pack("<H", block_align))
        f.write(struct.pack("<H", bits_per_sample))
        f.write(b"data")
        f.write(struct.pack("<I", data_size))

        for sample in samples:
            f.write(struct.pack("<h", sample))

    print(json.dumps({
        "status": "success",
        "output": output_path,
        "duration": round(duration, 3),
        "message": f"Placeholder audio generated ({duration:.1f}s). "
                   "Install Moshi for real TTS, or use ElevenLabs via the app."
    }))


def main():
    parser = argparse.ArgumentParser(description="Text-to-Speech with Moshi")
    parser.add_argument("--text", required=True, help="Text to synthesize")
    parser.add_argument("--output", required=True, help="Path to output WAV file")
    parser.add_argument("--voice", default="default", help="Voice preset")
    args = parser.parse_args()

    check_dependencies()
    synthesize_speech(args.text, args.output, args.voice)


if __name__ == "__main__":
    main()
