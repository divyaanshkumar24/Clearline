"use client";

import Link from "next/link";
import {
  ArrowRight,
  Award,
  Lightbulb,
  MessageCircleQuestion,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChartLegend } from "@/components/charts";
import { KpiCard, PageHeader, RiskBadge, StatusChip } from "@/components/shared";
import { Reveal, Stagger } from "@/components/motion";
import { REP_PERSONA } from "@/components/role-context";
import { SUGGESTION_LOOKUP } from "@/lib/rep-content";
import { repStats, repWeeklyTrend } from "@/lib/derived";
import { fmtDateTime, fmtDuration, fmtPct } from "@/lib/format";

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export function RepDashboard() {
  const rep = REP_PERSONA;
  const stats = repStats(rep.id);
  const trend = repWeeklyTrend(rep.id);
  const attention = stats.flagged.slice(0, 4);

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-6 lg:px-8">
      <PageHeader
        title={`Good afternoon, ${rep.name.split(" ")[0]}`}
        description="Your personal audit results and coaching feedback. Every finding points to the exact moment in the call — nothing here is a vague grade."
      />

      <Stagger className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="My compliance rate (45d)"
          value={fmtPct(stats.complianceRate)}
          deltaLabel="criteria passed across my calls"
          icon={<ShieldCheck className="size-4" />}
        />
        <KpiCard
          label="My calls audited"
          value={String(stats.calls.length)}
          deltaLabel="every call, same standard"
          icon={<PhoneCall className="size-4" />}
        />
        <KpiCard
          label="Coaching findings / call"
          value={String(stats.findingsPerCall)}
          deltaLabel="lower is better"
          icon={<Lightbulb className="size-4" />}
        />
        <KpiCard
          label="Team standing"
          value={ordinal(stats.rank)}
          deltaLabel={`of ${stats.totalReps} representatives`}
          icon={<Award className="size-4" />}
        />
      </Stagger>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        {/* Personal trend */}
        <Reveal delay={0.08} className="lg:col-span-3">
          <Card className="h-full gap-4">
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-[15px]">My 8-week trend</CardTitle>
                <CardDescription>
                  Weekly compliance rate and coaching findings per call
                </CardDescription>
              </div>
              <ChartLegend
                items={[
                  { label: "Compliance %", color: "var(--chart-1)" },
                  { label: "Findings / call", color: "var(--chart-2)" },
                ]}
              />
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={230}>
                <LineChart data={trend} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="week" tickLine={false} axisLine={false} dy={4} />
                  <YAxis tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip
                    cursor={{ stroke: "var(--axis-ink)", strokeDasharray: "3 3" }}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <ReferenceLine y={90} stroke="var(--axis-ink)" strokeDasharray="4 4" />
                  <Line
                    isAnimationActive={false}
                    type="monotone"
                    dataKey="compliance"
                    name="Compliance %"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                    activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                  />
                  <Line
                    isAnimationActive={false}
                    type="monotone"
                    dataKey="findings"
                    name="Findings / call"
                    stroke="var(--chart-2)"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                    activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Reveal>

        {/* Focus areas */}
        <Reveal delay={0.12} className="lg:col-span-2">
          <Card className="h-full gap-3">
            <CardHeader>
              <CardTitle className="text-[15px]">My focus areas</CardTitle>
              <CardDescription>
                Your most recurring coaching findings, with what to do instead
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {stats.topTypes.map(([type, count]) => (
                <div key={type} className="rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center gap-2 text-[13px] font-medium">
                    <Lightbulb className="size-3.5 text-status-warning" />
                    {type}
                    <Badge variant="secondary" className="ml-auto text-[10px] tabular-nums">
                      ×{count} in 45d
                    </Badge>
                  </div>
                  <p className="mt-1.5 flex gap-2 text-[12.5px] leading-snug text-muted-foreground">
                    <Sparkles className="mt-0.5 size-3.5 shrink-0 text-status-good-fg" />
                    {SUGGESTION_LOOKUP[type as keyof typeof SUGGESTION_LOOKUP] ??
                      "Review flagged moments in your recent calls."}
                  </p>
                </div>
              ))}
              <p className="flex items-center gap-1.5 pt-1 text-[12px] text-muted-foreground">
                <TrendingUp className="size-3.5" />
                {stats.clean.length} of your calls were fully compliant — keep those habits.
              </p>
            </CardContent>
          </Card>
        </Reveal>
      </div>

      {/* Calls needing attention */}
      <Reveal delay={0.16} className="mt-4">
        <Card className="gap-3">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-[15px]">My flagged calls</CardTitle>
              <CardDescription>
                Calls where the audit raised something — open one to see the exact moment
              </CardDescription>
            </div>
            <Link
              href="/calls"
              className="flex items-center gap-1 text-[12.5px] font-medium text-primary hover:underline"
            >
              All my calls <ArrowRight className="size-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-2">
            {attention.map((call) => (
              <Link
                key={call.id}
                href={`/calls/${call.id}`}
                className="group flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-accent/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-[11.5px] font-medium">{call.reference}</p>
                    <RiskBadge tier={call.riskTier} className="h-4.5 px-1.5 text-[10px]" />
                    <StatusChip status={call.status} className="h-4.5 px-1.5 text-[10px]" />
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                    {fmtDateTime(call.date)} · {fmtDuration(call.durationSec)} · {call.product}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <MessageCircleQuestion className="size-3.5" />
                  {call.findings.length}
                </div>
                <ArrowRight className="size-3.5 shrink-0 text-muted-foreground/0 transition-all group-hover:text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}
