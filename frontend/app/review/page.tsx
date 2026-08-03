"use client";

import * as React from "react";
import {
  ArrowRight,
  Check,
  CheckCheck,
  ChevronDown,
  Flag,
  Flame,
  GitCompareArrows,
  History,
  ShieldQuestion,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/button-link";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ConfidenceMeter,
  EmptyState,
  LabelBadge,
  PageHeader,
  RepAvatar,
  RiskBadge,
  StatusChip,
} from "@/components/shared";
import { Reveal } from "@/components/motion";
import { CALLS, getCriterion, getRep, getReviewer } from "@/lib/mock-data";
import { fmtDateTime, fmtRelative, fmtTimestamp } from "@/lib/format";
import type { RiskTier, ScoreLabel } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AccessDenied, RoleGate } from "@/components/role-gate";

const TIER_ORDER: Record<RiskTier, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function AdminReview() {
  const queue = React.useMemo(
    () =>
      CALLS.filter((c) => c.status === "pending" || c.status === "in_review").sort(
        (a, b) =>
          TIER_ORDER[a.riskTier] - TIER_ORDER[b.riskTier] ||
          +new Date(b.date) - +new Date(a.date),
      ),
    [],
  );
  const [selectedId, setSelectedId] = React.useState(queue[0]?.id);
  const [decisions, setDecisions] = React.useState<
    Record<string, Record<string, { label: ScoreLabel; reason?: string }>>
  >({});
  const [approved, setApproved] = React.useState<Set<string>>(new Set());
  const [comment, setComment] = React.useState("");

  const call = queue.find((c) => c.id === selectedId) ?? queue[0];
  const callDecisions = (call && decisions[call.id]) || {};

  const decide = (criterionId: string, label: ScoreLabel) => {
    if (!call) return;
    setDecisions((d) => ({
      ...d,
      [call.id]: { ...d[call.id], [criterionId]: { label } },
    }));
    toast.success(`Recorded: ${getCriterion(criterionId).code} → ${label}`, {
      description: "Original model judgment preserved in the override log.",
    });
  };

  const confirmAll = () => {
    if (!call) return;
    toast.success("All model judgments confirmed", {
      description: `${call.scores.length} criteria marked as human-confirmed for ${call.reference}.`,
    });
  };

  const approve = () => {
    if (!call) return;
    setApproved((a) => new Set(a).add(call.id));
    const overridden = Object.keys(callDecisions).length;
    toast.success(`Review complete — ${call.reference}`, {
      description:
        overridden > 0
          ? `${overridden} override${overridden > 1 ? "s" : ""} recorded with reviewer identity and timestamp.`
          : "Model judgments accepted in full. Agreement log updated.",
    });
    const idx = queue.findIndex((c) => c.id === call.id);
    const next = queue.slice(idx + 1).find((c) => !approved.has(c.id) && c.id !== call.id);
    if (next) setSelectedId(next.id);
  };

  if (!call) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-6 md:px-6">
        <PageHeader title="Review queue" />
        <EmptyState
          icon={<CheckCheck className="size-5" />}
          title="Queue is clear"
          description="Every audited call has a human decision. New calls will appear here ranked by risk tier."
        />
      </div>
    );
  }

  const rep = getRep(call.repId);
  const disagreements = call.scores.filter((s) => callDecisions[s.criterionId]);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 md:px-6">
      <PageHeader
        title="Human review workspace"
        description="The AI triages, you decide. Overrides never overwrite the model's judgment — both stay on record, and disagreement rates feed straight back into rubric improvement."
      />

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        {/* Queue */}
        <Reveal className="order-2 lg:order-1">
          <Card className="gap-0 overflow-hidden py-0">
            <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
              <p className="text-[12.5px] font-medium">
                Queue{" "}
                <span className="text-muted-foreground">
                  · {queue.length - approved.size} open
                </span>
              </p>
              <Badge variant="secondary" className="text-[10px]">
                risk-ordered
              </Badge>
            </div>
            <ScrollArea className="h-[560px]">
              <div className="space-y-0.5 p-2">
                {queue.map((c) => {
                  const done = approved.has(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors",
                        c.id === call.id
                          ? "border-border bg-accent"
                          : "hover:bg-accent/50",
                        done && "opacity-50",
                      )}
                    >
                      <RepAvatar rep={getRep(c.repId)} size="sm" />
                      <div className="min-w-0 flex-1 leading-tight">
                        <div className="flex items-center gap-1.5">
                          <p className="font-mono text-[11.5px] font-medium">{c.reference}</p>
                          {done ? (
                            <Check className="size-3 text-status-good" />
                          ) : null}
                        </div>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {getRep(c.repId).name} · {fmtRelative(c.date)}
                        </p>
                      </div>
                      <RiskBadge tier={c.riskTier} className="h-5 px-1.5 text-[9.5px]" />
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </Card>
        </Reveal>

        {/* Workspace */}
        <Reveal delay={0.08} className="min-w-0 space-y-4 order-1 lg:order-2">
          {/* Header card */}
          <Card className="gap-0 py-0">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="font-mono text-[15px] font-semibold">{call.reference}</h2>
                <RiskBadge tier={call.riskTier} />
                <StatusChip status={approved.has(call.id) ? "reviewed" : call.status} />
                <span className="text-[12.5px] text-muted-foreground">
                  {rep.name} · {fmtDateTime(call.date)} · {call.product}
                </span>
                <div className="ml-auto flex gap-2">
                  <ButtonLink variant="outline" size="sm" href={`/calls/${call.id}`}>
                    Full audit <ArrowRight className="size-3.5" />
                  </ButtonLink>
                </div>
              </div>
              <p className="mt-2 text-[13px] text-muted-foreground">{call.summary}</p>
            </CardContent>
          </Card>

          {/* Before / after comparison */}
          <Card className="gap-0 py-0">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <GitCompareArrows className="size-4 text-muted-foreground" />
                <h3 className="text-[13.5px] font-semibold">
                  Model judgment vs your decision
                </h3>
                {disagreements.length > 0 ? (
                  <Badge
                    variant="outline"
                    className="h-5 border-status-warning/40 bg-status-warning/10 text-[10px] font-medium text-status-warning-fg"
                  >
                    {disagreements.length} disagreement{disagreements.length > 1 ? "s" : ""}
                  </Badge>
                ) : null}
                <Button variant="ghost" size="sm" className="ml-auto text-primary" onClick={confirmAll}>
                  <CheckCheck className="size-3.5" /> Confirm all model labels
                </Button>
              </div>
              <div className="overflow-hidden rounded-lg border">
                <div className="grid grid-cols-[1fr_120px_120px_100px] items-center gap-2 border-b bg-muted/40 px-3 py-2 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground max-sm:grid-cols-[1fr_90px_90px]">
                  <span>Criterion</span>
                  <span className="text-center">Model (before)</span>
                  <span className="text-center">Human (after)</span>
                  <span className="text-center max-sm:hidden">Confidence</span>
                </div>
                {call.scores.map((s) => {
                  const crit = getCriterion(s.criterionId);
                  const decision = callDecisions[s.criterionId];
                  const effective = decision?.label ?? s.override?.label ?? s.label;
                  const changed = decision && decision.label !== s.label;
                  return (
                    <div
                      key={s.criterionId}
                      className={cn(
                        "grid grid-cols-[1fr_120px_120px_100px] items-center gap-2 border-b px-3 py-2 last:border-0 max-sm:grid-cols-[1fr_90px_90px]",
                        changed && "bg-status-warning/5",
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] font-medium">
                          <span className="font-mono text-[10.5px] text-muted-foreground">
                            {crit.code}
                          </span>{" "}
                          {crit.name}
                        </p>
                        <button
                          className="font-mono text-[10.5px] text-primary hover:underline"
                          onClick={() =>
                            toast(`Evidence @ ${fmtTimestamp(s.evidenceTs)}`, {
                              description: `“${s.evidenceQuote}”`,
                            })
                          }
                        >
                          evidence @ {fmtTimestamp(s.evidenceTs)}
                        </button>
                      </div>
                      <div className="flex justify-center">
                        <LabelBadge label={s.label} className="w-14 justify-center opacity-80" />
                      </div>
                      <div className="flex justify-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant={changed ? "secondary" : "ghost"}
                                size="xs"
                                className={cn(
                                  "gap-1",
                                  changed && "ring-1 ring-status-warning/50",
                                )}
                              />
                            }
                          >
                            <LabelBadge
                              label={effective}
                              className="pointer-events-none h-5 w-14 justify-center"
                            />
                            <ChevronDown className="size-3 text-muted-foreground" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="center" className="w-44">
                            <DropdownMenuGroup>
                              <DropdownMenuLabel className="text-xs">
                                Your decision
                              </DropdownMenuLabel>
                              {(["pass", "flag", "fail"] as ScoreLabel[]).map((l) => (
                                <DropdownMenuItem key={l} onClick={() => decide(s.criterionId, l)}>
                                  {l === "pass" ? (
                                    <Check className="size-3.5 text-status-good" />
                                  ) : l === "flag" ? (
                                    <Flag className="size-3.5 text-status-warning" />
                                  ) : (
                                    <X className="size-3.5 text-status-critical" />
                                  )}
                                  {l}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="flex justify-center max-sm:hidden">
                        <ConfidenceMeter value={s.confidence} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Comment + actions */}
            <Card className="gap-0 py-0">
              <CardContent className="space-y-3 p-4">
                <h3 className="text-[13.5px] font-semibold">Reviewer decision</h3>
                <Textarea
                  placeholder="Reason for overrides (required when disagreeing with the model)…"
                  className="min-h-20 text-[13px]"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={approve} disabled={approved.has(call.id)}>
                    <Check className="size-4" />
                    {approved.has(call.id) ? "Review recorded" : "Approve & complete review"}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() =>
                      toast.warning(`${call.reference} escalated`, {
                        description: "Routed to legal review with your comment attached.",
                      })
                    }
                  >
                    <Flame className="size-3.5" /> Escalate
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      toast(`Requested second opinion`, {
                        description: "Omar Haddad added as co-reviewer.",
                      })
                    }
                  >
                    <ShieldQuestion className="size-3.5" /> Second opinion
                  </Button>
                </div>
                <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                  Signing as <span className="font-medium text-foreground">Janet Moss</span> —
                  your decision is appended to the immutable override log and counts
                  toward the model-agreement record.
                </p>
              </CardContent>
            </Card>

            {/* Audit history */}
            <Card className="gap-0 py-0">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <History className="size-4 text-muted-foreground" />
                  <h3 className="text-[13.5px] font-semibold">Audit history</h3>
                </div>
                <div className="mt-3 space-y-0">
                  {[
                    {
                      t: "Scored by audit engine",
                      d: `Rubric v2.4 · ${call.scores.length} criteria · ${call.findings.length} coaching findings`,
                      time: fmtDateTime(call.date),
                    },
                    ...(call.scores.filter((s) => s.override).map((s) => ({
                      t: `Override — ${getCriterion(s.criterionId).code} ${s.label} → ${s.override!.label}`,
                      d: `${getReviewer(s.override!.reviewerId)?.name}: ${s.override!.reason}`,
                      time: fmtDateTime(s.override!.timestamp),
                    }))),
                    ...(call.rubricVersionId === "rub-23"
                      ? [{
                          t: "Re-audit available",
                          d: "Originally scored under rubric v2.3 — compare against v2.4 in Rubric management.",
                          time: "Jun 1, 9:00 AM",
                        }]
                      : []),
                    ...(Object.entries(callDecisions).map(([cid, d]) => ({
                      t: `Pending override — ${getCriterion(cid).code} → ${d.label}`,
                      d: "Will be recorded when you approve this review.",
                      time: "This session",
                    }))),
                  ].map((e, i, arr) => (
                    <div key={i} className="relative flex gap-3 pb-3.5 last:pb-0">
                      {i < arr.length - 1 ? (
                        <span className="absolute left-[5px] top-4 h-full w-px bg-border" />
                      ) : null}
                      <span className="z-10 mt-1.5 size-2.5 shrink-0 rounded-full border-2 border-card bg-primary" />
                      <div className="min-w-0 leading-tight">
                        <p className="text-[12.5px] font-medium">{e.t}</p>
                        <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">
                          {e.d}
                        </p>
                        <p className="mt-0.5 text-[10.5px] text-muted-foreground/70">{e.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </Reveal>
      </div>
    </div>
  );
}

export default function ReviewPage() {
  return <RoleGate admin={<AdminReview />} rep={<AccessDenied screen="The review workspace" />} />;
}
