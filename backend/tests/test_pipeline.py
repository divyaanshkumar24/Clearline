import os
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf
from dotenv import load_dotenv

from src.pipeline import run_pipeline

load_dotenv()

SAMPLE_AUDIO_DIR = Path(__file__).resolve().parent.parent / "sample_audio"
AUDIO_EXTENSIONS = {".wav", ".mp3", ".m4a", ".flac", ".ogg", ".aiff", ".aif"}

EXPECTED_TOP_LEVEL_KEYS = {
    "call_id",
    "speaker_count",
    "roles_assigned",
    "segments",
    "sentiment_trajectory",
    "emotion_tags",
    "pivot_point",
    "recommendation",
    "criterion_scores",
    "coaching_findings",
}


def _find_sample_audio():
    if not SAMPLE_AUDIO_DIR.exists():
        return None
    for path in sorted(SAMPLE_AUDIO_DIR.iterdir()):
        if path.suffix.lower() in AUDIO_EXTENSIONS:
            return path
    return None


def test_run_pipeline_raises_on_silent_audio(tmp_path):
    silent_path = tmp_path / "silence.wav"
    sf.write(str(silent_path), np.zeros(16000 * 2, dtype="float32"), 16000)

    with pytest.raises(RuntimeError, match="no transcript segments"):
        run_pipeline(str(silent_path))


def test_run_pipeline_end_to_end_on_sample_audio():
    sample_path = _find_sample_audio()
    if sample_path is None:
        pytest.skip(
            f"No audio file found in {SAMPLE_AUDIO_DIR}. "
            "Add a call recording (.wav/.mp3/etc) there and re-run this test."
        )
    if not os.environ.get("HF_TOKEN"):
        pytest.skip("HF_TOKEN is not set; can't run real diarization for the Stage 2 step.")
    if not os.environ.get("NVIDIA_API_KEY"):
        pytest.skip("NVIDIA_API_KEY is not set; can't call the real NVIDIA API for Stage 3.")

    result = run_pipeline(str(sample_path))

    assert set(result.keys()) == EXPECTED_TOP_LEVEL_KEYS
    assert result["call_id"] == sample_path.stem
    assert isinstance(result["segments"], list) and len(result["segments"]) > 0
    for key in ("what_went_wrong", "root_cause", "repair_suggestion"):
        assert key in result["recommendation"]
