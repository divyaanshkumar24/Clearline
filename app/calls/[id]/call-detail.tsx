"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  FileDown,
  Flag,
  Flame,
  History,
  Lightbulb,
  Loader2,
  MessageSquareText,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Sparkles,
  Volume2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/button-link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ConfidenceMeter,
  EmptyState,
  LabelBadge,
  RepAvatar,
  RiskBadge,
  StatusChip,
} from "@/components/shared";
import { Reveal } from "@/components/motion";
import {
  getCall,
  getCriterion,
  getRep,
  getReviewer,
  getTranscript,
} from "@/lib/mock-data";
import { adaptLiveCall, LIVE_REP, type BackendCallResult } from "@/lib/live-call";
import { fmtDateTime, fmtDuration, fmtPct, fmtTimestamp } from "@/lib/format";
import type { Call, ScoreLabel, TranscriptSegment } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useRole, REP_PERSONA } from "@/components/role-context";
import { AccessDenied } from "@/components/role-gate";

function seededBars(id: string, n: number) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const out: number[] = [];
  let a = h >>> 0;
  for (let i = 0; i < n; i++) {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    out.push(0.2 + (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 0.8);
  }
  return out;
}

export function CallDetail({ callId }: { callId: string }) {
  const { role } = useRole();
  const isRep = role === "rep";
  const router = useRouter();

  // Calls submitted through /new-call aren't in the mock dataset — for those,
  // fetch and adapt the real backend result instead of the generated demo data.
  const mockCall = React.useMemo(() => getCall(callId), [callId]);
  const [liveData, setLiveData] = React.useState<{
    call: Call;
    transcript: TranscriptSegment[];
  } | null>(null);
  const [liveError, setLiveError] = React.useState<string | null>(null);
  const [liveLoading, setLiveLoading] = React.useState(!mockCall);

  React.useEffect(() => {
    if (mockCall) return;
    let cancelled = false;

    async function loadLiveCall() {
      setLiveLoading(true);
      setLiveError(null);
      try {
        const res = await fetch(`/api/calls/${callId}`);
        const data = await res.json().catch(() => null);
        if (cancelled) return;

        if (res.status === 409) {
          // Still processing (e.g. a direct link followed before the pipeline
          // finished) — send them to the status screen instead of erroring.
          router.replace(`/calls/${callId}/processing`);
          return;
        }
        if (!res.ok) {
          throw new Error(data?.error ?? "This call couldn't be loaded.");
        }
        setLiveData(adaptLiveCall(data as BackendCallResult));
      } catch (err) {
        if (!cancelled) {
          setLiveError(err instanceof Error ? err.message : "This call couldn't be loaded.");
        }
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    }

    loadLiveCall();

    return () => {
      cancelled = true;
    };
  }, [callId, mockCall, router]);

  const call = mockCall ?? liveData?.call;
  const rep = call ? (call.repId === LIVE_REP.id ? LIVE_REP : getRep(call.repId)) : undefined;
  const durationSec = call?.durationSec ?? 0;

  const transcript = React.useMemo(() => {
    if (!call) return [];
    return mockCall ? getTranscript(call) : (liveData?.transcript ?? []);
  }, [call, mockCall, liveData]);
  const bars = React.useMemo(() => seededBars(callId, 120), [callId]);

  const [playing, setPlaying] = React.useState(false);
  const [time, setTime] = React.useState(0);
  const [activeEvidence, setActiveEvidence] = React.useState<string | null>(null);
  const [overrides, setOverrides] = React.useState<
    Record<string, { label: ScoreLabel; reason: string }>
  >({});
  const [notes, setNotes] = React.useState<
    Array<{ author: string; text: string; ts: string }>
  >(
    mockCall
      ? [
          {
            author: "Omar Haddad",
            text: "Guarantee language at the evidence span is unambiguous. Recommending escalation unless the rep disputes the transcript.",
            ts: "Jul 14, 4:12 PM",
          },
        ]
      : [],
  );
  const [draft, setDraft] = React.useState("");
  const transcriptRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!playing) return;
    const iv = setInterval(
      () => setTime((t) => (t + 1 > durationSec ? 0 : t + 1)),
      1000,
    );
    return () => clearInterval(iv);
  }, [playing, durationSec]);

  const jumpTo = (ts: number, evidenceId?: string) => {
    setTime(ts);
    if (evidenceId) setActiveEvidence(evidenceId);
    const el = transcriptRef.current?.querySelector<HTMLElement>(
      `[data-ts="${ts}"]`,
    );
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const applyOverride = (criterionId: string, label: ScoreLabel) => {
    setOverrides((o) => ({
      ...o,
      [criterionId]: { label, reason: "Manual reviewer decision (demo)" },
    }));
    toast.success(`Override recorded: ${getCriterion(criterionId).code} → ${label}`, {
      description:
        "Original model judgment preserved. Logged with reviewer identity and timestamp.",
    });
  };

  const clearOverride = (criterionId: string) => {
    setOverrides((o) => {
      const next = { ...o };
      delete next[criterionId];
      return next;
    });
    toast("Override removed", { description: "Model judgment restored as effective label." });
  };

  const effective = (s: Call["scores"][number]): ScoreLabel =>
    overrides[s.criterionId]?.label ?? s.override?.label ?? s.label;

  if (liveLoading) {
    return (
      <div className="mx-auto flex max-w-[1600px] flex-col items-center gap-3 px-4 py-24 text-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <p className="text-[13px] text-muted-foreground">Loading call…</p>
      </div>
    );
  }

  if (liveError || !call || !rep) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-6 md:px-6 lg:px-8">
        <EmptyState
          icon={<AlertTriangle className="size-5" />}
          title="This call couldn't be loaded"
          description={liveError ?? "It may not exist, or the analysis backend is unreachable."}
          action={
            <ButtonLink href="/new-call" size="sm">
              Start a new call
            </ButtonLink>
          }
          className="mt-10"
        />
      </div>
    );
  }

  const passCount = call.scores.filter((s) => effective(s) === "pass").length;

  if (isRep && call.repId !== REP_PERSONA.id && call.repId !== LIVE_REP.id) {
    return <AccessDenied screen="This call belongs to another representative and" />;
  }

  const dispute = (criterionId: string) =>
    toast.success(`Dispute submitted for ${getCriterion(criterionId).code}`, {
      description:
        "Routed to the compliance review queue. A reviewer will re-examine the evidence span and respond.",
    });

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-5 md:px-6">
      {/* Header */}
      <Reveal>
        <div className="flex flex-wrap items-center gap-3">
          <ButtonLink
            variant="ghost"
            size="icon-sm"
            href="/calls"
            className="text-muted-foreground"
          >
            <ArrowLeft className="size-4" />
          </ButtonLink>
          <h1 className="font-mono text-lg font-semibold tracking-tight">
            {call.reference}
          </h1>
          <RiskBadge tier={call.riskTier} />
          <StatusChip status={call.status} />
          {call.adversarial ? (
            <Badge
              variant="outline"
              className="gap-1.5 border-chart-5/40 bg-chart-5/10 font-medium text-chart-5"
            >
              <Sparkles className="size-3" /> Adversarial corpus
            </Badge>
          ) : null}
          <div className="w-full sm:w-auto sm:ml-auto flex flex-wrap items-center gap-2 mt-2 sm:mt-0">
            {isRep ? (
              <Badge
                variant="outline"
                className="gap-1.5 border-primary/25 bg-primary/5 font-medium text-primary"
              >
                Read-only · dispute findings you disagree with
              </Badge>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => toast("Re-audit queued", { description: "This call will be re-scored under rubric v2.5 draft for comparison." })}>
                  <RotateCcw className="size-3.5" /> Re-audit
                </Button>
                <ButtonLink variant="outline" size="sm" href="/export">
                  <FileDown className="size-3.5" /> Export PDF
                </ButtonLink>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => toast.warning("Escalated to legal review", { description: "Janet Moss notified. SLA clock started." })}
                >
                  <Flame className="size-3.5" /> Escalate
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 pl-11 text-[12.5px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <RepAvatar rep={rep} size="sm" /> {rep.name} · {rep.team}
          </span>
          <span>{call.clientAlias}</span>
          <span>{fmtDateTime(call.date)}</span>
          <span>{fmtDuration(call.durationSec)} min</span>
          <span>{call.product}</span>
          <span className="flex items-center gap-1">
            <ShieldCheck className="size-3.5" /> Rubric v2.4 ·{" "}
            {passCount}/{call.scores.length} criteria passed
          </span>
        </div>
      </Reveal>

      {/* Trajectory timeline */}
      <Reveal delay={0.08} className="mt-4">
        <Card className="gap-0 py-0">
          <CardContent className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[12.5px] font-medium text-muted-foreground">
                Conversation trajectory
              </p>
              <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-3 rounded-[2px] bg-chart-1" /> Representative
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-3 rounded-[2px] bg-chart-2" /> Client
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-status-critical" /> Compliance evidence
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-status-warning" /> Coaching finding
                </span>
              </div>
            </div>
            <div className="relative">
              {/* speaker lanes */}
              <div className="space-y-1.5">
                {(["rep", "client"] as const).map((speaker) => (
                  <div key={speaker} className="relative h-5 rounded bg-muted/50">
                    {transcript
                      .filter((s) => s.speaker === speaker)
                      .map((s, i) => (
                        <button
                          key={i}
                          className={cn(
                            "absolute top-0.5 h-4 rounded-[3px] transition-opacity hover:opacity-80",
                            speaker === "rep" ? "bg-chart-1" : "bg-chart-2",
                          )}
                          style={{
                            left: `${(s.start / call.durationSec) * 100}%`,
                            width: `${Math.max(0.5, ((s.end - s.start) / call.durationSec) * 100)}%`,
                          }}
                          onClick={() => jumpTo(s.start)}
                          aria-label={`Jump to ${fmtTimestamp(s.start)}`}
                        />
                      ))}
                  </div>
                ))}
              </div>
              {/* markers */}
              <div className="relative mt-1.5 h-3">
                {call.scores
                  .filter((s) => effective(s) !== "pass")
                  .map((s) => (
                    <button
                      key={s.criterionId}
                      className="absolute top-0 size-2.5 -translate-x-1/2 rounded-full bg-status-critical ring-2 ring-card transition-transform hover:scale-125"
                      style={{ left: `${(s.evidenceTs / call.durationSec) * 100}%` }}
                      onClick={() => jumpTo(s.evidenceTs, s.criterionId)}
                      aria-label={`Evidence: ${getCriterion(s.criterionId).name}`}
                      title={getCriterion(s.criterionId).name}
                    />
                  ))}
                {call.findings.map((f) => (
                  <button
                    key={f.id}
                    className="absolute top-0 size-2 -translate-x-1/2 rounded-full bg-status-warning ring-2 ring-card transition-transform hover:scale-125"
                    style={{ left: `${(f.ts / call.durationSec) * 100}%` }}
                    onClick={() => jumpTo(f.ts, f.id)}
                    aria-label={`Finding: ${f.type}`}
                    title={f.type}
                  />
                ))}
              </div>
              {/* playhead */}
              <div
                className="pointer-events-none absolute -top-1 bottom-0 w-px bg-foreground/60"
                style={{ left: `${(time / call.durationSec) * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </Reveal>

      {/* Main grid */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_420px]">
        {/* Left: player + transcript */}
        <Reveal delay={0.12} className="min-w-0">
          <Card className="gap-0 overflow-hidden py-0">
            {/* Audio player */}
            <div className="border-b bg-muted/30 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                {/* waveform */}
                <div className="flex items-center gap-3 w-full sm:flex-1">
                  <div
                    className="relative flex h-10 flex-1 cursor-pointer items-center gap-px"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const frac = (e.clientX - rect.left) / rect.width;
                      setTime(Math.floor(frac * call.durationSec));
                    }}
                  >
                    {bars.map((b, i) => {
                      const played = i / bars.length < time / call.durationSec;
                      return (
                        <span
                          key={i}
                          className={cn(
                            "w-full flex-1 rounded-full",
                            played ? "bg-primary" : "bg-border",
                          )}
                          style={{ height: `${b * 100}%` }}
                        />
                      );
                    })}
                  </div>
                </div>
                {/* controls */}
                <div className="flex items-center justify-between gap-3 w-full sm:w-auto sm:justify-start">
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="icon"
                      className="size-9 rounded-full"
                      onClick={() => setPlaying((p) => !p)}
                      aria-label={playing ? "Pause" : "Play"}
                    >
                      {playing ? <Pause className="size-4" /> : <Play className="size-4 pl-0.5" />}
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => setTime((t) => Math.max(0, t - 15))} aria-label="Back 15 seconds">
                      <SkipBack className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => setTime((t) => Math.min(call.durationSec, t + 15))} aria-label="Forward 15 seconds">
                      <SkipForward className="size-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-24 text-right font-mono text-[12px] tabular-nums text-muted-foreground">
                      {fmtTimestamp(time)} / {fmtDuration(call.durationSec)}
                    </span>
                    <Volume2 className="size-4 text-muted-foreground" />
                  </div>
                </div>
              </div>
            </div>

            {/* Transcript */}
            <div
              ref={transcriptRef}
              className="max-h-[640px] space-y-4 overflow-y-auto p-5 thin-scroll"
            >
              {transcript.map((seg, i) => {
                const isRep = seg.speaker === "rep";
                const evidence = seg.evidenceOf?.[0];
                const score = evidence
                  ? call.scores.find((s) => s.criterionId === evidence)
                  : undefined;
                const finding = evidence
                  ? call.findings.find((f) => f.id === evidence)
                  : undefined;
                const flaggedScore = score && effective(score) !== "pass";
                const isActive = evidence && activeEvidence === evidence;
                return (
                  <div key={i} data-ts={seg.start} className="flex gap-3">
                    {isRep ? (
                      <RepAvatar rep={rep} size="sm" className="mt-0.5" />
                    ) : (
                      <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                        CL
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[12px] font-semibold">
                          {isRep ? rep.name.split(" ")[0] : "Client"}
                        </span>
                        <button
                          className="font-mono text-[10.5px] text-muted-foreground hover:text-primary hover:underline"
                          onClick={() => setTime(seg.start)}
                        >
                          {fmtTimestamp(seg.start)}
                        </button>
                      </div>
                      <p
                        className={cn(
                          "mt-0.5 text-[13.5px] leading-relaxed",
                          flaggedScore &&
                            "rounded-md bg-status-critical/8 px-2 py-1 ring-1 ring-status-critical/25",
                          finding &&
                            "rounded-md bg-status-warning/8 px-2 py-1 ring-1 ring-status-warning/30",
                          isActive && "ring-2 ring-primary",
                        )}
                      >
                        {seg.text}
                      </p>
                      {flaggedScore && score ? (
                        <p className="mt-1 flex items-center gap-1.5 text-[11.5px] font-medium text-status-critical-fg">
                          <AlertTriangle className="size-3" />
                          {getCriterion(score.criterionId).code} ·{" "}
                          {getCriterion(score.criterionId).name} — {effective(score)}
                        </p>
                      ) : null}
                      {finding ? (
                        <p className="mt-1 flex items-center gap-1.5 text-[11.5px] font-medium text-status-warning-fg">
                          <Lightbulb className="size-3" /> {finding.type}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </Reveal>

        {/* Right: tabs */}
        <Reveal delay={0.16} className="min-w-0">
          <Tabs defaultValue="compliance">
            <TabsList className="w-full">
              <TabsTrigger value="compliance" className="flex-1 gap-1.5">
                <ShieldCheck className="size-3.5" /> Compliance
              </TabsTrigger>
              <TabsTrigger value="coaching" className="flex-1 gap-1.5">
                <MessageSquareText className="size-3.5" /> Coaching
              </TabsTrigger>
              {!isRep ? (
                <TabsTrigger value="notes" className="flex-1 gap-1.5">
                  <History className="size-3.5" /> Notes
                </TabsTrigger>
              ) : null}
            </TabsList>

            {/* Compliance tab */}
            <TabsContent value="compliance" className="mt-3 space-y-2.5">
              {call.scores.map((s) => {
                const crit = getCriterion(s.criterionId);
                const label = effective(s);
                const localOverride = overrides[s.criterionId];
                const persistedOverride = s.override;
                const overridden = localOverride || persistedOverride;
                return (
                  <Collapsible key={s.criterionId}>
                    <Card
                      className={cn(
                        "gap-0 py-0",
                        label === "fail" && "border-status-critical/30",
                        label === "flag" && "border-status-warning/40",
                      )}
                    >
                      <CardContent className="p-3.5">
                        <div className="flex items-start gap-3">
                          <LabelBadge label={label} className="mt-0.5 w-14 justify-center" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-[13px] font-medium leading-tight">
                                <span className="font-mono text-[11px] text-muted-foreground">
                                  {crit.code}
                                </span>{" "}
                                {crit.name}
                              </p>
                              {crit.severity === "critical" ? (
                                <Badge
                                  variant="outline"
                                  className="h-4.5 border-status-critical/30 px-1.5 text-[9.5px] font-semibold uppercase tracking-wide text-status-critical-fg"
                                >
                                  Critical
                                </Badge>
                              ) : null}
                              {overridden ? (
                                <Badge
                                  variant="outline"
                                  className="h-4.5 gap-1 border-primary/30 bg-primary/5 px-1.5 text-[9.5px] font-semibold uppercase tracking-wide text-primary"
                                >
                                  <Check className="size-2.5" /> Human
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="h-4.5 px-1.5 text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground"
                                >
                                  Model
                                </Badge>
                              )}
                            </div>
                            <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
                              {s.rationale}
                            </p>
                            <div className="mt-2 flex items-center gap-3">
                              <ConfidenceMeter value={s.confidence} />
                              <button
                                className="font-mono text-[11px] text-primary hover:underline"
                                onClick={() => jumpTo(s.evidenceTs, s.criterionId)}
                              >
                                Evidence @ {fmtTimestamp(s.evidenceTs)}
                              </button>
                            </div>
                          </div>
                          {isRep ? (
                            label !== "pass" ? (
                              <Button
                                variant="outline"
                                size="xs"
                                className="shrink-0"
                                onClick={() => dispute(s.criterionId)}
                              >
                                <Flag className="size-3" /> Dispute
                              </Button>
                            ) : null
                          ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button variant="outline" size="xs" className="shrink-0" />
                              }
                            >
                              Override <ChevronDown className="size-3" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuGroup>
                              <DropdownMenuLabel className="text-xs">
                                Set human label
                              </DropdownMenuLabel>
                              {(["pass", "flag", "fail"] as ScoreLabel[]).map((l) => (
                                <DropdownMenuItem
                                  key={l}
                                  disabled={l === label}
                                  onClick={() => applyOverride(s.criterionId, l)}
                                >
                                  {l === "pass" ? (
                                    <Check className="size-3.5 text-status-good" />
                                  ) : l === "flag" ? (
                                    <Flag className="size-3.5 text-status-warning" />
                                  ) : (
                                    <X className="size-3.5 text-status-critical" />
                                  )}
                                  Mark as {l}
                                </DropdownMenuItem>
                              ))}
                              </DropdownMenuGroup>
                              {localOverride ? (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuGroup>
                                    <DropdownMenuItem
                                      onClick={() => clearOverride(s.criterionId)}
                                    >
                                      <RotateCcw className="size-3.5" /> Restore model label
                                    </DropdownMenuItem>
                                  </DropdownMenuGroup>
                                </>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          )}
                        </div>

                        <CollapsibleTrigger className="mt-2 flex items-center gap-1 text-[11.5px] font-medium text-muted-foreground hover:text-foreground">
                          <ChevronDown className="size-3 transition-transform in-data-[panel-open]:rotate-180" />
                          Evidence & audit trail
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-2 space-y-2 rounded-md bg-muted/40 p-3">
                            <p className="border-l-2 border-status-critical/50 pl-2.5 text-[12.5px] italic leading-relaxed">
                              &ldquo;{s.evidenceQuote}&rdquo;
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Scored under rubric v2.4 · stated confidence{" "}
                              {fmtPct(s.confidence)} (calibration-verified)
                            </p>
                            {persistedOverride ? (
                              <div className="rounded border border-primary/20 bg-primary/5 p-2 text-[11.5px]">
                                <p className="font-medium text-primary">
                                  Override by{" "}
                                  {getReviewer(persistedOverride.reviewerId)?.name}:{" "}
                                  {s.label} → {persistedOverride.label}
                                </p>
                                <p className="mt-0.5 text-muted-foreground">
                                  {persistedOverride.reason}
                                </p>
                              </div>
                            ) : null}
                          </div>
                        </CollapsibleContent>
                      </CardContent>
                    </Card>
                  </Collapsible>
                );
              })}
            </TabsContent>

            {/* Coaching tab */}
            <TabsContent value="coaching" className="mt-3 space-y-3">
              {/* Objective metrics */}
              <Card className="gap-0 py-0">
                <CardContent className="p-4">
                  <p className="text-[12px] font-medium text-muted-foreground">
                    Objective audio metrics{" "}
                    <span className="font-normal">— computed from diarization, no LLM</span>
                  </p>
                  <div className="mt-3 space-y-3">
                    <div>
                      <div className="flex justify-between text-[12px]">
                        <span>Talk ratio</span>
                        <span className="tabular-nums text-muted-foreground">
                          rep {fmtPct(call.metrics.talkRatioRep)} · client{" "}
                          {fmtPct(1 - call.metrics.talkRatioRep)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex h-2 gap-0.5 overflow-hidden rounded-full">
                        <div
                          className="rounded-l-full bg-chart-1"
                          style={{ width: `${call.metrics.talkRatioRep * 100}%` }}
                        />
                        <div className="flex-1 rounded-r-full bg-chart-2" />
                      </div>
                      {call.metrics.talkRatioRep > 0.65 ? (
                        <p className="mt-1 text-[11px] text-status-serious-fg">
                          Above the 65% guideline — the client had little room to speak.
                        </p>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {[
                        { label: "Interruptions", value: call.metrics.interruptions, warn: call.metrics.interruptions > 5 },
                        { label: "Long silences", value: call.metrics.longSilences, warn: false },
                        { label: "Longest monologue", value: fmtDuration(call.metrics.longestMonologueSec), warn: call.metrics.longestMonologueSec > 150 },
                        { label: "Filler / min", value: call.metrics.fillerPerMin, warn: call.metrics.fillerPerMin > 5 },
                      ].map((m) => (
                        <div key={m.label} className="rounded-lg border bg-muted/30 p-2.5">
                          <p className="text-[10.5px] text-muted-foreground">{m.label}</p>
                          <p
                            className={cn(
                              "mt-0.5 text-[15px] font-semibold tabular-nums",
                              m.warn && "text-status-serious-fg",
                            )}
                          >
                            {m.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {call.findings.length === 0 ? (
                <Card className="gap-0 py-0">
                  <CardContent className="p-6 text-center">
                    <p className="text-sm font-medium">No coaching findings</p>
                    <p className="mt-1 text-[12.5px] text-muted-foreground">
                      This conversation is a strong exemplar — consider adding it to the
                      team playbook.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                call.findings.map((f) => (
                  <Card
                    key={f.id}
                    className={cn(
                      "gap-0 py-0",
                      f.severity === "major" && "border-status-serious/40",
                    )}
                  >
                    <CardContent className="p-3.5">
                      <div className="flex items-center gap-2">
                        <Lightbulb
                          className={cn(
                            "size-3.5",
                            f.severity === "major"
                              ? "text-status-serious"
                              : "text-status-warning",
                          )}
                        />
                        <p className="text-[13px] font-medium">{f.type}</p>
                        <Badge
                          variant="outline"
                          className="h-4.5 px-1.5 text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground"
                        >
                          {f.severity}
                        </Badge>
                        <button
                          className="ml-auto font-mono text-[11px] text-primary hover:underline"
                          onClick={() => jumpTo(f.ts, f.id)}
                        >
                          @ {fmtTimestamp(f.ts)}
                        </button>
                      </div>
                      <p className="mt-1.5 border-l-2 border-border pl-2.5 text-[12.5px] italic text-muted-foreground">
                        &ldquo;{f.quote}&rdquo;
                      </p>
                      <div className="mt-2 flex gap-2 rounded-md bg-status-good/8 p-2.5 ring-1 ring-status-good/20">
                        <Sparkles className="mt-0.5 size-3.5 shrink-0 text-status-good-fg" />
                        <p className="text-[12.5px] leading-snug text-foreground">
                          {f.suggestion}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* Notes tab */}
            <TabsContent value="notes" className="mt-3 space-y-3">
              <Card className="gap-0 py-0">
                <CardContent className="space-y-4 p-4">
                  {notes.map((n, i) => (
                    <div key={i} className="flex gap-2.5">
                      <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold">
                        {n.author.split(" ").map((w) => w[0]).join("")}
                      </div>
                      <div>
                        <p className="text-[12px]">
                          <span className="font-semibold">{n.author}</span>{" "}
                          <span className="text-muted-foreground">· {n.ts}</span>
                        </p>
                        <p className="mt-0.5 text-[13px] leading-relaxed">{n.text}</p>
                      </div>
                    </div>
                  ))}
                  <Separator />
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Add a reviewer note — visible to compliance team only…"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      className="min-h-20 text-[13px]"
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        disabled={!draft.trim()}
                        onClick={() => {
                          setNotes((n) => [
                            ...n,
                            { author: "Janet Moss", text: draft.trim(), ts: "Just now" },
                          ]);
                          setDraft("");
                          toast.success("Note added to audit record");
                        }}
                      >
                        Add note
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </Reveal>
      </div>
    </div>
  );
}
