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

from pathlib import Path
from typing import Dict, List, Optional

import torch
from faster_whisper import WhisperModel

from .audio_preprocessing import TARGET_SAMPLE_RATE, load_audio_16k_mono
from .vad import get_speech_segments

_whisper_models: Dict[tuple, WhisperModel] = {}


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
    model_size: str = "medium",
    device: Optional[str] = None,
    compute_type: Optional[str] = None,
    language: Optional[str] = None,
) -> dict:
    """Transcribe a call recording into {"call_id": ..., "segments": [...]}.

    Args:
        audio_path: Path to the audio file (any format soundfile can decode).
        model_size: faster-whisper model size (e.g. "tiny", "base", "small", "medium", "large-v3").
        device: "cpu" or "cuda". Defaults to "cuda" if available, else "cpu".
        compute_type: faster-whisper compute type. Defaults to "float16" on GPU, "int8" on CPU.
        language: Force a transcription language (e.g. "en"). Defaults to auto-detect.
    """
    default_device, default_compute_type = _default_device_and_compute_type()
    device = device or default_device
    compute_type = compute_type or default_compute_type

    audio = load_audio_16k_mono(audio_path, target_sr=TARGET_SAMPLE_RATE)
    speech_segments = get_speech_segments(audio, sample_rate=TARGET_SAMPLE_RATE)

    whisper_model = _get_whisper_model(model_size, device, compute_type)

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

    return {
        "call_id": Path(audio_path).stem,
        "segments": output_segments,
    }
