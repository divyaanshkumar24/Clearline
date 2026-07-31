"""Combine Stage 1 ASR output with Stage 2 diarization + role assignment."""

from typing import Dict

from .diarization import diarize_call
from .merge import merge_transcript_with_speakers
from .roles import assign_roles


def label_speakers(asr_result: Dict, audio_path: str, dual_channel: bool = False) -> Dict:
    """Apply Stage 2 (diarization + role assignment) to Stage 1's transcript.

    Args:
        asr_result: Output of stage1_asr.transcribe_call() — {"call_id", "segments"}.
        audio_path: Path to the same audio file transcribe_call() was run on.
        dual_channel: If True, skip diarization and split by channel (0=agent, 1=client).

    Returns:
        {"call_id": ..., "segments": [{"start", "end", "text", "speaker"}, ...]}
    """
    diarization_segments = diarize_call(audio_path, dual_channel=dual_channel)
    merged = merge_transcript_with_speakers(asr_result["segments"], diarization_segments)
    labeled = assign_roles(merged)
    return {"call_id": asr_result["call_id"], "segments": labeled}
