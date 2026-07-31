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
┌─────────────────────┐   HF sentiment/emotion models + ruptures + Claude
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
**Output:** `{"call_id", "sentiment_trajectory", "emotion_tags", "pivot_point", "recommendation"}`

Steps, run only over the **client's** segments (Parts A/B) or their derived
values (Part C), plus the full transcript (Part D):

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
   sentiment trajectory, the emotion tags, and the pivot point to **Claude**
   (`claude-opus-5`, `ANTHROPIC_API_KEY` from `.env`), forcing a
   `submit_call_analysis` tool call (`strict: true`) so the reply is
   guaranteed-valid JSON rather than parsed free text. Retries once on
   failure; raises a clear error if the key is missing or rejected.

**Models:** `cardiffnlp/twitter-roberta-base-sentiment-latest`,
`SamLowe/roberta-base-go_emotions` (both local, no API key), `ruptures` (pure
algorithm, no model), Claude `claude-opus-5` (via the `anthropic` SDK,
requires `ANTHROPIC_API_KEY`).

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
  "recommendation": {"what_went_wrong": "...", "root_cause": "...", "repair_suggestion": "..."}
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
