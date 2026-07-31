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

## Tests

```bash
pytest
```

`tests/test_stage1_asr.py` transcribes whatever call recording it finds in
`sample_audio/` and checks the output shape. If that folder is empty it
skips (with a message) instead of failing — add a real recording there to
actually exercise it.
