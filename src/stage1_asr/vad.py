"""Speech segment detection using Silero VAD (loaded via torch.hub)."""

from typing import Dict, List

import numpy as np
import torch

_vad_model = None
_get_speech_timestamps = None


def _load_silero_vad():
    """Lazily load and cache Silero VAD so repeated calls don't re-download/re-init it."""
    global _vad_model, _get_speech_timestamps

    if _vad_model is None:
        model, utils = torch.hub.load(
            repo_or_dir="snakers4/silero-vad",
            model="silero_vad",
            trust_repo=True,
        )
        _vad_model = model
        _get_speech_timestamps = utils[0]  # (get_speech_timestamps, save_audio, read_audio, VADIterator, collect_chunks)

    return _vad_model, _get_speech_timestamps


def get_speech_segments(
    audio: np.ndarray,
    sample_rate: int = 16000,
    min_silence_duration_ms: int = 300,
    speech_pad_ms: int = 200,
) -> List[Dict[str, float]]:
    """Return speech segments as [{"start": seconds, "end": seconds}, ...], silence dropped.

    `speech_pad_ms` pads each detected segment so word onsets/offsets aren't clipped;
    `min_silence_duration_ms` controls how much silence is required before Silero
    splits one speech region into two, which avoids over-fragmenting natural pauses.
    """
    model, get_speech_timestamps = _load_silero_vad()

    audio_tensor = torch.from_numpy(audio).float()
    timestamps = get_speech_timestamps(
        audio_tensor,
        model,
        sampling_rate=sample_rate,
        min_silence_duration_ms=min_silence_duration_ms,
        speech_pad_ms=speech_pad_ms,
        return_seconds=True,
    )

    return [{"start": ts["start"], "end": ts["end"]} for ts in timestamps]
