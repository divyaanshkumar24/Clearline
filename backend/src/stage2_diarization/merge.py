"""Merge Stage 1 ASR segments with Stage 2 diarization speaker turns."""

from typing import Dict, List, Optional


def _overlap_seconds(a_start: float, a_end: float, b_start: float, b_end: float) -> float:
    return max(0.0, min(a_end, b_end) - max(a_start, b_start))


def merge_transcript_with_speakers(
    asr_segments: List[Dict],
    diarization_segments: List[Dict],
) -> List[Dict]:
    """Assign each ASR segment the diarization speaker with the most time overlap.

    An ASR segment that doesn't overlap any diarization turn (e.g. VAD and
    diarization disagreed, or diarization returned nothing) gets "speaker": None
    rather than being dropped, so downstream stages can still see the text.
    """
    merged = []
    for asr_seg in asr_segments:
        best_speaker: Optional[str] = None
        best_overlap = 0.0
        for dia_seg in diarization_segments:
            overlap = _overlap_seconds(asr_seg["start"], asr_seg["end"], dia_seg["start"], dia_seg["end"])
            if overlap > best_overlap:
                best_overlap = overlap
                best_speaker = dia_seg["speaker"]

        merged.append({**asr_seg, "speaker": best_speaker})

    return merged
