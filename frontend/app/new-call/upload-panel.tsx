"use client";

import * as React from "react";
import { FileAudio, Loader2, RotateCcw, TriangleAlert, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { prepareAudioForUpload, formatBytes } from "@/lib/audio";
import { cn } from "@/lib/utils";

type Phase = "idle" | "processing" | "ready" | "error";

const ACCEPTED_EXTENSIONS = [".mp3", ".wav", ".m4a"];
const MAX_SIZE_BYTES = 100 * 1024 * 1024; // 100MB

function hasAcceptedExtension(filename: string): boolean {
  const lower = filename.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function UploadPanel({ onReady }: { onReady: (file: File | null) => void }) {
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [isDragging, setIsDragging] = React.useState(false);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [fileSize, setFileSize] = React.useState<number | null>(null);
  const [sizeWarning, setSizeWarning] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);

  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const audioUrlRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    return () => {
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  const reset = React.useCallback(() => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setAudioUrl(null);
    setFileName(null);
    setFileSize(null);
    setSizeWarning(null);
    setErrorMessage(null);
    onReady(null);
    setPhase("idle");
    if (inputRef.current) inputRef.current.value = "";
  }, [onReady]);

  const processFile = React.useCallback(
    async (file: File) => {
      setErrorMessage(null);
      setSizeWarning(null);

      if (!hasAcceptedExtension(file.name)) {
        setPhase("error");
        setErrorMessage("Please choose an MP3, WAV, or M4A audio file.");
        return;
      }

      if (file.size > MAX_SIZE_BYTES) {
        setSizeWarning(
          `This file is ${formatBytes(file.size)} — larger than the recommended 100MB. It may take a while to upload and process.`,
        );
      }

      setFileName(file.name);
      setFileSize(file.size);
      setPhase("processing");
      try {
        const wavBlob = await prepareAudioForUpload(file);
        const url = URL.createObjectURL(wavBlob);
        audioUrlRef.current = url;
        setAudioUrl(url);
        setPhase("ready");
        onReady(new File([wavBlob], "upload.wav", { type: "audio/wav" }));
      } catch {
        setPhase("error");
        setErrorMessage("This file couldn't be read as audio. Try a different file.");
        onReady(null);
      }
    },
    [onReady],
  );

  const onDrop = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      const file = event.dataTransfer.files?.[0];
      if (file) void processFile(file);
    },
    [processFile],
  );

  const onFileInputChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) void processFile(file);
    },
    [processFile],
  );

  if (phase === "error") {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <Alert variant="destructive" className="max-w-md text-left">
          <TriangleAlert />
          <AlertTitle>Could not use that file</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
        <Button variant="outline" size="sm" onClick={reset}>
          <RotateCcw /> Try again
        </Button>
      </div>
    );
  }

  if (phase === "processing") {
    return (
      <div className="flex flex-col items-center gap-3 py-14 text-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <p className="text-[13px] text-muted-foreground">Processing {fileName}…</p>
      </div>
    );
  }

  if (phase === "ready" && audioUrl) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="flex size-12 items-center justify-center rounded-full bg-status-good/10 text-status-good-fg">
          <FileAudio className="size-5" />
        </div>
        <div className="text-center">
          <p className="max-w-xs truncate text-sm font-medium">{fileName}</p>
          <p className="text-[13px] text-muted-foreground">
            {fileSize !== null ? formatBytes(fileSize) : null} · ready to review
          </p>
        </div>
        {sizeWarning ? (
          <Alert className="max-w-md border-status-warning/30 bg-status-warning/5 text-left">
            <TriangleAlert className="text-status-warning-fg" />
            <AlertDescription className="text-status-warning-fg">{sizeWarning}</AlertDescription>
          </Alert>
        ) : null}
        <audio controls src={audioUrl} className="w-full max-w-sm" />
        <Button variant="outline" size="sm" onClick={reset}>
          Choose a different file
        </Button>
      </div>
    );
  }

  // idle
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-14 text-center transition-colors",
        isDragging ? "border-primary bg-primary/5" : "border-border",
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Upload className="size-5" />
      </div>
      <div>
        <p className="text-sm font-medium">Drag and drop an audio file</p>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          MP3, WAV, or M4A · up to 100MB
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
        Browse files
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".mp3,.wav,.m4a,audio/*"
        className="hidden"
        onChange={onFileInputChange}
      />
    </div>
  );
}
