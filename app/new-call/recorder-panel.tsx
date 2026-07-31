"use client";

import * as React from "react";
import { Loader2, Mic, RotateCcw, Square, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { prepareAudioForUpload, formatDuration } from "@/lib/audio";
import { cn } from "@/lib/utils";

type Phase = "idle" | "requesting" | "recording" | "processing" | "ready" | "denied" | "error";

const PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

function pickSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return PREFERRED_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

export function RecorderPanel({
  onReady,
  onRequestUploadTab,
}: {
  onReady: (file: File | null) => void;
  onRequestUploadTab: () => void;
}) {
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [elapsedSec, setElapsedSec] = React.useState(0);
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const streamRef = React.useRef<MediaStream | null>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = React.useRef<number>(0);
  const levelBarRef = React.useRef<HTMLDivElement | null>(null);
  const audioUrlRef = React.useRef<string | null>(null);

  const stopMeter = React.useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    analyserRef.current = null;
    if (audioCtxRef.current) {
      void audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
  }, []);

  const releaseStream = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  // Cleanup on unmount: stop any live mic stream/analyser and free the object URL.
  React.useEffect(() => {
    return () => {
      stopMeter();
      releaseStream();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, [stopMeter, releaseStream]);

  const runLevelMeter = React.useCallback((stream: MediaStream) => {
    const AudioContextCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    const audioCtx = new AudioContextCtor();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    audioCtxRef.current = audioCtx;
    analyserRef.current = analyser;

    const data = new Uint8Array(analyser.fftSize);
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sumSquares = 0;
      for (let i = 0; i < data.length; i++) {
        const normalized = (data[i] - 128) / 128;
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / data.length);
      // Speech RMS rarely approaches 1.0 — gain it up so normal talking volume
      // visibly moves the bar, not just clipping peaks.
      const level = Math.min(1, rms * 4.5);
      if (levelBarRef.current) {
        levelBarRef.current.style.transform = `scaleX(${level})`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const startRecording = React.useCallback(async () => {
    setErrorMessage(null);
    setPhase("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = pickSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        stopMeter();
        releaseStream();
        const rawBlob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setPhase("processing");
        try {
          const wavBlob = await prepareAudioForUpload(rawBlob);
          const url = URL.createObjectURL(wavBlob);
          audioUrlRef.current = url;
          setAudioUrl(url);
          setPhase("ready");
          onReady(new File([wavBlob], "recording.wav", { type: "audio/wav" }));
        } catch {
          setPhase("error");
          setErrorMessage("Could not process the recording. Please try again.");
          onReady(null);
        }
      };

      recorderRef.current = recorder;
      recorder.start();
      startedAtRef.current = performance.now();
      setElapsedSec(0);
      timerRef.current = setInterval(() => {
        setElapsedSec(Math.floor((performance.now() - startedAtRef.current) / 1000));
      }, 1000);
      runLevelMeter(stream);
      setPhase("recording");
    } catch {
      setPhase("denied");
    }
  }, [onReady, releaseStream, runLevelMeter, stopMeter]);

  const stopRecording = React.useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  const reRecord = React.useCallback(() => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setAudioUrl(null);
    setErrorMessage(null);
    setElapsedSec(0);
    onReady(null);
    setPhase("idle");
  }, [onReady]);

  if (phase === "denied") {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <Alert variant="destructive" className="max-w-md text-left">
          <TriangleAlert />
          <AlertTitle>Microphone access denied</AlertTitle>
          <AlertDescription>
            Clearline needs microphone permission to record. Allow access in your browser&apos;s
            site settings and try again, or use the Upload tab instead.
          </AlertDescription>
        </Alert>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPhase("idle")}>
            Try again
          </Button>
          <Button size="sm" onClick={onRequestUploadTab}>
            Switch to Upload
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <Alert variant="destructive" className="max-w-md text-left">
          <TriangleAlert />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
        <Button variant="outline" size="sm" onClick={reRecord}>
          <RotateCcw /> Try again
        </Button>
      </div>
    );
  }

  if (phase === "ready" && audioUrl) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="flex size-12 items-center justify-center rounded-full bg-status-good/10 text-status-good-fg">
          <Mic className="size-5" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">Recording captured</p>
          <p className="text-[13px] text-muted-foreground">
            {formatDuration(elapsedSec)} · ready to review
          </p>
        </div>
        <audio controls src={audioUrl} className="w-full max-w-sm" />
        <Button variant="outline" size="sm" onClick={reRecord}>
          <RotateCcw /> Re-record
        </Button>
      </div>
    );
  }

  if (phase === "recording") {
    return (
      <div className="flex flex-col items-center gap-5 py-10">
        <div className="flex items-center gap-2 text-status-critical-fg">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-critical opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-status-critical" />
          </span>
          <span className="font-mono text-lg tabular-nums">{formatDuration(elapsedSec)}</span>
        </div>
        <div className="h-2 w-full max-w-sm overflow-hidden rounded-full bg-muted">
          <div
            ref={levelBarRef}
            className="h-full w-full origin-left rounded-full bg-primary"
            style={{ transform: "scaleX(0)" }}
          />
        </div>
        <Button variant="destructive" onClick={stopRecording}>
          <Square className="fill-current" /> Stop recording
        </Button>
      </div>
    );
  }

  if (phase === "processing") {
    return (
      <div className="flex flex-col items-center gap-3 py-14 text-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <p className="text-[13px] text-muted-foreground">Processing recording…</p>
      </div>
    );
  }

  // idle / requesting
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Mic className="size-5" />
      </div>
      <div>
        <p className="text-sm font-medium">Record a call</p>
        <p className="mt-0.5 max-w-xs text-[13px] text-muted-foreground">
          Uses your microphone. Nothing is sent anywhere until you review it and click Analyze.
        </p>
      </div>
      <Button onClick={startRecording} disabled={phase === "requesting"}>
        {phase === "requesting" ? (
          <>
            <Loader2 className={cn("animate-spin")} /> Requesting access…
          </>
        ) : (
          <>
            <Mic /> Start recording
          </>
        )}
      </Button>
    </div>
  );
}
