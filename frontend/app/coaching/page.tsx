import Link from "next/link";
import {
  ArrowRight,
  Ear,
  Hourglass,
  Lightbulb,
  MessageCircleQuestion,
  MicVocal,
  Timer,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CoachingTrendChart, ChartLegend } from "@/components/charts";
import { KpiCard, PageHeader, RepAvatar } from "@/components/shared";
import { Reveal, Stagger } from "@/components/motion";
import { CALLS, REPRESENTATIVES } from "@/lib/mock-data";
import { COACHING_BY_TYPE } from "@/lib/derived";
import { fmtDuration, fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RoleGate } from "@/components/role-gate";
import { RepCoaching } from "@/components/rep-coaching";

function AdminCoaching() {
  const totalCalls = CALLS.length;
  const avgTalk =
    CALLS.reduce((a, c) => a + c.metrics.talkRatioRep, 0) / totalCalls;
  const avgInterruptions =
    CALLS.reduce((a, c) => a + c.metrics.interruptions, 0) / totalCalls;
  const avgMonologue =
    CALLS.reduce((a, c) => a + c.metrics.longestMonologueSec, 0) / totalCalls;
  const avgDiscovery =
    CALLS.reduce((a, c) => a + c.metrics.discoveryQuestions, 0) / totalCalls;
  const maxTypeCount = Math.max(...COACHING_BY_TYPE.map((t) => t.count));

  const scorecards = REPRESENTATIVES.map((rep) => {
    const calls = CALLS.filter((c) => c.repId === rep.id);
    const n = Math.max(1, calls.length);
    const talk = calls.reduce((a, c) => a + c.metrics.talkRatioRep, 0) / n;
    const interruptions = calls.reduce((a, c) => a + c.metrics.interruptions, 0) / n;
    const silences = calls.reduce((a, c) => a + c.metrics.longSilences, 0) / n;
    const monologue = calls.reduce((a, c) => a + c.metrics.longestMonologueSec, 0) / n;
    const discovery = calls.reduce((a, c) => a + c.metrics.discoveryQuestions, 0) / n;
    const typeCounts = new Map<string, number>();
    for (const c of calls)
      for (const f of c.findings)
        typeCounts.set(f.type, (typeCounts.get(f.type) ?? 0) + 1);
    const topTypes = [...typeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2);
    const findingsPerCall =
      calls.reduce((a, c) => a + c.findings.length, 0) / n;
    // simple composite for display ordering only — never shown as a blended judgment
    const strong = findingsPerCall < 2.5 && talk < 0.62;
    return {
      rep,
      calls: calls.length,
      talk,
      interruptions,
      silences,
      monologue,
      discovery,
      topTypes,
      findingsPerCall,
      strong,
    };
  }).sort((a, b) => a.findingsPerCall - b.findingsPerCall);

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-6 lg:px-8">
      <PageHeader
        title="Communication coaching"
        description="Timestamped, technique-level feedback. Objective metrics come straight from diarization; only language judgments use the model — and every finding pairs the moment with what to do instead."
      />

      {/* KPI row */}
      <Stagger className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Avg talk ratio (rep)"
          value={fmtPct(avgTalk)}
          deltaLabel="guideline ≤ 65%"
          icon={<MicVocal className="size-4" />}
        />
        <KpiCard
          label="Interruptions / call"
          value={avgInterruptions.toFixed(1)}
          deltaLabel="from diarization timestamps"
          icon={<Ear className="size-4" />}
        />
        <KpiCard
          label="Longest monologue (avg)"
          value={fmtDuration(Math.round(avgMonologue))}
          deltaLabel="target under 2:30"
          icon={<Timer className="size-4" />}
        />
        <KpiCard
          label="Discovery questions / call"
          value={avgDiscovery.toFixed(1)}
          deltaLabel="open questions asked"
          icon={<MessageCircleQuestion className="size-4" />}
        />
      </Stagger>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        {/* Trend */}
        <Reveal delay={0.1} className="lg:col-span-3">
          <Card className="h-full gap-4">
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-[15px]">Coaching trend, 8 weeks</CardTitle>
                <CardDescription>
                  Findings and interruptions per call — falling lines mean improving habits
                </CardDescription>
              </div>
              <ChartLegend
                items={[
                  { label: "Findings / call", color: "var(--chart-1)" },
                  { label: "Interruptions / call", color: "var(--chart-2)" },
                ]}
              />
            </CardHeader>
            <CardContent>
              <CoachingTrendChart height={250} />
            </CardContent>
          </Card>
        </Reveal>

        {/* Finding types */}
        <Reveal delay={0.15} className="lg:col-span-2">
          <Card className="h-full gap-4">
            <CardHeader>
              <CardTitle className="text-[15px]">Most common findings</CardTitle>
              <CardDescription>All coaching observations, 45 days</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {COACHING_BY_TYPE.map((t) => (
                <div key={t.type} className="flex items-center gap-3">
                  <span className="w-40 truncate text-[12.5px]">{t.type}</span>
                  <div className="h-4 flex-1 overflow-hidden rounded-[3px] bg-muted">
                    <div
                      className="h-full rounded-[3px] bg-chart-1"
                      style={{ width: `${(t.count / maxTypeCount) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-[12px] font-medium tabular-nums">
                    {t.count}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </Reveal>
      </div>

      {/* Scorecards */}
      <Reveal delay={0.2} className="mt-6">
        <div className="mb-3 flex items-baseline justify-between">
          <div>
            <h2 className="text-[15px] font-semibold">Coaching scorecards</h2>
            <p className="text-[12.5px] text-muted-foreground">
              Per-representative digest — recurring finding types and one or two concrete focus areas
            </p>
          </div>
        </div>
      </Reveal>
      <Stagger className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {scorecards.map((s) => (
          <Card key={s.rep.id} className="gap-0 py-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-2.5">
                <RepAvatar rep={s.rep} />
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-[13.5px] font-semibold">{s.rep.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {s.rep.team} · {s.calls} calls
                  </p>
                </div>
                {s.strong ? (
                  <Badge
                    variant="outline"
                    className="h-5 border-status-good/30 bg-status-good/10 text-[10px] font-medium text-status-good-fg"
                  >
                    Exemplar
                  </Badge>
                ) : null}
              </div>

              {/* Talk ratio */}
              <div className="mt-3.5">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Talk ratio</span>
                  <span className="tabular-nums">{fmtPct(s.talk)} rep</span>
                </div>
                <div className="mt-1 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
                  <div
                    className={cn(
                      "rounded-l-full",
                      s.talk > 0.68 ? "bg-status-serious" : "bg-chart-1",
                    )}
                    style={{ width: `${s.talk * 100}%` }}
                  />
                  <div className="flex-1 rounded-r-full bg-chart-2/50" />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
                {[
                  { label: "Interrupts", value: s.interruptions.toFixed(1), warn: s.interruptions > 5 },
                  { label: "Silences", value: s.silences.toFixed(1), warn: false },
                  { label: "Monologue", value: fmtDuration(Math.round(s.monologue)), warn: s.monologue > 150 },
                ].map((m) => (
                  <div key={m.label} className="rounded-md bg-muted/50 px-1 py-1.5">
                    <p className={cn("text-[13px] font-semibold tabular-nums", m.warn && "text-status-serious-fg")}>
                      {m.value}
                    </p>
                    <p className="text-[9.5px] text-muted-foreground">{m.label}</p>
                  </div>
                ))}
              </div>

              <Separator className="my-3" />
              <p className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
                Focus areas
              </p>
              <div className="mt-1.5 space-y-1.5">
                {s.topTypes.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground">
                    No recurring issues — keep reinforcing current habits.
                  </p>
                ) : (
                  s.topTypes.map(([type, count]) => (
                    <div key={type} className="flex items-center gap-1.5 text-[12px]">
                      <Lightbulb className="size-3 shrink-0 text-status-warning" />
                      <span className="truncate">{type}</span>
                      <span className="ml-auto tabular-nums text-muted-foreground">
                        ×{count}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <Link
                href={`/calls?rep=${s.rep.id}`}
                className="mt-3 flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
              >
                View {s.rep.name.split(" ")[0]}&rsquo;s calls <ArrowRight className="size-3" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </Stagger>

      {/* Empathy / objection panel */}
      <Reveal delay={0.25} className="mt-6">
        <Card className="gap-4">
          <CardHeader>
            <CardTitle className="text-[15px]">Where conversations turn</CardTitle>
            <CardDescription>
              Empathy gaps and mishandled objections are the two finding types most
              correlated with escalated calls — sampled moments below
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {CALLS.flatMap((c) =>
              c.findings
                .filter(
                  (f) =>
                    f.type === "Empathy gap" || f.type === "Mishandled objection",
                )
                .slice(0, 1)
                .map((f) => ({ call: c, f })),
            )
              .slice(0, 4)
              .map(({ call, f }) => (
                <div key={f.id} className="rounded-lg border bg-muted/30 p-3.5">
                  <div className="flex items-center gap-2 text-[12px]">
                    <Hourglass className="size-3.5 text-status-warning" />
                    <span className="font-medium">{f.type}</span>
                    <Link
                      href={`/calls/${call.id}`}
                      className="ml-auto font-mono text-[11px] text-primary hover:underline"
                    >
                      {call.reference}
                    </Link>
                  </div>
                  <p className="mt-2 border-l-2 border-border pl-2.5 text-[12.5px] italic text-muted-foreground">
                    &ldquo;{f.quote}&rdquo;
                  </p>
                  <p className="mt-2 text-[12.5px] leading-snug">
                    <span className="font-medium text-status-good-fg">Instead: </span>
                    {f.suggestion}
                  </p>
                </div>
              ))}
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}

export default function CoachingPage() {
  return <RoleGate admin={<AdminCoaching />} rep={<RepCoaching />} />;
}
