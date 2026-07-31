/**
 * Client-side audio normalization for the New call flow.
 *
 * The backend's Stage 1 ASR loads audio via `soundfile` (libsndfile), which does
 * not decode WebM/Opus (MediaRecorder's typical browser output) or M4A/AAC at all,
 * and only decodes MP3 on newer libsndfile builds. Rather than gate what formats
 * are "safe" to upload, every file — recorded or picked from disk — is decoded in
 * the browser (via the same Web Audio API this screen already needs for the level
 * meter) and re-encoded as a plain 16-bit PCM WAV before it ever reaches the
 * network. This guarantees the backend can always read it, and downsampling to
 * the backend's own target rate here also keeps the upload small regardless of
 * the source file's original quality/format.
 */

export const TARGET_SAMPLE_RATE = 16000;

function getAudioContextCtor(): typeof AudioContext {
  const ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!ctor) {
    throw new Error("This browser does not support the Web Audio API.");
  }
  return ctor;
}

function encodeWavMono16(buffer: AudioBuffer): Blob {
  const samples = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // format = PCM
  view.setUint16(22, 1, true); // channels = mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true); // byte rate
  view.setUint16(32, bytesPerSample, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += bytesPerSample;
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

/**
 * Decode any browser-playable audio blob and re-encode it as mono 16kHz PCM WAV.
 * Throws if the browser can't decode the input (corrupt file, unsupported codec).
 */
export async function prepareAudioForUpload(input: Blob): Promise<Blob> {
  const arrayBuffer = await input.arrayBuffer();
  const AudioContextCtor = getAudioContextCtor();
  const decodeCtx = new AudioContextCtor();
  let decoded: AudioBuffer;
  try {
    decoded = await decodeCtx.decodeAudioData(arrayBuffer);
  } finally {
    void decodeCtx.close();
  }

  const frameCount = Math.max(1, Math.ceil(decoded.duration * TARGET_SAMPLE_RATE));
  const offlineCtx = new OfflineAudioContext(1, frameCount, TARGET_SAMPLE_RATE);
  const source = offlineCtx.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineCtx.destination);
  source.start();
  const rendered = await offlineCtx.startRendering();

  return encodeWavMono16(rendered);
}

export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}
