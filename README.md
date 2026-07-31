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

Once the stages are implemented, run the pipeline against a call recording:

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

## Tests

```bash
pytest tests/
```
