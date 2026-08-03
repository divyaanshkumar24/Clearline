import { NextResponse } from "next/server";

// Server-side only — never exposed to the browser. Falls back to the local
// backend's default uvicorn port for development.
const BACKEND_API_URL = process.env.BACKEND_API_URL ?? "http://localhost:8000";

export async function POST(request: Request) {
  let incomingForm: FormData;
  try {
    incomingForm = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data with an audio file." }, { status: 400 });
  }

  const file = incomingForm.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "No audio file was provided." }, { status: 400 });
  }

  const outgoingForm = new FormData();
  const filename = file instanceof File ? file.name : "call.wav";
  outgoingForm.append("file", file, filename);

  const dualChannel = incomingForm.get("dual_channel");
  if (dualChannel != null) {
    outgoingForm.append("dual_channel", String(dualChannel));
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetch(`${BACKEND_API_URL}/calls`, {
      method: "POST",
      body: outgoingForm,
    });
  } catch {
    return NextResponse.json(
      { error: "Couldn't reach the analysis backend. Is it running?" },
      { status: 502 },
    );
  }

  const data = await backendResponse.json().catch(() => null);

  if (!backendResponse.ok) {
    return NextResponse.json(
      { error: data?.detail ?? "The backend rejected this call." },
      { status: backendResponse.status },
    );
  }

  return NextResponse.json(data);
}
