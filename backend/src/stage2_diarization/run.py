"""CLI entry point for standalone testing of Stage 2 (diarization + role assignment).

Usage:
    python src/stage2_diarization/run.py path/to/call.wav
    python src/stage2_diarization/run.py path/to/call.wav --asr-json stage1_out.json
    python src/stage2_diarization/run.py path/to/call.wav --dual-channel
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from src.stage1_asr.transcribe import transcribe_call  # noqa: E402
from src.stage2_diarization.label import label_speakers  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Diarize + assign agent/client roles (Stage 2).")
    parser.add_argument("audio_path", help="Path to the audio file")
    parser.add_argument("--asr-json", default=None, help="Path to a Stage 1 output JSON (skips re-running ASR)")
    parser.add_argument("--dual-channel", action="store_true", help="Split by channel instead of diarizing")
    parser.add_argument("--model-size", default="medium", help="faster-whisper model size, if re-running ASR")
    parser.add_argument("-o", "--output", default=None, help="Write JSON to this file instead of stdout")
    args = parser.parse_args()

    if args.asr_json:
        asr_result = json.loads(Path(args.asr_json).read_text(encoding="utf-8"))
    else:
        asr_result = transcribe_call(args.audio_path, model_size=args.model_size)

    result = label_speakers(asr_result, args.audio_path, dual_channel=args.dual_channel)
    output_json = json.dumps(result, indent=2, ensure_ascii=False)

    if args.output:
        Path(args.output).write_text(output_json, encoding="utf-8")
        print(f"Wrote {len(result['segments'])} segments to {args.output}")
    else:
        print(output_json)


if __name__ == "__main__":
    main()
