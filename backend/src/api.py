"""FastAPI web service exposing the Clearline pipeline to the Next.js frontend.

Run with:
    uvicorn src.api:app --reload
"""

import json
import logging
import os
import shutil
import threading
import time
import uuid
from pathlib import Path
from typing import Dict, Optional

import soundfile as sf
from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .pipeline import run_pipeline
from .stage1_asr.transcribe import default_model_size
from .stage2_diarization.diarization import DIARIZATION_MODEL
from .stage3_recommendations.recommendation import MODEL as RECOMMENDATION_MODEL

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
UPLOAD_DIR = PROJECT_ROOT / "uploads"

# Finished calls are persisted as one JSON file per call_id — the simplest
# storage that satisfies "fetchable by call_id after a restart" for a demo at
# this scale (a handful of calls, single process, no concurrent writers). A
# real deployment would want SQLite/Postgres for querying and concurrent
# access, but that's setup this prototype doesn't need yet.
CALLS_DIR = PROJECT_ROOT / "calls"

# A job that outlives this budget is treated as dead. The pipeline loads three
# model families in one process, so an OOM-kill or a wedged model call would
# otherwise leave the job pinned at its last stage and the frontend polling it
# forever. Generous enough not to fire on a genuinely long call.
JOB_TIMEOUT_SEC = float(os.environ.get("JOB_TIMEOUT_SEC", 45 * 60))

# Progress reported at the *start* of each stage — i.e. this much of the call
# is already done by the time that stage begins. The two slow CPU stages also report
# finer progress while they run (see STAGE_END and on_progress below).
STAGE_PROGRESS = {
    "queued": 0,
    "transcribing": 0,
    "diarizing": 40,
    "analyzing": 70,
    "done": 100,
}

# Where each progress-reporting stage's slice of the bar ends (it starts at its
# STAGE_PROGRESS value). A stage's in-progress value is held just under this so the
# bar reaches it exactly when the next stage begins, never before.
STAGE_END = {"transcribing": 40, "diarizing": 70}

# call_id -> {"stage", "progress_pct", "result", "error", "created_at", "stage_timings"}
JOBS: Dict[str, Dict] = {}

# Only one pipeline run at a time. FastAPI runs each background task in its own
# worker thread, and the pipeline's models are process-wide singletons — notably the
# Silero VAD TorchScript module, which is not thread-safe. Two overlapping jobs
# corrupt its memory ("pointer being freed was not allocated") and SIGABRT the whole
# server, taking every other user's job down with it (reproduced by uploading two
# calls at once). The work is CPU-bound anyway, so parallel jobs wouldn't finish
# sooner; a job that has to wait just sits in the "queued" stage until its turn.
_PIPELINE_LOCK = threading.Lock()


def _persist_job(call_id: str) -> None:
    CALLS_DIR.mkdir(parents=True, exist_ok=True)
    path = CALLS_DIR / f"{call_id}.json"
    path.write_text(json.dumps(JOBS[call_id]), encoding="utf-8")


def _load_persisted_jobs() -> None:
    if not CALLS_DIR.exists():
        return
    for path in CALLS_DIR.glob("*.json"):
        try:
            job = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            logger.warning("Skipping unreadable persisted call %s", path.name)
            continue
        JOBS[path.stem] = job


_load_persisted_jobs()

app = FastAPI(title="Clearline Pipeline API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# HF_TOKEN/NVIDIA_API_KEY are only ever checked deep inside a background job
# (stage2_diarization/diarization.py, stage3_recommendations/recommendation.py),
# so a missing key otherwise only surfaces as a job that fails a minute into
# processing. Warn loudly at startup so a misconfigured .env is obvious before
# anyone clicks "Analyze call".
if not os.environ.get("HF_TOKEN"):
    logger.warning(
        "HF_TOKEN is not set — every call will fail at the diarization stage. "
        "See .env.example."
    )
if not os.environ.get("NVIDIA_API_KEY"):
    logger.warning(
        "NVIDIA_API_KEY is not set — every call will fail at the recommendation "
        "stage. See .env.example."
    )


@app.get("/health")
async def health() -> Dict:
    """Report whether the credentials each pipeline stage needs are configured,
    without running anything — lets the frontend (or a developer) tell "backend
    isn't running" apart from "backend is running but will fail every call"."""
    return {
        "status": "ok",
        "hf_token_configured": bool(os.environ.get("HF_TOKEN")),
        "nvidia_api_key_configured": bool(os.environ.get("NVIDIA_API_KEY")),
    }


def _process_call(call_id: str, audio_path: Path, dual_channel: bool) -> None:
    """Background task: run the pipeline and keep JOBS[call_id] updated as it goes."""

    def on_stage(stage: str) -> None:
        now = time.monotonic()
        prev_stage = JOBS[call_id]["stage"]
        entered_at = JOBS[call_id].get("_stage_entered_at")
        # Real pipeline stages only — "queued" and "done" are bookkeeping states,
        # not stages with their own processing time to report.
        if entered_at is not None and prev_stage in ("transcribing", "diarizing", "analyzing"):
            JOBS[call_id]["stage_timings"][prev_stage] = round(now - entered_at, 3)

        JOBS[call_id]["stage"] = stage
        JOBS[call_id]["_stage_entered_at"] = now
        JOBS[call_id]["progress_pct"] = STAGE_PROGRESS.get(stage, JOBS[call_id]["progress_pct"])

    def on_progress(stage: str, fraction: float) -> None:
        job = JOBS[call_id]
        if job["stage"] != stage or stage not in STAGE_END:
            return
        start, end = STAGE_PROGRESS[stage], STAGE_END[stage]
        pct = min(start + int((end - start) * max(0.0, min(1.0, fraction))), end - 1)
        # Monotonic: never let the bar move backwards.
        if pct > job["progress_pct"]:
            job["progress_pct"] = pct

    try:
        with _PIPELINE_LOCK:
            result = run_pipeline(
                str(audio_path),
                dual_channel=dual_channel,
                on_stage=on_stage,
                on_progress=on_progress,
            )
        JOBS[call_id]["stage"] = "done"
        JOBS[call_id]["progress_pct"] = 100
        JOBS[call_id]["result"] = result
    except Exception as exc:  # noqa: BLE001 - surface any failure via the status endpoint
        logger.exception("Pipeline failed for call %s", call_id)
        JOBS[call_id]["stage"] = "failed"
        JOBS[call_id]["error"] = str(exc)
    finally:
        _persist_job(call_id)


@app.post("/calls")
async def create_call(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    dual_channel: bool = Form(False),
) -> Dict:
    call_id = str(uuid.uuid4())

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename or "").suffix or ".wav"
    audio_path = UPLOAD_DIR / f"{call_id}{suffix}"
    with audio_path.open("wb") as out_file:
        shutil.copyfileobj(file.file, out_file)
    await file.close()

    # Diarization would otherwise raise on a mono file only *after* the full ASR
    # pass (~40% progress, minutes in). sf.info reads the header only, so this
    # turns a slow silent failure into an immediate, actionable error.
    if dual_channel:
        try:
            channels = sf.info(str(audio_path)).channels
        except Exception as exc:
            audio_path.unlink(missing_ok=True)
            raise HTTPException(
                status_code=400, detail=f"Could not read the uploaded audio: {exc}"
            )
        if channels < 2:
            audio_path.unlink(missing_ok=True)
            raise HTTPException(
                status_code=400,
                detail=(
                    "dual_channel=true requires a stereo recording, but this file has "
                    f"{channels} channel(s)."
                ),
            )

    JOBS[call_id] = {
        "stage": "queued",
        "progress_pct": STAGE_PROGRESS["queued"],
        "result": None,
        "error": None,
        "created_at": time.time(),
        "stage_timings": {},
    }

    background_tasks.add_task(_process_call, call_id, audio_path, dual_channel)

    return {"call_id": call_id, "status": "processing"}


@app.get("/calls")
async def list_calls() -> Dict:
    """Finished calls only — enough for the frontend to merge into its
    compliance/coaching aggregates alongside its mock reference calls.

    Each item also carries stage_timings/created_at (dashboard-only metadata,
    not part of the pipeline's own result schema) so the frontend can report
    real per-stage processing time and order calls by recency without a second
    request per call."""
    calls = []
    for call_id, job in JOBS.items():
        _expire_if_stale(call_id, job)
        if job["stage"] == "done" and job["result"]:
            calls.append(
                {
                    **job["result"],
                    "stage_timings": job.get("stage_timings", {}),
                    "created_at": job.get("created_at"),
                }
            )
    calls.sort(key=lambda c: c.get("created_at") or 0, reverse=True)
    return {"calls": calls}


@app.get("/pipeline-info")
async def get_pipeline_info() -> Dict:
    """Which models are actually powering each stage right now — read from the
    real code/env rather than hardcoded, so this stays accurate if the model
    choice changes later."""
    stt_model_size = default_model_size()
    return {
        "stt": {"engine": "faster-whisper", "model": stt_model_size},
        "diarization": {"engine": "pyannote.audio", "model": DIARIZATION_MODEL},
        "recommendations": {
            "engine": "NVIDIA NIM",
            "model": RECOMMENDATION_MODEL,
            "configured": bool(os.environ.get("NVIDIA_API_KEY")),
        },
    }


def _expire_if_stale(call_id: str, job: Dict) -> None:
    """Fail a job that has been running past JOB_TIMEOUT_SEC.

    The pipeline runs in this process, so if it is OOM-killed or wedged there is
    nothing left to move the job off its last stage — without this the frontend
    polls a job that will never change for as long as the tab is open. Checked
    on read rather than by a background sweeper: nothing observes a stale job
    except a reader, so there is no reason to spend a task on it.
    """
    if job["stage"] in ("done", "failed"):
        return
    created_at = job.get("created_at")
    if created_at is None or time.time() - created_at <= JOB_TIMEOUT_SEC:
        return

    stalled_at = job["stage"]
    elapsed = round(time.time() - created_at)
    logger.error(
        "Call %s exceeded the %.0fs budget at stage %r", call_id, JOB_TIMEOUT_SEC, stalled_at
    )
    job["stage"] = "failed"
    job["error"] = (
        f"Processing stopped responding at the {stalled_at} stage after {elapsed}s "
        "(the backend may have run out of memory or been restarted). Please try again."
    )
    _persist_job(call_id)


@app.get("/calls/{call_id}/status")
async def get_call_status(call_id: str) -> Dict:
    job = JOBS.get(call_id)
    if job is None:
        raise HTTPException(status_code=404, detail="call_id not found")
    _expire_if_stale(call_id, job)

    response: Dict = {
        "call_id": call_id,
        "stage": job["stage"],
        "progress_pct": job["progress_pct"],
    }
    if job["stage"] == "failed":
        response["error"] = job["error"]
    return response


@app.get("/calls/{call_id}")
async def get_call_result(call_id: str) -> Dict:
    job = JOBS.get(call_id)
    if job is None:
        raise HTTPException(status_code=404, detail="call_id not found")
    _expire_if_stale(call_id, job)

    if job["stage"] == "failed":
        raise HTTPException(status_code=500, detail=f"Pipeline failed: {job['error']}")
    if job["stage"] != "done":
        raise HTTPException(status_code=409, detail=f"Call is still processing (stage={job['stage']})")

    return job["result"]
