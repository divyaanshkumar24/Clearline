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


def test_transcribe_call_reports_progress_and_honors_env_model_size(monkeypatch):
    """Progress is duration-weighted per speech region and ends at 1.0; model size
    comes from WHISPER_MODEL_SIZE when the caller doesn't pass one."""
    import numpy as np

    from src.stage1_asr import transcribe as T

    class FakeSeg:
        def __init__(self, text):
            self.text, self.start, self.end = text, 0.0, 1.0

    class FakeModel:
        def transcribe(self, chunk, **kwargs):
            return [FakeSeg("hello")], None

    chosen = {}

    def fake_get_model(model_size, device, compute_type):
        chosen["size"] = model_size
        return FakeModel()

    monkeypatch.setattr(T, "load_audio_16k_mono", lambda *a, **kw: np.zeros(16000 * 10, dtype=np.float32))
    # one 1s region and one 3s region -> progress should be 0.25 then 1.0
    monkeypatch.setattr(T, "get_speech_segments", lambda *a, **kw: [{"start": 0.0, "end": 1.0}, {"start": 2.0, "end": 5.0}])
    monkeypatch.setattr(T, "_get_whisper_model", fake_get_model)
    monkeypatch.setenv("WHISPER_MODEL_SIZE", "small")

    updates = []
    result = T.transcribe_call("x.wav", on_progress=updates.append)

    assert updates == [0.25, 1.0]
    assert chosen["size"] == "small"
    assert T.default_model_size() == "small"
    assert len(result["segments"]) == 2

    monkeypatch.delenv("WHISPER_MODEL_SIZE")
    assert T.default_model_size() == "medium"
