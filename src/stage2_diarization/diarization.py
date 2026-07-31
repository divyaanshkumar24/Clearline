"""Stage 2: speaker diarization via pyannote.audio, with an optional dual-channel mode."""

import os
from pathlib import Path
from typing import Dict, List

import numpy as np
import soundfile as sf
import torch
from dotenv import load_dotenv
from librosa import resample as librosa_resample
from pyannote.audio import Pipeline

from ..stage1_asr.vad import get_speech_segments

load_dotenv()

DIARIZATION_MODEL = "pyannote/speaker-diarization-3.1"
_GATED_MODEL_PAGES = [
    "https://huggingface.co/pyannote/speaker-diarization-3.1",
    "https://huggingface.co/pyannote/segmentation-3.0",
    # pyannote.audio 4.x's speaker-diarization-3.1 pipeline pulls its embedding
    # model from this repo too — also gated, also needs terms accepted.
    "https://huggingface.co/pyannote/speaker-diarization-community-1",
]

_diarization_pipeline = None


def _gated_terms_message() -> str:
    pages = "\n  - ".join(_GATED_MODEL_PAGES)
    return (
        "Could not load pyannote/speaker-diarization-3.1. This is almost always because "
        "the gated model terms haven't been accepted yet for the account behind HF_TOKEN. "
        "While logged in to Hugging Face as that account, visit these pages and click "
        f"'Agree and access repository':\n  - {pages}"
    )


def _load_diarization_pipeline():
    global _diarization_pipeline
    if _diarization_pipeline is not None:
        return _diarization_pipeline

    hf_token = os.environ.get("HF_TOKEN")
    if not hf_token:
        raise RuntimeError(
            "HF_TOKEN is not set. Add it to clearline-backend/.env (see .env.example) — "
            "get a token at https://huggingface.co/settings/tokens. You'll also need to "
            "accept the gated model terms; see these pages while logged in:\n  - "
            + "\n  - ".join(_GATED_MODEL_PAGES)
        )

    try:
        pipeline = Pipeline.from_pretrained(DIARIZATION_MODEL, token=hf_token)
    except Exception as exc:
        raise RuntimeError(f"{_gated_terms_message()}\n\nOriginal error: {exc}") from exc

    if pipeline is None:
        # pyannote.audio returns None (rather than raising) in some gated-access failure
        # modes, so this check is needed in addition to the try/except above.
        raise RuntimeError(_gated_terms_message())

    if torch.cuda.is_available():
        pipeline.to(torch.device("cuda"))

    _diarization_pipeline = pipeline
    return pipeline


def _load_stereo_channels(audio_path: str, target_sr: int = 16000):
    audio, native_sr = sf.read(audio_path, dtype="float32", always_2d=True)
    if audio.shape[1] < 2:
        raise ValueError(
            f"dual_channel=True requires stereo audio, but {audio_path} has "
            f"{audio.shape[1]} channel(s)."
        )

    channel_agent, channel_client = audio[:, 0], audio[:, 1]
    if native_sr != target_sr:
        channel_agent = librosa_resample(channel_agent, orig_sr=native_sr, target_sr=target_sr)
        channel_client = librosa_resample(channel_client, orig_sr=native_sr, target_sr=target_sr)

    return channel_agent.astype(np.float32), channel_client.astype(np.float32), target_sr


def _diarize_dual_channel(audio_path: str) -> List[Dict]:
    channel_agent, channel_client, sr = _load_stereo_channels(audio_path)

    turns = []
    for label, channel_audio in (("agent", channel_agent), ("client", channel_client)):
        for seg in get_speech_segments(channel_audio, sample_rate=sr):
            turns.append({"start": round(seg["start"], 3), "end": round(seg["end"], 3), "speaker": label})

    turns.sort(key=lambda t: t["start"])
    return turns


def diarize_call(audio_path: str, dual_channel: bool = False) -> List[Dict]:
    """Return speaker turns for a call recording as [{"start", "end", "speaker"}, ...].

    In dual_channel mode, channel 0 is assumed to always be the agent and channel 1
    the client — diarization is skipped entirely, and turns come straight from
    per-channel Silero VAD, already labeled "agent"/"client" (not SPEAKER_00/01).
    """
    if dual_channel:
        return _diarize_dual_channel(audio_path)

    pipeline = _load_diarization_pipeline()
    diarization = pipeline(str(Path(audio_path)))

    return [
        {"start": round(turn.start, 3), "end": round(turn.end, 3), "speaker": speaker}
        for turn, _, speaker in diarization.itertracks(yield_label=True)
    ]
