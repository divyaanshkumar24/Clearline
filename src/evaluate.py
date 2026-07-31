"""Lightweight evaluation harness: runs the full pipeline over every audio file
in sample_audio/ and reports a quality summary table (word count, speakers
detected, whether a pivot was found, WER against a reference transcript if
one exists, and the generated recommendation).

Usage:
    python -m src.evaluate
    python -m src.evaluate --sample-audio-dir some/other/dir --output some/table.md
"""

import argparse
import re
from pathlib import Path
from typing import Dict, List, Optional

import jiwer

from .pipeline import run_pipeline

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SAMPLE_AUDIO_DIR = PROJECT_ROOT / "sample_audio"
DEFAULT_OUTPUT_PATH = PROJECT_ROOT / "outputs" / "evaluation_summary.md"

AUDIO_EXTENSIONS = {".wav", ".mp3", ".m4a", ".flac", ".ogg", ".aiff", ".aif"}


def _find_sample_audio_files(directory: Path) -> List[Path]:
    if not directory.exists():
        return []
    return sorted(p for p in directory.iterdir() if p.suffix.lower() in AUDIO_EXTENSIONS)


def _reference_path_for(call_id: str, directory: Path) -> Optional[Path]:
    candidate = directory / f"{call_id}_reference.txt"
    return candidate if candidate.exists() else None


def _transcript_text(segments: List[Dict]) -> str:
    return " ".join(seg["text"].strip() for seg in segments if seg.get("text"))


def _word_count(text: str) -> int:
    return len(text.split())


def _normalize_for_wer(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^\w\s]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def evaluate_sample_audio(
    sample_audio_dir: Path = SAMPLE_AUDIO_DIR,
    dual_channel: bool = False,
) -> List[Dict]:
    """Run the pipeline over every audio file in `sample_audio_dir` and collect
    one evaluation row per call. A call that raises during the pipeline gets a
    row with only "call_id" and "error" set, so one bad file doesn't abort the
    rest of the evaluation.
    """
    audio_files = _find_sample_audio_files(sample_audio_dir)
    rows: List[Dict] = []

    for audio_path in audio_files:
        call_id = audio_path.stem
        try:
            result = run_pipeline(str(audio_path), dual_channel=dual_channel)
        except Exception as exc:  # noqa: BLE001 - one bad file shouldn't abort the run
            rows.append({"call_id": call_id, "error": str(exc)})
            continue

        transcript_text = _transcript_text(result["segments"])
        speaker_labels = {seg["speaker"] for seg in result["segments"] if seg.get("speaker")}
        pivot_found = result["pivot_point"].get("turn_index") is not None
        recommendation_summary = result["recommendation"].get("repair_suggestion", "").strip()

        reference_path = _reference_path_for(call_id, sample_audio_dir)
        wer: Optional[float] = None
        if reference_path is not None:
            reference_text = reference_path.read_text(encoding="utf-8").strip()
            wer = jiwer.wer(_normalize_for_wer(reference_text), _normalize_for_wer(transcript_text))

        rows.append(
            {
                "call_id": call_id,
                "word_count": _word_count(transcript_text),
                "speakers_detected": len(speaker_labels),
                "pivot_found": pivot_found,
                "has_reference": reference_path is not None,
                "wer": wer,
                "recommendation_summary": recommendation_summary,
            }
        )

    return rows


def _format_wer(wer: Optional[float]) -> str:
    return f"{wer:.1%}" if wer is not None else "—"


def _truncate(text: str, max_len: int = 90) -> str:
    text = text.replace("\n", " ").strip()
    return text if len(text) <= max_len else text[: max_len - 1].rstrip() + "…"


def render_markdown_table(rows: List[Dict]) -> str:
    lines = [
        "# Evaluation Summary",
        "",
        "| Call ID | Word Count | Speakers Detected | Pivot Found | WER | Recommendation |",
        "|---|---|---|---|---|---|",
    ]

    for row in rows:
        if "error" in row:
            lines.append(f"| {row['call_id']} | ERROR | ERROR | ERROR | ERROR | {row['error']} |")
            continue
        lines.append(
            "| {call_id} | {word_count} | {speakers} | {pivot} | {wer} | {rec} |".format(
                call_id=row["call_id"],
                word_count=row["word_count"],
                speakers=row["speakers_detected"],
                pivot="yes" if row["pivot_found"] else "no",
                wer=_format_wer(row["wer"]),
                rec=_truncate(row["recommendation_summary"]),
            )
        )

    missing_reference = [row["call_id"] for row in rows if "error" not in row and not row["has_reference"]]
    lines.append("")
    if missing_reference:
        lines.append(
            "**No reference transcript found for:** "
            + ", ".join(missing_reference)
            + " — WER is not computed for these. Add "
            "`<call_id>_reference.txt` to `sample_audio/` to cover them."
        )
    elif rows:
        lines.append("All evaluated calls have a reference transcript.")

    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate the pipeline over sample_audio/.")
    parser.add_argument(
        "--sample-audio-dir", default=str(SAMPLE_AUDIO_DIR), help="Directory of audio files to evaluate"
    )
    parser.add_argument("--dual-channel", action="store_true", help="Run all calls in dual-channel mode")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT_PATH), help="Where to save the markdown table")
    args = parser.parse_args()

    sample_audio_dir = Path(args.sample_audio_dir)
    rows = evaluate_sample_audio(sample_audio_dir=sample_audio_dir, dual_channel=args.dual_channel)

    if not rows:
        print(f"No audio files found in {sample_audio_dir} — nothing to evaluate.")
        return

    table_md = render_markdown_table(rows)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(table_md, encoding="utf-8")

    print(table_md)
    print(f"Saved to {output_path}")


if __name__ == "__main__":
    main()
