# Clearline Backend — Architecture

Clearline turns a raw call recording into a structured coaching report: a
transcript with speaker labels, a sentiment/emotion trajectory for the client's
side of the call, the point where things went sideways (if any), and an
LLM-written recommendation. The pipeline is three sequential stages, each in
its own package under `src/`, wired together by `src/pipeline.py`.

```
audio file
    │
    ▼
┌─────────────────────┐   faster-whisper + Silero VAD
│  Stage 1 — ASR       │   src/stage1_asr/
└─────────────────────┘
    │  {call_id, segments: [{start, end, text}]}
    ▼
┌─────────────────────┐   pyannote.audio (or dual-channel split)
│  Stage 2 — Diarize   │   src/stage2_diarization/
└─────────────────────┘
    │  {call_id, segments: [{start, end, text, speaker: "agent"|"client"}]}
    ▼
┌─────────────────────┐   HF sentiment/emotion models + ruptures + NVIDIA NIM (Nemotron)
│  Stage 3 — Analyze   │   src/stage3_recommendations/
└─────────────────────┘
    │
    ▼
final report (see schema below)
```

## Stage 1 — ASR (`src/stage1_asr/`)

**Input:** path to a call recording (any format `soundfile` can decode).
**Output:** `{"call_id": str, "segments": [{"start": float, "end": float, "text": str}]}`

Steps, in order:

1. **`audio_preprocessing.py`** — loads the file and resamples/downmixes to
   16kHz mono only if it isn't already (no wasted resampling on already-correct
   audio).
2. **`vad.py`** — **Silero VAD**, loaded via `torch.hub` (cached under
   `~/.cache/torch/hub`), finds speech regions and drops silence.
3. **`transcribe.py`** — **faster-whisper** (`medium` by default, configurable)
   transcribes each Silero-detected speech region *individually*, offsetting
   its timestamps back into the original timeline. This is deliberate: running
   Whisper on one concatenated/VAD-trimmed buffer instead would introduce
   audio discontinuities at every splice point that can produce hallucinated
   or garbled text right at those seams, and would require reconstructing a
   trimmed-time → original-time mapping to get timestamps back. Per-segment
   transcription against the untouched original audio avoids both, at the
   cost of one Whisper call per speech region instead of one for the whole
   file.

**Models:** Silero VAD (`snakers4/silero-vad`, via `torch.hub`); faster-whisper
`medium` (via CTranslate2/Hugging Face Hub, cached under `~/.cache/huggingface`).
Neither requires an API key, though `HF_TOKEN` avoids Hub rate limiting on the
first download.

## Stage 2 — Diarization (`src/stage2_diarization/`)

**Input:** Stage 1's output + the same audio file.
**Output:** `{"call_id": str, "segments": [{"start", "end", "text", "speaker": "agent"|"client"}]}`

Steps:

1. **`diarization.py`** — `diarize_call()` loads **`pyannote/speaker-diarization-3.1`**
   using `HF_TOKEN` and returns raw speaker turns (`SPEAKER_00`, `SPEAKER_01`, ...).
   This model is gated on Hugging Face — the token alone isn't enough; the
   token's account must also accept the model's terms (and its dependency,
   `pyannote/segmentation-3.0`). Missing/rejected access raises a `RuntimeError`
   naming both pages to visit.
   - **Dual-channel mode** (`dual_channel=True`) bypasses this entirely: if the
     recording is stereo with channel 0 always the agent and channel 1 always
     the client, it reuses Stage 1's Silero VAD independently on each channel
     and labels the result "agent"/"client" directly — no pyannote, no
     `HF_TOKEN` needed.
2. **`merge.py`** — `merge_transcript_with_speakers()` assigns each Stage 1
   transcript segment whichever diarized speaker turn overlaps it the most in
   time.
3. **`roles.py`** — `assign_roles()` maps the anonymous `SPEAKER_00`/`SPEAKER_01`
   labels to `"agent"`/`"client"` by scoring each speaker's first 3 segments
   against an editable keyword list (`AGENT_PHRASES`) — phrases like "thank you
   for calling" or "my name is" score toward "agent". Segments already labeled
   `"agent"`/`"client"` (dual-channel mode) pass through unchanged, since
   there's nothing left to infer.

**Model:** `pyannote/speaker-diarization-3.1` (gated, requires `HF_TOKEN` +
accepted terms) — skipped entirely in dual-channel mode.

## Stage 3 — Recommendations (`src/stage3_recommendations/`)

**Input:** Stage 2's speaker-tagged segments.
**Output:** `{"call_id", "sentiment_trajectory", "emotion_tags", "pivot_point", "recommendation", "criterion_scores", "coaching_findings"}`

Steps, run only over the **client's** segments (Parts A/B) or their derived
values (Part C), plus the full transcript (Parts D/F):

1. **`sentiment.py`** — **`cardiffnlp/twitter-roberta-base-sentiment-latest`**
   scores each client segment negative/neutral/positive + confidence, reduced
   to one signed number in `[-1, 1]` (positive=+1, neutral=0, negative=-1,
   scaled by confidence) so it can be plotted as a trajectory.
2. **`emotion.py`** — **`SamLowe/roberta-base-go_emotions`** tags each client
   segment with its single top-confidence emotion label.
3. **`pivot.py`** — runs **`ruptures`' PELT** change-point algorithm
   (`model="l2", min_size=2, jump=1`) over the sentiment score sequence and
   picks whichever detected breakpoint has the most negative before/after
   mean shift. `jump=1` is required: ruptures' default (`jump=5`) only
   considers every 5th index as a candidate breakpoint, which silently misses
   almost everything on the short (a handful of client turns) sequences a
   single call produces. Returns `{"turn_index": null, "description": "no
   clear pivot detected"}` — not an error — when no breakpoint is found or
   every shift is flat/positive.
4. **`recommendation.py`** — sends the full speaker-tagged transcript, the
   sentiment trajectory, the emotion tags, and the pivot point to an
   **NVIDIA NIM-hosted Nemotron model** (`nvidia/nemotron-3-super-120b-a12b`
   by default, `NVIDIA_API_KEY` from `.env`) via NVIDIA's OpenAI-compatible
   chat completions API, forcing a `submit_call_analysis` tool/function call
   so the reply is schema-conforming JSON rather than parsed free text (a
   plain-text fallback still attempts to parse the response as JSON if the
   model ignores `tool_choice`). Retries once on failure, malformed JSON, or
   a response missing a required field; raises a clear error if the key is
   missing or rejected.
5. **`compliance.py`** — a **second, separate** forced tool call (deliberately
   not folded into `recommendation.py`'s call — smaller single-purpose
   schemas are more reliable on an open model, and it isolates this call's
   strict evidence-grounding retry from the already-reliable recommendation
   call) that scores the transcript against 8 fixed compliance criteria
   (`COMPLIANCE_CRITERIA`) and extracts coaching findings (`FINDING_TYPES`).
   Output matches the Clearline frontend's `lib/types.ts` `CriterionScore` /
   `CoachingFinding` interfaces exactly — **camelCase** field names
   (`criterionId`, `evidenceTs`, `evidenceQuote`, etc.), unlike this
   project's usual snake_case, so the frontend can consume it with no
   transformation. Every `evidenceQuote`/`quote` is validated as a real,
   verbatim (whitespace-normalized) substring of the transcript after the
   model responds; `evidenceTs`/`ts` is never trusted from the model at all —
   once a quote is matched to a segment, the timestamp is always overwritten
   with that segment's real `start`. Ungrounded items trigger one retry with
   corrective feedback naming the bad quotes; items still ungrounded after
   that are dropped individually rather than failing the whole call.

**Models:** `cardiffnlp/twitter-roberta-base-sentiment-latest`,
`SamLowe/roberta-base-go_emotions` (both local, no API key), `ruptures` (pure
algorithm, no model), `nvidia/nemotron-3-super-120b-a12b` (via the
`openai` SDK pointed at NVIDIA's OpenAI-compatible endpoint, requires
`NVIDIA_API_KEY`) for both the recommendation and compliance-scoring calls.

## Orchestration (`src/pipeline.py`)

`run_pipeline(audio_path, dual_channel=False)` chains all three stages and
merges their outputs into one final report:

```json
{
  "call_id": "...",
  "segments": [{"start": 12.4, "end": 15.8, "text": "...", "speaker": "agent"}],
  "sentiment_trajectory": [{"start": 5.7, "end": 11.0, "text": "...", "label": "negative", "confidence": 0.75, "score": -0.75}],
  "emotion_tags": [{"start": 5.7, "end": 11.0, "text": "...", "emotion": "neutral", "confidence": 0.84}],
  "pivot_point": {"turn_index": 2, "timestamp": 25.9, "description": "sentiment dropped from 0.87 to -0.93"},
  "recommendation": {"what_went_wrong": "...", "root_cause": "...", "repair_suggestion": "..."},
  "criterion_scores": [{"criterionId": "no_guaranteed_returns", "label": "fail", "confidence": 0.95, "evidenceTs": 43.5, "evidenceQuote": "...", "rationale": "..."}],
  "coaching_findings": [{"id": "...", "type": "Jargon-heavy explanation", "ts": 18.5, "quote": "...", "suggestion": "...", "severity": "minor"}]
}
```

Error handling at each stage boundary:

- **Empty transcript (Stage 1):** if `transcribe_call()` returns zero
  segments (silent, corrupted, or too-short audio), the pipeline raises
  immediately rather than running diarization/analysis on nothing.
- **Diarization finds fewer than 2 speakers:** a common real-world failure
  mode (background noise confusing the model, a one-sided recording, etc.).
  Rather than letting `assign_roles()`'s "exactly 2 speakers" check crash the
  run, the pipeline logs a warning and proceeds with the raw diarization
  labels unassigned. Stage 3's client-only analysis (`sentiment_trajectory`,
  `emotion_tags`) comes back empty for that call, but `recommendation` still
  runs over the full transcript.

CLI: `python -m src.pipeline <audio_file> [--dual-channel] [--output-dir outputs]`
saves the full JSON report to `outputs/<call_id>.json` and prints a short
summary (call ID, pivot timestamp, one-line recommendation) to the console.

`run_pipeline()` also accepts an optional `on_stage(stage: str)` callback,
invoked as `"transcribing"` → `"diarizing"` → `"analyzing"` → `"done"` start —
the hook `src/api.py` uses to report progress without the pipeline knowing
anything about HTTP.

## Web API (`src/api.py`)

A thin FastAPI layer over the same `run_pipeline()`, for the Next.js
frontend: `POST /calls` (multipart upload) kicks off the pipeline as a
background task and returns a `call_id` immediately; `GET
/calls/{call_id}/status` reports `stage`/`progress_pct`; `GET
/calls/{call_id}` returns the full report once `stage == "done"`. Job state
lives in an in-process dict — no queue, no database, fine at this scale but
gone on restart and not shared across worker processes. See the README's
"Web API" section for the endpoint table and run command.

## LLM provider: NVIDIA NIM

Both of Stage 3's LLM calls (`generate_recommendation()` and
`generate_compliance_scoring()`) run entirely on NVIDIA NIM — there is no
Anthropic/Claude dependency anywhere in this project anymore. `NVIDIA_API_KEY`
is required for both to work; ASR (Stage 1) and diarization (Stage 2) are
unaffected and keep using local open-source models regardless.

Model availability is the fragile part of this stack. NVIDIA retires models
and enables them per account, so a model that is *listed* by `models.list()`
may still fail when called:

- `nvidia/llama-3.1-nemotron-70b-instruct` returned 404 ("Function ... Not
  found for account") under this project's key.
- `nvidia/llama-3.3-nemotron-super-49b-v1` returned **410 Gone** — end of life
  2026-08-26.
- `nvidia/nemotron-3-super-120b-a12b` is the current default, verified with real
  calls including forced tool-calling (~5s).

Set `NVIDIA_MODEL` in `.env` to override the default without a code change. If
calls start failing with 404/410, list what your key can use, then re-verify
forced tool-calling on the replacement before relying on it.
