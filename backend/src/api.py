"""FastAPI web service exposing the Clearline pipeline to the Next.js frontend.

Run with:
    uvicorn src.api:app --reload
"""

import shutil
import uuid
from pathlib import Path
from typing import Dict, Optional

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .pipeline import run_pipeline

PROJECT_ROOT = Path(__file__).resolve().parent.parent
UPLOAD_DIR = PROJECT_ROOT / "uploads"

# Progress reported at the *start* of each stage — i.e. this much of the call
# is already done by the time that stage begins.
STAGE_PROGRESS = {
    "queued": 0,
    "transcribing": 0,
    "diarizing": 40,
    "analyzing": 70,
    "done": 100,
}

# call_id -> {"stage", "progress_pct", "result", "error"}
JOBS: Dict[str, Dict] = {}

app = FastAPI(title="Clearline Pipeline API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _process_call(call_id: str, audio_path: Path, dual_channel: bool) -> None:
    """Background task: run the pipeline and keep JOBS[call_id] updated as it goes."""

    def on_stage(stage: str) -> None:
        JOBS[call_id]["stage"] = stage
        JOBS[call_id]["progress_pct"] = STAGE_PROGRESS.get(stage, JOBS[call_id]["progress_pct"])

    try:
        result = run_pipeline(str(audio_path), dual_channel=dual_channel, on_stage=on_stage)
        JOBS[call_id]["stage"] = "done"
        JOBS[call_id]["progress_pct"] = 100
        JOBS[call_id]["result"] = result
    except Exception as exc:  # noqa: BLE001 - surface any failure via the status endpoint
        JOBS[call_id]["stage"] = "failed"
        JOBS[call_id]["error"] = str(exc)


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

    JOBS[call_id] = {
        "stage": "queued",
        "progress_pct": STAGE_PROGRESS["queued"],
        "result": None,
        "error": None,
    }

    background_tasks.add_task(_process_call, call_id, audio_path, dual_channel)

    return {"call_id": call_id, "status": "processing"}


@app.get("/calls/{call_id}/status")
async def get_call_status(call_id: str) -> Dict:
    job = JOBS.get(call_id)
    if job is None:
        raise HTTPException(status_code=404, detail="call_id not found")

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

    if job["stage"] == "failed":
        raise HTTPException(status_code=500, detail=f"Pipeline failed: {job['error']}")
    if job["stage"] != "done":
        raise HTTPException(status_code=409, detail=f"Call is still processing (stage={job['stage']})")

    return job["result"]
