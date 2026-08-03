# Clearline

AI-assisted call compliance auditing and coaching: record or upload a call,
run it through a speech-to-text → diarization → AI-recommendation pipeline,
and land on a compliance/coaching report.

This repo combines the two projects that previously lived in separate
repositories (`Clearline_BaseProject` and `clearline-backend`) into one, each
kept in its own subdirectory with full original commit history preserved:

```
Clearline/
  frontend/   Next.js app (App Router, TypeScript, Tailwind v4, shadcn/ui)
  backend/    Python/FastAPI call-analysis pipeline (ASR, diarization, LLM recommendations)
```

## Running locally

The two sides talk over HTTP — the frontend proxies requests to the backend
via `BACKEND_API_URL`, so each runs independently:

**Backend** (`backend/`):

```bash
cd backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in HF_TOKEN / NVIDIA_API_KEY
uvicorn src.api:app --reload   # http://localhost:8000
```

**Frontend** (`frontend/`):

```bash
cd frontend
npm install
cp .env.local.example .env.local   # BACKEND_API_URL defaults to http://localhost:8000
npm run dev   # http://localhost:3000
```

See `backend/README.md` and `backend/ARCHITECTURE.md` for pipeline details,
and `frontend/README.md` for the frontend's screens and stack.
