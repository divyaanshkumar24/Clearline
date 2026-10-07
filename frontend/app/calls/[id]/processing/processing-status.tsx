"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Loader2, Mic, RotateCcw, Sparkles, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ButtonLink } from "@/components/button-link";
import { PageHeader } from "@/components/shared";
import { Reveal, Stagger } from "@/components/motion";
import { cn } from "@/lib/utils";

type Stage = "queued" | "transcribing" | "diarizing" | "analyzing" | "done" | "failed";
type StepState = "pending" | "active" | "done";

const STAGE_ORDER: Stage[] = ["queued", "transcribing", "diarizing", "analyzing", "done"];

const PIPELINE_STEPS: Array<{
  key: Stage;
  label: string;
  description: string;
  icon: typeof Mic;
}> = [
  {
    key: "transcribing",
    label: "Speech-to-text",
    description: "Transcribing the call audio",
    icon: Mic,
  },
  {
    key: "diarizing",
    label: "Speaker diarization",
    description: "Identifying who's speaking",
    icon: Users,
  },
  {
    key: "analyzing",
    label: "AI recommendations",
    description: "Scoring compliance and coaching",
    icon: Sparkles,
  },
];

function stepState(stepKey: Stage, current: Stage): StepState {
  const currentIdx = STAGE_ORDER.indexOf(current === "failed" ? "queued" : current);
  const stepIdx = STAGE_ORDER.indexOf(stepKey);
  if (currentIdx > stepIdx) return "done";
  if (currentIdx === stepIdx) return "active";
  return "pending";
}

export function ProcessingStatus({ callId }: { callId: string }) {
  const router = useRouter();
  const [stage, setStage] = React.useState<Stage>("queued");
  const [progressPct, setProgressPct] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  // Poll every second; stop as soon as we land on a terminal stage (done/failed)
  // or the component unmounts.
  React.useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      let data: { stage?: Stage; progress_pct?: number; error?: string } | null = null;
      try {
        const res = await fetch(`/api/calls/${callId}/status`);
        data = await res.json().catch(() => null);
        if (cancelled) return;

        if (!res.ok) {
          setError(data?.error ?? "This call couldn't be found.");
          setStage("failed");
          return;
        }
      } catch {
        if (!cancelled) {
          setError("Couldn't reach the analysis backend.");
          setStage("failed");
        }
        return;
      }

      const nextStage = data?.stage ?? "failed";
      setStage(nextStage);
      setProgressPct(data?.progress_pct ?? 0);

      if (nextStage === "failed") {
        setError(data?.error ?? "Analysis failed for an unknown reason.");
        return;
      }
      if (nextStage === "done") {
        return;
      }
      timer = setTimeout(poll, 1000);
    };

    poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [callId]);

  // Once the backend reports "done", hand off to the real call detail page.
  React.useEffect(() => {
    if (stage !== "done") return;
    const t = setTimeout(() => router.push(`/calls/${callId}`), 600);
    return () => clearTimeout(t);
  }, [stage, callId, router]);

  if (stage === "failed") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 md:px-6 lg:px-8">
        <PageHeader
          title="Analysis failed"
          description="Something went wrong while processing this call."
        />
        <Reveal>
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Couldn&apos;t complete analysis</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="mt-4 flex justify-end">
            <ButtonLink href="/new-call">
              <RotateCcw className="size-3.5" /> Try again
            </ButtonLink>
          </div>
        </Reveal>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-6 lg:px-8">
      <PageHeader
        title="Analyzing your call"
        description="Longer calls take longer — on a laptop CPU, expect a few minutes for a one-minute recording. The call will appear in Calls once it's done."
      />
      <Reveal>
        <Card className="gap-0 py-0">
          <CardContent className="space-y-6 p-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[12.5px] text-muted-foreground">
                <span>Overall progress</span>
                <span className="font-mono tabular-nums">{progressPct}%</span>
              </div>
              <Progress value={progressPct} className="w-full" />
            </div>

            <Stagger className="space-y-3">
              {PIPELINE_STEPS.map((step) => {
                const state = stepState(step.key, stage);
                const Icon = step.icon;
                return (
                  <div
                    key={step.key}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3 transition-colors",
                      state === "done" && "border-status-good/30 bg-status-good/5",
                      state === "active" && "border-primary/30 bg-primary/5",
                      state === "pending" && "border-border bg-muted/20",
                    )}
                  >
                    <div
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-full",
                        state === "done" && "bg-status-good/15 text-status-good-fg",
                        state === "active" && "bg-primary/15 text-primary",
                        state === "pending" && "bg-muted text-muted-foreground",
                      )}
                    >
                      {state === "done" ? (
                        <Check className="size-4" />
                      ) : state === "active" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Icon className="size-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-[13.5px] font-medium",
                          state === "pending" && "text-muted-foreground",
                        )}
                      >
                        {step.label}
                      </p>
                      <p className="text-[12px] text-muted-foreground">{step.description}</p>
                    </div>
                    {state === "active" ? (
                      <span className="relative flex size-2 shrink-0">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                        <span className="relative inline-flex size-2 rounded-full bg-primary" />
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </Stagger>
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}
