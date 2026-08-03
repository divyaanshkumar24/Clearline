import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from src import api
from src.stage3_recommendations import analyze as analyze_module

SAMPLE_AUDIO_DIR = Path(__file__).resolve().parent.parent / "sample_audio"
AUDIO_EXTENSIONS = {".wav", ".mp3", ".m4a", ".flac", ".ogg", ".aiff", ".aif"}

FAKE_RECOMMENDATION = {
    "what_went_wrong": "Test placeholder — the real LLM call is mocked in this test.",
    "root_cause": "Test placeholder.",
    "repair_suggestion": "Test placeholder.",
}
FAKE_CRITERION_SCORES = []
FAKE_COACHING_FINDINGS = []


def _find_sample_audio():
    if not SAMPLE_AUDIO_DIR.exists():
        return None
    for path in sorted(SAMPLE_AUDIO_DIR.iterdir()):
        if path.suffix.lower() in AUDIO_EXTENSIONS:
            return path
    return None


def test_upload_poll_and_fetch_result(monkeypatch):
    sample_path = _find_sample_audio()
    if sample_path is None:
        pytest.skip(
            f"No audio file found in {SAMPLE_AUDIO_DIR}. "
            "Add a call recording (.wav/.mp3/etc) there and re-run this test."
        )

    # Stage 3's LLM calls need a real NVIDIA_API_KEY we don't require for this test —
    # mock both so the pipeline can reach "done" on local models alone.
    monkeypatch.setattr(analyze_module, "generate_recommendation", lambda *a, **kw: FAKE_RECOMMENDATION)
    monkeypatch.setattr(
        analyze_module,
        "generate_compliance_scoring",
        lambda *a, **kw: (FAKE_CRITERION_SCORES, FAKE_COACHING_FINDINGS),
    )

    client = TestClient(api.app)

    with sample_path.open("rb") as f:
        response = client.post("/calls", files={"file": (sample_path.name, f, "audio/wav")})
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "processing"
    call_id = body["call_id"]

    deadline = time.monotonic() + 600
    stage = None
    while time.monotonic() < deadline:
        status_response = client.get(f"/calls/{call_id}/status")
        assert status_response.status_code == 200
        status_body = status_response.json()
        assert status_body["call_id"] == call_id
        assert 0 <= status_body["progress_pct"] <= 100
        stage = status_body["stage"]
        if stage in ("done", "failed"):
            break
        time.sleep(1)

    assert stage == "done", f"Pipeline did not finish successfully (stage={stage})"

    result_response = client.get(f"/calls/{call_id}")
    assert result_response.status_code == 200
    result = result_response.json()

    assert set(result.keys()) == {
        "call_id",
        "segments",
        "sentiment_trajectory",
        "emotion_tags",
        "pivot_point",
        "recommendation",
        "criterion_scores",
        "coaching_findings",
    }
    assert result["call_id"] == call_id
    assert result["recommendation"] == FAKE_RECOMMENDATION
    assert result["criterion_scores"] == FAKE_CRITERION_SCORES
    assert result["coaching_findings"] == FAKE_COACHING_FINDINGS


def test_status_for_unknown_call_id():
    client = TestClient(api.app)
    response = client.get("/calls/does-not-exist/status")
    assert response.status_code == 404


def test_result_for_unknown_call_id():
    client = TestClient(api.app)
    response = client.get("/calls/does-not-exist")
    assert response.status_code == 404
