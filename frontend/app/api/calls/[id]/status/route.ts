import { NextResponse } from "next/server";

// Server-side only — never exposed to the browser. Falls back to the local
// backend's default uvicorn port for development.
const BACKEND_API_URL = process.env.BACKEND_API_URL ?? "http://localhost:8000";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let backendResponse: Response;
  try {
    backendResponse = await fetch(`${BACKEND_API_URL}/calls/${encodeURIComponent(id)}/status`);
  } catch {
    return NextResponse.json(
      { error: "Couldn't reach the analysis backend. Is it running?" },
      { status: 502 },
    );
  }

  const data = await backendResponse.json().catch(() => null);

  if (!backendResponse.ok) {
    return NextResponse.json(
      { error: data?.detail ?? "The backend couldn't return a status for this call." },
      { status: backendResponse.status },
    );
  }

  return NextResponse.json(data);
}
