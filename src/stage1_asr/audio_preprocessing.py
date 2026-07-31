"""Audio loading + resampling utilities."""

import numpy as np
import soundfile as sf
from librosa import resample as librosa_resample

TARGET_SAMPLE_RATE = 16000


def load_audio_16k_mono(audio_path: str, target_sr: int = TARGET_SAMPLE_RATE) -> np.ndarray:
    """Load an audio file and return float32 samples, mono, at `target_sr` Hz.

    Uses soundfile for decoding (fast, no forced resampling) and only calls
    into librosa's resampler when the file's native sample rate or channel
    count doesn't already match what we need.
    """
    audio, native_sr = sf.read(audio_path, dtype="float32", always_2d=True)

    if audio.shape[1] > 1:
        audio = audio.mean(axis=1)
    else:
        audio = audio[:, 0]

    if native_sr != target_sr:
        audio = librosa_resample(audio, orig_sr=native_sr, target_sr=target_sr)

    return np.ascontiguousarray(audio, dtype=np.float32)
