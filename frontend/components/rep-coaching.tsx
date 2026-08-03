"use client";

import Link from "next/link";
import { Ear, Lightbulb, MessageCircleQuestion, MicVocal, Sparkles, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { KpiCard, PageHeader } from "@/components/shared";
import { Reveal, Stagger } from "@/components/motion";
import { REP_PERSONA } from "@/components/role-context";
import { repStats } from "@/lib/derived";
import { fmtDuration, fmtPct, fmtTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";

export function RepCoaching() {
  const rep = REP_PERSONA;
  const stats = repStats(rep.id);
  const n = Math.max(1, stats.calls.length);
  const avgInterruptions =
    stats.calls.reduce((a, c) => a + c.metrics.interruptions, 0) / n;
  const avgMonologue =
    stats.calls.reduce((a, c) => a + c.metrics.longestMonologueSec, 0) / n;

  const recentFindings = stats.calls
    .flatMap((c) => c.findings.map((f) => ({ call: c, f })))
    .sort((a, b) => +new Date(b.call.date) - +new Date(a.call.date))
    .slice(0, 8);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 md:px-6 lg:px-8">
      <PageHeader
        title="My coaching"
        description="Timestamped feedback from your audited calls. Objective metrics come straight from the audio; every technique note pairs the moment with a concrete alternative."
      />

      <Stagger className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="My talk ratio"
          value={fmtPct(stats.avgTalkRatio)}
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
          value={stats.avgDiscovery.toFixed(1)}
          deltaLabel="open questions asked"
          icon={<MessageCircleQuestion className="size-4" />}
        />
      </Stagger>

      <Reveal delay={0.1} className="mt-4">
        <Card className="gap-3">
          <CardHeader>
            <CardTitle className="text-[15px]">Recent coaching moments</CardTitle>
            <CardDescription>
              Newest first, from your audited calls — click through to hear the moment in context
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentFindings.map(({ call, f }) => (
              <div
                key={f.id}
                className={cn(
                  "rounded-lg border p-3.5",
                  f.severity === "major" && "border-status-serious/40",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Lightbulb
                    className={cn(
                      "size-3.5",
                      f.severity === "major" ? "text-status-serious" : "text-status-warning",
                    )}
                  />
                  <p className="text-[13px] font-medium">{f.type}</p>
                  <Badge
                    variant="outline"
                    className="h-4.5 px-1.5 text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {f.severity}
                  </Badge>
                  <Link
                    href={`/calls/${call.id}`}
                    className="ml-auto font-mono text-[11px] text-primary hover:underline"
                  >
                    {call.reference} @ {fmtTimestamp(f.ts)}
                  </Link>
                </div>
                <p className="mt-1.5 border-l-2 border-border pl-2.5 text-[12.5px] italic text-muted-foreground">
                  &ldquo;{f.quote}&rdquo;
                </p>
                <div className="mt-2 flex gap-2 rounded-md bg-status-good/8 p-2.5 ring-1 ring-status-good/20">
                  <Sparkles className="mt-0.5 size-3.5 shrink-0 text-status-good-fg" />
                  <p className="text-[12.5px] leading-snug">{f.suggestion}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}
