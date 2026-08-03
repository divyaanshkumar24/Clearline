import Link from "next/link";
import {
  ArrowRight,
  FileDown,
  Flame,
  GitPullRequestArrow,
  ListChecks,
  PhoneCall,
  RefreshCcw,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import { ButtonLink } from "@/components/button-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ChartLegend,
  ComplianceRateChart,
  RiskDonut,
  RiskTrendChart,
  TIER_LEGEND,
} from "@/components/charts";
import { KpiCard, PageHeader, RepAvatar, RiskBadge } from "@/components/shared";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { ACTIVITY, CALLS, getRep } from "@/lib/mock-data";
import { KPIS, LEADERBOARD, RISK_DISTRIBUTION } from "@/lib/derived";
import { fmtPct, fmtRelative, TIER_META } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RoleGate } from "@/components/role-gate";
import { RepDashboard } from "@/components/rep-dashboard";

const ACTIVITY_ICON: Record<string, React.ReactNode> = {
  call_audited: <PhoneCall className="size-3.5" />,
  override: <GitPullRequestArrow className="size-3.5" />,
  escalated: <Flame className="size-3.5" />,
  rubric_updated: <ShieldCheck className="size-3.5" />,
  export: <FileDown className="size-3.5" />,
  reaudit: <RefreshCcw className="size-3.5" />,
};

function AdminDashboard() {
  const topRisk = CALLS.filter((c) => c.riskTier === "critical").slice(0, 4);

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-6 lg:px-8">
      <PageHeader
        title="Good afternoon, Janet"
        description="Every call audited, ranked by risk. Here's where reviewer attention should go today — Tuesday, July 15."
      >
        <ButtonLink variant="outline" size="sm" href="/export">
          <FileDown className="size-4" /> Monthly report
        </ButtonLink>
        <ButtonLink size="sm" href="/review">
          <ListChecks className="size-4" /> Open review queue
        </ButtonLink>
      </PageHeader>

      {/* KPI row */}
      <Stagger className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StaggerItem>
          <KpiCard
            label="Calls audited today"
            value={String(KPIS.auditedToday)}
            delta={KPIS.auditedDeltaPct}
            deltaLabel="vs last week"
            icon={<PhoneCall className="size-4" />}
          />
        </StaggerItem>
        <StaggerItem>
          <KpiCard
            label="Compliance rate (7d)"
            value={fmtPct(KPIS.complianceRate)}
            delta={Math.round(KPIS.complianceDelta * 100)}
            deltaLabel="pts"
            icon={<ShieldCheck className="size-4" />}
          />
        </StaggerItem>
        <StaggerItem>
          <KpiCard
            label="High-risk open"
            value={String(KPIS.highRiskOpen)}
            deltaLabel="awaiting human decision"
            icon={<Flame className="size-4" />}
          />
        </StaggerItem>
        <StaggerItem>
          <KpiCard
            label="Pending reviews"
            value={String(KPIS.pendingReviews)}
            deltaLabel="ordered by risk tier"
            icon={<ListChecks className="size-4" />}
          />
        </StaggerItem>
        <StaggerItem>
          <KpiCard
            label="Model ↔ human agreement"
            value={fmtPct(KPIS.agreementRate, 1)}
            deltaLabel="on reviewed judgments"
            icon={<UserRoundCheck className="size-4" />}
          />
        </StaggerItem>
        <StaggerItem>
          <KpiCard
            label="Total calls (45d)"
            value={String(KPIS.totalCalls)}
            deltaLabel="rubric v2.4 · calibrated"
            icon={<RefreshCcw className="size-4" />}
          />
        </StaggerItem>
      </Stagger>

      {/* Charts row */}
      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Reveal delay={0.1} className="lg:col-span-3">
          <Card className="h-full gap-4">
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-[15px]">Risk mix, last 30 days</CardTitle>
                <CardDescription>
                  Daily audited volume, stacked by derived risk tier
                </CardDescription>
              </div>
              <ChartLegend items={TIER_LEGEND} />
            </CardHeader>
            <CardContent>
              <RiskTrendChart height={230} />
            </CardContent>
          </Card>
        </Reveal>
        <Reveal delay={0.15} className="lg:col-span-2">
          <Card className="h-full gap-4">
            <CardHeader>
              <CardTitle className="text-[15px]">Compliance rate trend</CardTitle>
              <CardDescription>Share of criteria passed, daily average</CardDescription>
            </CardHeader>
            <CardContent>
              <ComplianceRateChart height={230} />
            </CardContent>
          </Card>
        </Reveal>
      </div>

      {/* Middle row: donut + high risk + leaderboard */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Reveal delay={0.2}>
          <Card className="h-full gap-2">
            <CardHeader>
              <CardTitle className="text-[15px]">Risk distribution</CardTitle>
              <CardDescription>All audited calls, current tiers</CardDescription>
            </CardHeader>
            <CardContent>
              <RiskDonut height={190} />
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
                {RISK_DISTRIBUTION.map((d) => (
                  <div key={d.tier} className="flex items-center gap-2 text-[12.5px]">
                    <span className={cn("size-2 rounded-[2px]", TIER_META[d.tier].dot)} />
                    <span className="text-muted-foreground">{TIER_META[d.tier].label}</span>
                    <span className="ml-auto font-medium tabular-nums">{d.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal delay={0.25}>
          <Card className="h-full gap-3">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-[15px]">Needs attention first</CardTitle>
                <CardDescription>Critical-tier calls awaiting review</CardDescription>
              </div>
              <ButtonLink variant="ghost" size="sm" className="text-primary" href="/calls">
                All calls <ArrowRight className="size-3.5" />
              </ButtonLink>
            </CardHeader>
            <CardContent className="space-y-1">
              {topRisk.map((call) => {
                const rep = getRep(call.repId);
                return (
                  <Link
                    key={call.id}
                    href={`/calls/${call.id}`}
                    className="group flex items-center gap-3 rounded-lg border border-transparent px-2.5 py-2 transition-colors hover:border-border hover:bg-accent/50"
                  >
                    <RepAvatar rep={rep} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-[11.5px] font-medium">
                          {call.reference}
                        </p>
                        <RiskBadge tier={call.riskTier} className="h-4.5 px-1.5 text-[10px]" />
                      </div>
                      <p className="truncate text-[12px] text-muted-foreground">
                        {call.summary}
                      </p>
                    </div>
                    <ArrowRight className="size-3.5 shrink-0 text-muted-foreground/0 transition-all group-hover:text-muted-foreground" />
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        </Reveal>

        <Reveal delay={0.3}>
          <Card className="h-full gap-3">
            <CardHeader>
              <CardTitle className="text-[15px]">Representative leaderboard</CardTitle>
              <CardDescription>Compliance rate across audited calls (45d)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {LEADERBOARD.slice(0, 6).map((row, i) => (
                <div key={row.rep.id} className="flex items-center gap-3">
                  <span className="w-4 text-center text-[11px] font-medium text-muted-foreground tabular-nums">
                    {i + 1}
                  </span>
                  <RepAvatar rep={row.rep} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-[13px] font-medium">{row.rep.name}</p>
                      <span className="text-[12px] font-semibold tabular-nums">
                        {fmtPct(row.complianceRate)}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          row.complianceRate >= 0.9
                            ? "bg-status-good"
                            : row.complianceRate >= 0.8
                              ? "bg-status-warning"
                              : "bg-status-serious",
                        )}
                        style={{ width: `${row.complianceRate * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </Reveal>
      </div>

      {/* Activity timeline */}
      <Reveal delay={0.35} className="mt-4">
        <Card className="gap-3">
          <CardHeader>
            <CardTitle className="text-[15px]">Recent activity</CardTitle>
            <CardDescription>
              Audits, overrides, escalations, and rubric events across the organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative space-y-0">
              {ACTIVITY.slice(0, 8).map((event, i, arr) => (
                <div key={event.id} className="relative flex gap-3.5 pb-4 last:pb-0">
                  {i < arr.length - 1 ? (
                    <span className="absolute left-[13px] top-7 h-full w-px bg-border" />
                  ) : null}
                  <div
                    className={cn(
                      "z-10 flex size-7 shrink-0 items-center justify-center rounded-full border bg-card",
                      event.type === "escalated"
                        ? "border-status-critical/40 text-status-critical-fg"
                        : event.type === "override"
                          ? "border-status-warning/50 text-status-warning-fg"
                          : "text-muted-foreground",
                    )}
                  >
                    {ACTIVITY_ICON[event.type]}
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-[13px] leading-snug">
                      <span className="font-medium">{event.actor}</span>{" "}
                      <span className="text-muted-foreground">— {event.detail}</span>
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-muted-foreground/80">
                      <span>{fmtRelative(event.timestamp)}</span>
                      {event.callId ? (
                        <>
                          <Separator orientation="vertical" className="h-3" />
                          <Link
                            href={`/calls/${event.callId}`}
                            className="font-medium text-primary hover:underline"
                          >
                            View call
                          </Link>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}

export default function DashboardPage() {
  return <RoleGate admin={<AdminDashboard />} rep={<RepDashboard />} />;
}
