"""CLI entry point for standalone testing of Stage 1 (ASR).

Usage:
    python src/stage1_asr/run.py path/to/call.wav
    python src/stage1_asr/run.py path/to/call.wav --model-size small --output out.json
"""

import argparse
import json
import sys
from pathlib import Path

# Allow running this file directly (`python src/stage1_asr/run.py ...`) without
# the package being installed, regardless of the current working directory. The
# project root (not just src/) goes on sys.path so relative imports between
# stage packages (e.g. stage2_diarization reusing stage1_asr's VAD) keep working.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from src.stage1_asr.transcribe import transcribe_call  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Transcribe a call recording (Stage 1: ASR).")
    parser.add_argument("audio_path", help="Path to the audio file to transcribe")
    parser.add_argument("--model-size", default="medium", help="faster-whisper model size (default: medium)")
    parser.add_argument("--device", default=None, help="cpu or cuda (default: auto-detect)")
    parser.add_argument("--compute-type", default=None, help="faster-whisper compute type (default: auto)")
    parser.add_argument("--language", default=None, help="Force a language code, e.g. en (default: auto-detect)")
    parser.add_argument("-o", "--output", default=None, help="Write JSON to this file instead of stdout")
    args = parser.parse_args()

    result = transcribe_call(
        args.audio_path,
        model_size=args.model_size,
        device=args.device,
        compute_type=args.compute_type,
        language=args.language,
    )
    output_json = json.dumps(result, indent=2, ensure_ascii=False)

    if args.output:
        Path(args.output).write_text(output_json, encoding="utf-8")
        print(f"Wrote {len(result['segments'])} segments to {args.output}")
    else:
        print(output_json)


if __name__ == "__main__":
    main()
