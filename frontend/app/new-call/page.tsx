"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mic, Upload as UploadIcon, Loader2, PhoneCall } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/shared";
import { Reveal } from "@/components/motion";
import type { PendingAudio } from "@/lib/audio";
import { RecorderPanel } from "./recorder-panel";
import { UploadPanel } from "./upload-panel";

export default function NewCallPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<"record" | "upload">("record");
  const [pendingAudio, setPendingAudio] = React.useState<PendingAudio | null>(null);
  const [dualChannel, setDualChannel] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // Only a genuinely two-channel source can use the backend's channel-split
  // speaker attribution; anything else must go through AI diarization.
  const isStereo = (pendingAudio?.sourceChannels ?? 0) >= 2;

  const handleAudioReady = React.useCallback((audio: PendingAudio | null) => {
    setPendingAudio(audio);
    // Default the option on for a stereo source, and clear it whenever the
    // audio is swapped or reset so a stale `true` can't outlive its file.
    setDualChannel((audio?.sourceChannels ?? 0) >= 2);
  }, []);

  const handleAnalyze = async () => {
    if (!pendingAudio) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("file", pendingAudio.file, pendingAudio.file.name);
      formData.append("dual_channel", String(dualChannel && isStereo));

      const response = await fetch("/api/calls", {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.call_id) {
        toast.error("Couldn't start the analysis", {
          description: data?.error ?? "The backend didn't accept this call. Please try again.",
        });
        setSubmitting(false);
        return;
      }

      router.push(`/calls/${data.call_id}/processing`);
    } catch {
      toast.error("Couldn't reach the server", {
        description: "Check your connection and try again.",
      });
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-6 lg:px-8">
      <PageHeader
        title="New call"
        description="Record a call live or upload a recording — Clearline will transcribe it, identify speakers, and run the full compliance and coaching analysis."
      />

      <Reveal>
        <Card className="gap-0 py-0">
          <CardContent className="p-0">
            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as "record" | "upload")}
              className="p-4"
            >
              <TabsList className="w-full">
                <TabsTrigger value="record" className="flex-1 gap-1.5">
                  <Mic className="size-3.5" /> Record
                </TabsTrigger>
                <TabsTrigger value="upload" className="flex-1 gap-1.5">
                  <UploadIcon className="size-3.5" /> Upload
                </TabsTrigger>
              </TabsList>
              <TabsContent value="record">
                <RecorderPanel
                  onReady={handleAudioReady}
                  onRequestUploadTab={() => setActiveTab("upload")}
                />
              </TabsContent>
              <TabsContent value="upload">
                <UploadPanel onReady={handleAudioReady} />
                {isStereo ? (
                  <label className="mt-1 flex items-start gap-2.5 rounded-lg border bg-muted/30 px-3 py-2.5 text-[13px]">
                    <Checkbox
                      className="mt-0.5"
                      checked={dualChannel}
                      onCheckedChange={(value) => setDualChannel(value === true)}
                    />
                    <span>
                      Two-channel recording
                      <span className="block text-[11.5px] leading-relaxed text-muted-foreground">
                        Detected 2 channels. Channel 1 is treated as the rep and channel 2 as the
                        client — this skips AI diarization and attributes every line by channel,
                        which is exact rather than inferred.
                      </span>
                    </span>
                  </label>
                ) : null}
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button onClick={handleAnalyze} disabled={!pendingAudio || submitting}>
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" /> Starting analysis…
                </>
              ) : (
                <>
                  <PhoneCall /> Analyze call
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </Reveal>
    </div>
  );
}
