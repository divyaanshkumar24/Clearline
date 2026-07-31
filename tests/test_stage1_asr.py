from pathlib import Path

import pytest

from src.stage1_asr.transcribe import transcribe_call

SAMPLE_AUDIO_DIR = Path(__file__).resolve().parent.parent / "sample_audio"
AUDIO_EXTENSIONS = {".wav", ".mp3", ".m4a", ".flac", ".ogg", ".aiff", ".aif"}


def _find_sample_audio():
    if not SAMPLE_AUDIO_DIR.exists():
        return None
    for path in sorted(SAMPLE_AUDIO_DIR.iterdir()):
        if path.suffix.lower() in AUDIO_EXTENSIONS:
            return path
    return None


def test_transcribe_call_on_sample_audio():
    sample_path = _find_sample_audio()
    if sample_path is None:
        pytest.skip(
            f"No audio file found in {SAMPLE_AUDIO_DIR}. "
            "Add a call recording (.wav/.mp3/etc) there and re-run this test."
        )

    result = transcribe_call(str(sample_path), model_size="medium")

    assert result["call_id"] == sample_path.stem
    assert isinstance(result["segments"], list)
    assert len(result["segments"]) > 0, "Expected at least one transcribed segment"

    for segment in result["segments"]:
        assert set(segment.keys()) == {"start", "end", "text"}
        assert segment["start"] < segment["end"]
        assert segment["text"].strip() != ""
