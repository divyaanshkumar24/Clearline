import time
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf
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
    assert result["call_id"] == call_id
    assert result["recommendation"] == FAKE_RECOMMENDATION
    assert result["criterion_scores"] == FAKE_CRITERION_SCORES
    assert result["coaching_findings"] == FAKE_COACHING_FINDINGS


def _write_silent_wav(path: Path, channels: int, seconds: float = 0.5, sample_rate: int = 16000):
    frames = np.zeros((int(sample_rate * seconds), channels), dtype="float32")
    sf.write(str(path), frames, sample_rate)
    return path


@pytest.fixture
def upload_client(tmp_path, monkeypatch):
    """TestClient with an isolated upload dir and the pipeline stubbed out.

    Returns (client, calls) where `calls` collects the dual_channel value the
    background task would have received.
    """
    upload_dir = tmp_path / "uploads"
    monkeypatch.setattr(api, "UPLOAD_DIR", upload_dir)
    monkeypatch.setattr(api, "CALLS_DIR", tmp_path / "calls")
    monkeypatch.setattr(api, "JOBS", {})

    calls = []
    monkeypatch.setattr(
        api,
        "_process_call",
        lambda call_id, audio_path, dual_channel: calls.append(dual_channel),
    )
    return TestClient(api.app), calls, upload_dir


def test_dual_channel_rejects_mono_upload(upload_client, tmp_path):
    client, calls, upload_dir = upload_client
    mono = _write_silent_wav(tmp_path / "mono.wav", channels=1)

    with mono.open("rb") as f:
        response = client.post(
            "/calls",
            files={"file": ("mono.wav", f, "audio/wav")},
            data={"dual_channel": "true"},
        )

    assert response.status_code == 400
    assert "stereo" in response.json()["detail"]
    # The rejected upload must not be queued, nor left behind on disk.
    assert calls == []
    assert list(upload_dir.glob("*")) == []


def test_mono_upload_without_dual_channel_is_accepted(upload_client, tmp_path):
    client, calls, _ = upload_client
    mono = _write_silent_wav(tmp_path / "mono.wav", channels=1)

    with mono.open("rb") as f:
        response = client.post(
            "/calls",
            files={"file": ("mono.wav", f, "audio/wav")},
            data={"dual_channel": "false"},
        )

    assert response.status_code == 200
    assert response.json()["status"] == "processing"
    assert calls == [False]


def test_dual_channel_accepts_stereo_upload(upload_client, tmp_path):
    client, calls, _ = upload_client
    stereo = _write_silent_wav(tmp_path / "stereo.wav", channels=2)

    with stereo.open("rb") as f:
        response = client.post(
            "/calls",
            files={"file": ("stereo.wav", f, "audio/wav")},
            data={"dual_channel": "true"},
        )

    assert response.status_code == 200
    assert calls == [True]


def _finished_job(call_id: str, created_at: float, timings=None):
    return {
        "stage": "done",
        "progress_pct": 100,
        "result": {"call_id": call_id, "segments": [], "criterion_scores": []},
        "error": None,
        "created_at": created_at,
        "stage_timings": timings or {"transcribing": 1.5},
    }


def test_list_calls_returns_finished_calls_newest_first(upload_client):
    client, _, _ = upload_client
    api.JOBS["old"] = _finished_job("old", created_at=1000.0)
    api.JOBS["new"] = _finished_job("new", created_at=2000.0)

    body = client.get("/calls").json()

    assert [c["call_id"] for c in body["calls"]] == ["new", "old"]
    # Dashboard metadata rides along so the frontend needs no second request.
    assert body["calls"][0]["stage_timings"] == {"transcribing": 1.5}
    assert body["calls"][0]["created_at"] == 2000.0


def test_list_calls_excludes_unfinished_jobs(upload_client):
    client, _, _ = upload_client
    api.JOBS["done"] = _finished_job("done", created_at=time.time())
    api.JOBS["running"] = {
        "stage": "transcribing", "progress_pct": 0, "result": None,
        "error": None, "created_at": time.time(), "stage_timings": {},
    }
    api.JOBS["broken"] = {
        "stage": "failed", "progress_pct": 40, "result": None,
        "error": "boom", "created_at": time.time(), "stage_timings": {},
    }

    assert [c["call_id"] for c in client.get("/calls").json()["calls"]] == ["done"]


def test_watchdog_fails_a_job_that_outlived_its_budget(upload_client, monkeypatch):
    client, _, _ = upload_client
    monkeypatch.setattr(api, "JOB_TIMEOUT_SEC", 60.0)
    # A job whose process died mid-run: still "transcribing", never updated again.
    api.JOBS["stuck"] = {
        "stage": "transcribing", "progress_pct": 0, "result": None,
        "error": None, "created_at": time.time() - 3600, "stage_timings": {},
    }

    body = client.get("/calls/stuck/status").json()

    assert body["stage"] == "failed"
    assert "stopped responding" in body["error"]
    assert "transcribing" in body["error"]
    # And the result endpoint agrees rather than reporting "still processing".
    assert client.get("/calls/stuck").status_code == 500


def test_watchdog_leaves_a_job_inside_its_budget_alone(upload_client, monkeypatch):
    client, _, _ = upload_client
    monkeypatch.setattr(api, "JOB_TIMEOUT_SEC", 3600.0)
    api.JOBS["fresh"] = {
        "stage": "transcribing", "progress_pct": 0, "result": None,
        "error": None, "created_at": time.time() - 5, "stage_timings": {},
    }

    assert client.get("/calls/fresh/status").json()["stage"] == "transcribing"


def test_finished_calls_survive_a_restart(upload_client):
    """Job state is in-process, so a finished call is written to disk and read
    back on import — otherwise a restart 404s every previously analyzed call."""
    _, _, _ = upload_client
    api.JOBS["kept"] = _finished_job("kept", created_at=1234.0)
    api._persist_job("kept")

    api.JOBS.clear()
    api._load_persisted_jobs()

    assert api.JOBS["kept"]["stage"] == "done"
    assert api.JOBS["kept"]["result"]["call_id"] == "kept"


def test_status_for_unknown_call_id():
    client = TestClient(api.app)
    response = client.get("/calls/does-not-exist/status")
    assert response.status_code == 404


def test_result_for_unknown_call_id():
    client = TestClient(api.app)
    response = client.get("/calls/does-not-exist")
    assert response.status_code == 404


def test_concurrent_jobs_never_run_the_pipeline_at_the_same_time(monkeypatch):
    """Regression: two overlapping jobs crashed the whole server (the shared Silero VAD
    model isn't thread-safe), so _process_call must serialize pipeline runs."""
    import threading

    active = 0
    max_active = 0
    guard = threading.Lock()

    def fake_pipeline(audio_path, dual_channel=False, on_stage=None):
        nonlocal active, max_active
        with guard:
            active += 1
            max_active = max(max_active, active)
        time.sleep(0.2)
        with guard:
            active -= 1
        return {"call_id": Path(audio_path).stem}

    monkeypatch.setattr(api, "run_pipeline", fake_pipeline)
    monkeypatch.setattr(api, "_persist_job", lambda call_id: None)

    ids = ["lock-test-a", "lock-test-b", "lock-test-c"]
    for call_id in ids:
        api.JOBS[call_id] = {
            "stage": "queued", "progress_pct": 0, "result": None, "error": None,
            "created_at": time.time(), "stage_timings": {},
        }
    try:
        threads = [
            threading.Thread(target=api._process_call, args=(call_id, Path(f"{call_id}.wav"), False))
            for call_id in ids
        ]
        for th in threads:
            th.start()
        for th in threads:
            th.join(timeout=10)

        assert max_active == 1
        assert all(api.JOBS[call_id]["stage"] == "done" for call_id in ids)
    finally:
        for call_id in ids:
            api.JOBS.pop(call_id, None)
