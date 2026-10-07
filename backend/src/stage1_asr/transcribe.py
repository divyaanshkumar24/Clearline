"""Stage 1: audio preprocessing + speech-to-text for a single call recording.

Design choice — VAD-segment-then-transcribe, not VAD-trim-then-single-pass:
Silero VAD is used to find speech regions and each region is fed to
faster-whisper individually (offsetting the returned timestamps by the
segment's start time), rather than concatenating the trimmed speech into one
continuous buffer and transcribing it in a single pass.

Concatenating non-contiguous audio creates artificial discontinuities
("jump cuts") at every splice point, which can confuse Whisper's language
model and produce hallucinated or garbled text right at those boundaries —
and it also requires reconstructing a trimmed-time -> original-time mapping
to recover correct absolute timestamps. Transcribing each VAD segment against
the original (untouched) audio avoids both problems: timestamps are exact
(segment_start + whisper_offset) and Whisper only ever sees real, contiguous
audio. The cost is one model invocation per segment instead of one for the
whole file, which is a reasonable trade for correctness — faster-whisper's
per-call overhead is small relative to decode time, and it also lets us skip
faster-whisper's own built-in VAD entirely (Silero already did that job).
"""

import os
from pathlib import Path
from typing import Callable, Dict, List, Optional

import torch
from faster_whisper import WhisperModel

from .audio_preprocessing import TARGET_SAMPLE_RATE, load_audio_16k_mono
from .vad import get_speech_segments

_whisper_models: Dict[tuple, WhisperModel] = {}

DEFAULT_MODEL_SIZE = "medium"


def default_model_size() -> str:
    """The Whisper size used when the caller doesn't pick one.

    Set WHISPER_MODEL_SIZE in .env (e.g. "small" or "base") to trade some accuracy
    for a much faster run — worthwhile for demos on a CPU, where "medium" takes
    roughly 2-3x the audio's length. Read at call time, not import time, so it
    picks up values load_dotenv() adds after this module is imported.
    """
    return os.environ.get("WHISPER_MODEL_SIZE") or DEFAULT_MODEL_SIZE


def _get_whisper_model(model_size: str, device: str, compute_type: str) -> WhisperModel:
    key = (model_size, device, compute_type)
    if key not in _whisper_models:
        _whisper_models[key] = WhisperModel(model_size, device=device, compute_type=compute_type)
    return _whisper_models[key]


def _default_device_and_compute_type() -> tuple:
    if torch.cuda.is_available():
        return "cuda", "float16"
    return "cpu", "int8"


def transcribe_call(
    audio_path: str,
    model_size: Optional[str] = None,
    device: Optional[str] = None,
    compute_type: Optional[str] = None,
    language: Optional[str] = None,
    on_progress: Optional[Callable[[float], None]] = None,
) -> dict:
    """Transcribe a call recording into {"call_id": ..., "segments": [...]}.

    Args:
        audio_path: Path to the audio file (any format soundfile can decode).
        model_size: faster-whisper model size (e.g. "tiny", "base", "small", "medium", "large-v3").
            Defaults to default_model_size() — "medium" unless WHISPER_MODEL_SIZE is set.
        device: "cpu" or "cuda". Defaults to "cuda" if available, else "cpu".
        compute_type: faster-whisper compute type. Defaults to "float16" on GPU, "int8" on CPU.
        language: Force a transcription language (e.g. "en"). Defaults to auto-detect.
        on_progress: Optional callback called with the fraction (0.0-1.0) of speech
            audio transcribed so far, after each speech region. Lets a caller show a
            real progress bar for what is by far the slowest stage on a CPU.
    """
    model_size = model_size or default_model_size()
    default_device, default_compute_type = _default_device_and_compute_type()
    device = device or default_device
    compute_type = compute_type or default_compute_type

    audio = load_audio_16k_mono(audio_path, target_sr=TARGET_SAMPLE_RATE)
    speech_segments = get_speech_segments(audio, sample_rate=TARGET_SAMPLE_RATE)

    whisper_model = _get_whisper_model(model_size, device, compute_type)

    # Weight progress by audio duration, not region count — one 20s region is
    # far more work than five 1s ones.
    total_speech = sum(seg["end"] - seg["start"] for seg in speech_segments) or 1.0
    done_speech = 0.0

    output_segments: List[Dict] = []
    for vad_segment in speech_segments:
        start_sample = int(vad_segment["start"] * TARGET_SAMPLE_RATE)
        end_sample = int(vad_segment["end"] * TARGET_SAMPLE_RATE)
        chunk = audio[start_sample:end_sample]
        if chunk.size == 0:
            continue

        whisper_segments, _info = whisper_model.transcribe(
            chunk,
            language=language,
            vad_filter=False,  # Silero already isolated speech; avoid double VAD
        )

        for seg in whisper_segments:
            text = seg.text.strip()
            if not text:
                continue
            output_segments.append(
                {
                    "start": round(vad_segment["start"] + seg.start, 3),
                    "end": round(vad_segment["start"] + seg.end, 3),
                    "text": text,
                }
            )

        done_speech += vad_segment["end"] - vad_segment["start"]
        if on_progress is not None:
            on_progress(min(1.0, done_speech / total_speech))

    return {
        "call_id": Path(audio_path).stem,
        "segments": output_segments,
    }
