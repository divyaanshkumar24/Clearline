# Clearline Backend

Call-analysis pipeline: transcribe a call recording, identify speakers, and
generate recommendations/insights from the conversation.

## Project structure

```
clearline-backend/
  src/
    stage1_asr/            # Speech-to-text (faster-whisper)
    stage2_diarization/    # Speaker diarization (pyannote.audio)
    stage3_recommendations/# Insight/recommendation generation (Anthropic API)
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
(`HF_TOKEN` for Hugging Face model downloads, `ANTHROPIC_API_KEY` for Claude).

### Verify the install

```bash
python tests/smoke_test.py
```

This imports every core dependency (faster-whisper, pyannote.audio,
transformers, torch, ruptures, anthropic, python-dotenv, pytest, librosa,
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

## Tests

```bash
pytest
```

`tests/test_stage1_asr.py` and the end-to-end case in
`tests/test_stage2_diarization.py` transcribe/diarize whatever call recording
they find in `sample_audio/`. If that folder is empty, or `HF_TOKEN` isn't
set, they skip (with a message) instead of failing — add a real recording
and/or set `HF_TOKEN` to actually exercise them. The rest of
`test_stage2_diarization.py` (merge + role-assignment logic) runs against
synthetic data and needs neither.
