# Clearline Backend

Call-analysis pipeline: transcribe a call recording, identify speakers, and
generate recommendations/insights from the conversation.

## Project structure

```
clearline-backend/
  src/
    stage1_asr/            # Speech-to-text (faster-whisper)
    stage2_diarization/    # Speaker diarization (pyannote.audio)
    stage3_recommendations/# Insight/recommendation generation (NVIDIA NIM / Nemotron)
    pipeline.py            # Orchestrates the three stages end-to-end
  tests/                   # Unit tests + smoke_test.py
  sample_audio/            # Local sample call recordings for manual testing (gitignored)
  .env.example             # Template for required environment variables
  requirements.txt
```

Each `stageN_*` directory is a package for that pipeline stage. `pipeline.py`
wires them together and exposes the CLI entry point.

## Setup

Requires Python 3.11.

```bash
cd clearline-backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Copy the environment template and fill in real credentials:

```bash
cp .env.example .env
```

See `.env.example` for what each variable is and where to get it
(`HF_TOKEN` for Hugging Face model downloads, `NVIDIA_API_KEY` for the
NVIDIA NIM-hosted Nemotron model used for recommendations).

### Verify the install

```bash
python tests/smoke_test.py
```

This imports every core dependency (faster-whisper, pyannote.audio,
transformers, torch, ruptures, openai, python-dotenv, pytest, librosa,
soundfile) and reports pass/fail for each.

## Running the pipeline

Once all stages are implemented, run the full pipeline against a call recording:

```bash
source venv/bin/activate
python src/pipeline.py path/to/call.wav
```

`pipeline.py` loads `.env` automatically and will:
1. Transcribe the audio (`stage1_asr`)
2. Diarize speakers (`stage2_diarization`)
3. Generate recommendations from the transcript + speaker turns (`stage3_recommendations`)

Drop test recordings in `sample_audio/` for local manual testing (this
directory is gitignored).

### Stage 1 (ASR) standalone

Stage 1 (audio preprocessing + VAD + transcription) can be run on its own
without the rest of the pipeline:

```bash
python src/stage1_asr/run.py path/to/call.wav
python src/stage1_asr/run.py path/to/call.wav --model-size small --output out.json
```

It prints (or saves) JSON shaped like:

```json
{
  "call_id": "call",
  "segments": [
    {"start": 12.4, "end": 15.8, "text": "..."}
  ]
}
```

Internally it: resamples the audio to 16kHz mono (`audio_preprocessing.py`),
runs Silero VAD (loaded via `torch.hub`) to find speech regions and drop
silence (`vad.py`), then runs faster-whisper on each speech region
individually rather than on one concatenated/VAD-trimmed buffer — see the
docstring in `transcribe.py` for why (avoids splice artifacts at segment
boundaries and keeps timestamp math exact).

The first run downloads the Silero VAD repo (via `torch.hub`, cached under
`~/.cache/torch/hub`) and the faster-whisper model weights (cached under
`~/.cache/huggingface`), so it's much slower than subsequent runs. Setting
`HF_TOKEN` in `.env` avoids Hugging Face Hub rate limiting on that first
download.

### Stage 2 (diarization + roles) standalone

Stage 2 assigns each Stage 1 transcript segment a speaker, then maps the
anonymous speaker labels to "agent"/"client":

```bash
# Re-runs Stage 1 itself, then diarizes + assigns roles:
python src/stage2_diarization/run.py path/to/call.wav

# Or reuse a Stage 1 JSON you already produced:
python src/stage2_diarization/run.py path/to/call.wav --asr-json stage1_out.json

# If the recording is stereo with channel 0 = agent, channel 1 = client, skip
# diarization entirely and split by channel instead:
python src/stage2_diarization/run.py path/to/call.wav --dual-channel
```

Output shape:

```json
{
  "call_id": "call",
  "segments": [
    {"start": 12.4, "end": 15.8, "text": "...", "speaker": "agent"}
  ]
}
```

- `diarize_call()` (`diarization.py`) loads `pyannote/speaker-diarization-3.1`
  using `HF_TOKEN` from `.env`. This model is gated — beyond setting the
  token, you must accept its terms (and its dependency,
  `pyannote/segmentation-3.0`) on Hugging Face while logged in as the token's
  account. If the token is missing or the terms haven't been accepted,
  `diarize_call()` raises a `RuntimeError` naming both model pages to visit.
- `merge_transcript_with_speakers()` (`merge.py`) assigns each transcript
  segment whichever diarized speaker overlaps it the most in time.
- `assign_roles()` (`roles.py`) maps `SPEAKER_00`/`SPEAKER_01` to
  `agent`/`client` by scoring each speaker's first 3 segments against an
  editable keyword list (`AGENT_PHRASES` in `roles.py`) — phrases like "thank
  you for calling" or "my name is" score toward "agent". Segments already
  labeled `agent`/`client` (dual-channel mode) pass through unchanged.
- Dual-channel mode skips diarization and pyannote/`HF_TOKEN` entirely — it
  runs Stage 1's Silero VAD independently on each channel and labels channel 0
  "agent", channel 1 "client" directly.

### Stage 3 (sentiment, emotion, pivot, recommendation) standalone

Stage 3 takes a Stage 2 output and produces a sentiment trajectory, emotion
tags, a detected pivot point, and an LLM-generated coaching recommendation:

```bash
python src/stage3_recommendations/run.py stage2_out.json
python src/stage3_recommendations/run.py stage2_out.json --output stage3_out.json
```

Output shape:

```json
{
  "call_id": "call",
  "sentiment_trajectory": [
    {"start": 5.7, "end": 11.06, "text": "...", "label": "negative", "confidence": 0.75, "score": -0.75}
  ],
  "emotion_tags": [
    {"start": 5.7, "end": 11.06, "text": "...", "emotion": "neutral", "confidence": 0.84}
  ],
  "pivot_point": {"turn_index": 2, "timestamp": 25.9, "description": "sentiment dropped from 0.87 to -0.93"},
  "recommendation": {
    "what_went_wrong": "...",
    "root_cause": "...",
    "repair_suggestion": "..."
  },
  "criterion_scores": [
    {
      "criterionId": "no_guaranteed_returns",
      "label": "fail",
      "confidence": 0.95,
      "evidenceTs": 43.5,
      "evidenceQuote": "you're guaranteed to see at least eight percent a year",
      "rationale": "Agent guaranteed a specific return percentage."
    }
  ],
  "coaching_findings": [
    {
      "id": "cf3407e1-ccb3-47a0-963a-6a67b590cd08",
      "type": "Jargon-heavy explanation",
      "ts": 18.5,
      "quote": "a mix of large cap equities and investment grade bonds",
      "suggestion": "Simplify technical terms for client understanding.",
      "severity": "minor"
    }
  ]
}
```

`criterion_scores` and `coaching_findings` use **camelCase** keys (not this
project's usual snake_case) — they match the Clearline frontend's
`lib/types.ts` `CriterionScore`/`CoachingFinding` interfaces exactly, so the
frontend can consume this JSON with no transformation layer.

- `score_sentiment()` (`sentiment.py`) scores every **client** segment with
  `cardiffnlp/twitter-roberta-base-sentiment-latest` and reduces label +
  confidence to a single signed number in `[-1, 1]` (positive=+1,
  neutral=0, negative=-1, scaled by confidence) — the `sentiment_trajectory`.
- `tag_emotions()` (`emotion.py`) tags each client segment with its top
  `SamLowe/roberta-base-go_emotions` label.
- `detect_pivot()` (`pivot.py`) runs `ruptures`' PELT change-point algorithm
  (`model="l2", min_size=2, jump=1` — `jump=1` matters: ruptures' default
  `jump=5` only considers every 5th index as a candidate breakpoint, which
  silently misses everything on the short per-call sequences this operates
  on) over the sentiment score sequence, and picks whichever detected
  breakpoint has the most negative before/after mean shift. Returns
  `{"turn_index": null, "description": "no clear pivot detected"}` — not an
  error — when no breakpoint is found or no shift is negative (e.g. sentiment
  stayed flat, or only rose).
- `generate_recommendation()` (`recommendation.py`) sends the full
  speaker-tagged transcript + sentiment trajectory + emotion tags + pivot
  point to an NVIDIA NIM-hosted Nemotron model
  (`nvidia/nemotron-3-super-120b-a12b` by default, `NVIDIA_API_KEY`
  from `.env`) via NVIDIA's OpenAI-compatible chat completions API, forcing
  a `submit_call_analysis` tool/function call so the reply is
  schema-conforming JSON rather than parsed free text (if the model ignores
  `tool_choice` and answers in plain text anyway, that text is still parsed
  as JSON before giving up). Retries once on failure, on malformed JSON, or
  on a response missing a required field; raises a clear `RuntimeError` if
  the key is missing or rejected.
- `generate_compliance_scoring()` (`compliance.py`) — a **separate** forced
  tool call (not folded into `generate_recommendation()`; see the trade-off
  note in `compliance.py`'s module docstring) that scores the call against 8
  fixed compliance criteria (`COMPLIANCE_CRITERIA` — recording disclosure,
  risk disclosure, fee disclosure, two suitability criteria, no-guaranteed-returns,
  no-pressure, fair-and-balanced; edit that list to change them) and extracts
  coaching findings (`FINDING_TYPES` enum). Every `evidenceQuote`/`quote` is
  validated as a real, verbatim (whitespace-normalized) substring of the
  transcript after the model responds — hallucinated quotes are never passed
  through. `evidenceTs`/`ts` are never trusted from the model at all: once a
  quote is matched to a segment, the timestamp is always overwritten with
  that segment's real `start`, making timestamp correctness a code-enforced
  invariant rather than something asked of the model. If some items fail
  grounding, the whole call retries once with corrective feedback naming the
  bad quotes; items still ungrounded after that are dropped (not the whole
  response) rather than failing the call.
- `analyze_call()` (`analyze.py`) runs all of the above and returns the full
  Stage 3 schema shown here.

## Evaluation harness

`src/evaluate.py` runs the full pipeline over every audio file in
`sample_audio/` and writes a markdown quality-summary table:

```bash
python -m src.evaluate
python -m src.evaluate --sample-audio-dir some/other/dir --output some/table.md
```

For each call it reports: transcript word count, number of speakers detected,
whether a pivot point was found, and the recommendation's `repair_suggestion`
(truncated to one line). If a file `<call_id>_reference.txt` exists next to
the audio (e.g. `sample_audio/call_042_reference.txt` for `call_042.wav`),
it's treated as a manually-transcribed reference transcript and word error
rate (via `jiwer`, after lowercasing/punctuation-stripping both sides) is
added to that row. Calls without a reference get `—` in the WER column, and
the table's final line explicitly lists which `call_id`s that applies to —
so a missing reference reads as "not covered yet," never as a silent zero.
A call that fails partway through the pipeline gets an `ERROR` row (with the
error message) rather than aborting the rest of the evaluation.

Output is saved to `outputs/evaluation_summary.md` by default (gitignored,
same as `outputs/<call_id>.json` from the pipeline CLI).

## Web API (`src/api.py`)

A FastAPI service exposing the pipeline over HTTP for the Next.js frontend
(CORS is enabled for `http://localhost:3000`):

```bash
uvicorn src.api:app --reload
```

| Endpoint | Method | Description |
|---|---|---|
| `/calls` | `POST` | Multipart upload (`file`, optional `dual_channel` form field). Saves the audio to `uploads/`, starts the pipeline as a background task, returns `{"call_id", "status": "processing"}` immediately. With `dual_channel=true` the channel count is checked up front and a mono file is rejected with `400` — otherwise diarization would only fail after the full ASR pass. |
| `/calls/{call_id}/status` | `GET` | `{"call_id", "stage", "progress_pct"}` — `stage` is one of `queued` / `transcribing` / `diarizing` / `analyzing` / `done` / `failed` (with an `error` field when failed). |
| `/calls/{call_id}` | `GET` | Once `stage == "done"`, the full combined report (same schema `run_pipeline()` returns). `409` while still processing, `500` if the pipeline failed, `404` for an unknown `call_id`. |

Jobs are tracked in an in-process dict (`JOBS` in `api.py`) — no external queue
or database, which is fine at this scale but means job state doesn't survive
a server restart and won't work across multiple worker processes.

`run_pipeline()` (`pipeline.py`) takes an optional `on_stage(stage: str)`
callback, invoked as `"transcribing"` → `"diarizing"` → `"analyzing"` →
`"done"` starts; `api.py` uses it to keep each job's `stage`/`progress_pct`
current. `progress_pct` is a fixed value per stage-start
(`transcribing`→0, `diarizing`→40, `analyzing`→70, `done`→100), not a
continuous measurement within a stage.

**NVIDIA API key:** `NVIDIA_API_KEY` is required for Stage 3's recommendation
call — there is no other LLM provider wired in. ASR (Stage 1) and diarization
(Stage 2) are unaffected and keep using local open-source models regardless.

## Tests

```bash
pytest
```

`tests/test_stage1_asr.py` and the end-to-end cases in
`tests/test_stage2_diarization.py` / `tests/test_stage3_recommendations.py` /
`tests/test_pipeline.py` / `tests/test_api.py` transcribe/diarize/analyze/
run/serve whatever call recording they find in `sample_audio/`. If that
folder is empty, `HF_TOKEN` isn't set, or `NVIDIA_API_KEY` isn't set, they
skip (with a message) instead of failing — add a real recording and/or set
those keys to actually exercise them. Everything else — merge/role-assignment
logic, sentiment/emotion scoring, pivot detection, the Stage 3 recommendation
call (mocked), the pipeline's silent-audio error path (runs for real),
`evaluate.py`'s table rendering/WER logic (mocked pipeline), and the API's
404 handling — runs against synthetic data and needs none of that.

`tests/test_compliance.py` is the exception: its evidence-grounding checks
only mean something against a real model (a mock would trivially satisfy
"quote is verbatim" by construction), so its end-to-end test calls the real
NVIDIA API whenever `NVIDIA_API_KEY` is set — skipping otherwise — against a
hand-authored financial-advisory transcript (not audio-dependent, since
compliance scoring operates on transcript text, not audio). Its unit tests
for the validation/retry/timestamp-correction logic itself are mocked and
always run.
