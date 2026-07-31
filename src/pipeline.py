"""Entry point for the Clearline call-analysis pipeline.

Stages (to be implemented):
  1. stage1_asr            - transcribe call audio (faster-whisper)
  2. stage2_diarization     - identify speakers (pyannote.audio)
  3. stage3_recommendations - generate insights/recommendations (Anthropic API)
"""

import argparse

from dotenv import load_dotenv

load_dotenv()


def run_pipeline(audio_path: str) -> None:
    # TODO: stage1_asr.transcribe(audio_path)
    # TODO: stage2_diarization.diarize(audio_path)
    # TODO: stage3_recommendations.generate(transcript, diarization)
    raise NotImplementedError("Pipeline stages have not been implemented yet.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the Clearline call-analysis pipeline.")
    parser.add_argument("audio_path", help="Path to the call audio file to process")
    args = parser.parse_args()

    run_pipeline(args.audio_path)


if __name__ == "__main__":
    main()
