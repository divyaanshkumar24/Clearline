"""Entry point for the Clearline call-analysis pipeline.

Stages:
  1. stage1_asr            - transcribe call audio (faster-whisper)
  2. stage2_diarization     - identify speakers (pyannote.audio)
  3. stage3_recommendations - generate insights/recommendations (NVIDIA NIM / Nemotron)
"""

import argparse
import json
import logging
from pathlib import Path
from typing import Callable, Dict, Optional

from dotenv import load_dotenv

from .stage1_asr.transcribe import transcribe_call
from .stage2_diarization.diarization import diarize_call
from .stage2_diarization.merge import merge_transcript_with_speakers
from .stage2_diarization.roles import assign_roles
from .stage3_recommendations.analyze import analyze_call

load_dotenv()

logger = logging.getLogger(__name__)


def run_pipeline(
    audio_path: str,
    dual_channel: bool = False,
    on_stage: Optional[Callable[[str], None]] = None,
) -> Dict:
    """Run the full Clearline pipeline (Stage 1 -> Stage 2 -> Stage 3) on a call recording.

    Args:
        audio_path: Path to the call recording.
        dual_channel: If True, skip diarization and split by channel (0=agent, 1=client).
        on_stage: Optional callback invoked with "transcribing", "diarizing", "analyzing",
            or "done" as each stage starts (or the pipeline finishes) — lets a caller (e.g.
            a web API) surface progress without this function knowing anything about how
            that progress is reported.

    Returns:
        {"call_id", "segments", "sentiment_trajectory", "emotion_tags", "pivot_point",
         "recommendation", "criterion_scores", "coaching_findings"}
    """

    def _report(stage: str) -> None:
        if on_stage is not None:
            on_stage(stage)

    _report("transcribing")
    logger.info("Stage 1: transcribing %s", audio_path)
    asr_result = transcribe_call(audio_path)

    if not asr_result["segments"]:
        raise RuntimeError(
            f"Stage 1 (ASR) produced no transcript segments for {audio_path} — the "
            "audio may be silent, corrupted, or too short. Aborting before Stage 2/3 "
            "rather than analyzing an empty call."
        )

    _report("diarizing")
    logger.info("Stage 2: diarizing (dual_channel=%s)", dual_channel)
    diarization_segments = diarize_call(audio_path, dual_channel=dual_channel)
    merged = merge_transcript_with_speakers(asr_result["segments"], diarization_segments)

    speaker_labels = {seg["speaker"] for seg in merged if seg.get("speaker")}
    if len(speaker_labels) < 2:
        logger.warning(
            "Diarization found only %d distinct speaker(s) (%s) for %s — skipping "
            "agent/client role assignment. Segments keep their raw diarization "
            "labels, so Stage 3's client-only analysis will come back empty for "
            "this call rather than crashing.",
            len(speaker_labels),
            sorted(speaker_labels),
            audio_path,
        )
        labeled_segments = merged
    else:
        try:
            labeled_segments = assign_roles(merged)
        except ValueError as exc:
            logger.warning(
                "Role assignment failed for %s (%s) — keeping raw diarization labels.",
                audio_path,
                exc,
            )
            labeled_segments = merged

    _report("analyzing")
    logger.info("Stage 3: scoring sentiment/emotion, detecting pivot, generating recommendation")
    stage3_result = analyze_call(labeled_segments, call_id=asr_result["call_id"])

    _report("done")

    return {
        "call_id": stage3_result["call_id"],
        "segments": labeled_segments,
        "sentiment_trajectory": stage3_result["sentiment_trajectory"],
        "emotion_tags": stage3_result["emotion_tags"],
        "pivot_point": stage3_result["pivot_point"],
        "recommendation": stage3_result["recommendation"],
        "criterion_scores": stage3_result["criterion_scores"],
        "coaching_findings": stage3_result["coaching_findings"],
    }


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

    parser = argparse.ArgumentParser(description="Run the full Clearline pipeline on a call recording.")
    parser.add_argument("audio_path", help="Path to the call audio file to process")
    parser.add_argument("--dual-channel", action="store_true", help="Split by channel instead of diarizing")
    parser.add_argument(
        "--output-dir", default="outputs", help="Directory to save the output JSON (default: outputs/)"
    )
    args = parser.parse_args()

    result = run_pipeline(args.audio_path, dual_channel=args.dual_channel)

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{result['call_id']}.json"
    output_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")

    pivot = result["pivot_point"]
    pivot_timestamp = pivot.get("timestamp")
    pivot_summary = f"{pivot_timestamp:.1f}s" if pivot_timestamp is not None else "none detected"
    recommendation_summary = result["recommendation"].get("repair_suggestion", "").strip()

    print(f"Call ID: {result['call_id']}")
    print(f"Pivot point: {pivot_summary}")
    print(f"Recommendation: {recommendation_summary}")
    print(f"Full report saved to {output_path}")


if __name__ == "__main__":
    main()
