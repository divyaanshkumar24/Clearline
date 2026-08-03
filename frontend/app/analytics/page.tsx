import Link from "next/link";
import { Download, FileBarChart2, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AgreementChart,
  CalibrationChart,
  ChartLegend,
  RiskTrendChart,
  TIER_LEGEND,
  ViolationsChart,
} from "@/components/charts";
import { PageHeader, RepAvatar } from "@/components/shared";
import { Reveal } from "@/components/motion";
import { CRITERIA } from "@/lib/mock-data";
import { HEATMAP, LEADERBOARD } from "@/lib/derived";
import { fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AccessDenied, RoleGate } from "@/components/role-gate";

/* Sequential blue ramp (dataviz palette) for the heatmap */
const RAMP = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95"];
function rampColor(rate: number) {
  const idx = Math.min(RAMP.length - 1, Math.floor(rate * 1.6 * RAMP.length));
  return RAMP[idx];
}

const MONTHLY_REPORTS = [
  { month: "June 2026", calls: 214, rate: 0.87, overrides: 31, status: "Final" },
  { month: "May 2026", calls: 189, rate: 0.84, overrides: 42, status: "Final" },
  { month: "April 2026", calls: 176, rate: 0.81, overrides: 55, status: "Final" },
];

function AdminAnalytics() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-6 lg:px-8">
      <PageHeader
        title="Aggregate analytics"
        description="Where the system moves from auditing individual calls to organizational insight — recurring violations, drift, coaching trends, and a live record of where the model can be trusted."
      >
        <Button variant="outline" size="sm">
          <Download className="size-4" /> Export CSV
        </Button>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Risk trend */}
        <Reveal>
          <Card className="h-full gap-4">
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-[15px]">Organization risk trend</CardTitle>
                <CardDescription>Daily audited calls by risk tier, 30 days</CardDescription>
              </div>
              <ChartLegend items={TIER_LEGEND} />
            </CardHeader>
            <CardContent>
              <RiskTrendChart height={240} />
            </CardContent>
          </Card>
        </Reveal>

        {/* Violations */}
        <Reveal delay={0.05}>
          <Card className="h-full gap-4">
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-[15px]">Most common violations</CardTitle>
                <CardDescription>
                  Effective labels (after overrides) per criterion, 45 days
                </CardDescription>
              </div>
              <ChartLegend
                items={[
                  { label: "Fails", color: "var(--status-critical)" },
                  { label: "Flags", color: "var(--status-warning)" },
                ]}
              />
            </CardHeader>
            <CardContent>
              <ViolationsChart height={240} />
            </CardContent>
          </Card>
        </Reveal>

        {/* Agreement */}
        <Reveal delay={0.1}>
          <Card className="h-full gap-4">
            <CardHeader>
              <div className="flex items-center gap-1.5">
                <CardTitle className="text-[15px]">Model ↔ human agreement</CardTitle>
                <Tooltip>
                  <TooltipTrigger
                    render={<span className="text-muted-foreground" />}
                  >
                    <Info className="size-3.5" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-64 text-xs">
                    Share of reviewed judgments where the human reviewer kept the
                    model&rsquo;s label. Criteria below the 90% line are the priority
                    list for rubric prompt improvement.
                  </TooltipContent>
                </Tooltip>
              </div>
              <CardDescription>
                Per criterion, from the review-override log · dashed line = 90% target
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AgreementChart height={240} />
            </CardContent>
          </Card>
        </Reveal>

        {/* Calibration */}
        <Reveal delay={0.15}>
          <Card className="h-full gap-4">
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-[15px]">Confidence calibration</CardTitle>
                <CardDescription>
                  Reliability report from the evaluation harness — stated vs observed,
                  1,024 labeled judgments
                </CardDescription>
              </div>
              <ChartLegend
                items={[
                  { label: "Stated", color: "var(--chart-1)" },
                  { label: "Observed", color: "var(--chart-2)" },
                ]}
              />
            </CardHeader>
            <CardContent>
              <CalibrationChart height={240} />
              <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                <Badge
                  variant="outline"
                  className="h-4.5 border-status-good/30 bg-status-good/10 px-1.5 text-[9.5px] font-semibold uppercase text-status-good-fg"
                >
                  Verified
                </Badge>
                Max bucket deviation 4pts — confidence is surfaced to reviewers without recalibration.
              </p>
            </CardContent>
          </Card>
        </Reveal>
      </div>

      {/* Heatmap */}
      <Reveal delay={0.2} className="mt-4">
        <Card className="gap-4">
          <CardHeader>
            <CardTitle className="text-[15px]">
              Issue-rate heatmap — representative × criterion
            </CardTitle>
            <CardDescription>
              Share of calls with a flag or fail on each criterion. Darker cells show
              where playbook drift concentrates; each row is a coaching conversation
              waiting to happen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-separate border-spacing-0.5">
                <thead>
                  <tr>
                    <th className="w-44 pb-1 pr-3 text-left text-[11px] font-medium text-muted-foreground">
                      Representative
                    </th>
                    {CRITERIA.map((c) => (
                      <th
                        key={c.id}
                        className="pb-1 text-center font-mono text-[10.5px] font-medium text-muted-foreground"
                        title={c.name}
                      >
                        {c.code}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {HEATMAP.map((row) => (
                    <tr key={row.rep.id}>
                      <td className="whitespace-nowrap py-0.5 pr-3">
                        <span className="flex items-center gap-2 text-[12.5px]">
                          <RepAvatar rep={row.rep} size="sm" className="size-5 text-[9px]" />
                          {row.rep.name}
                        </span>
                      </td>
                      {row.cells.map((cell) => (
                        <td key={cell.criterion.id} className="p-0">
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <div
                                  className="flex h-8 min-w-14 items-center justify-center rounded-[3px] text-[10.5px] font-medium tabular-nums"
                                  style={{
                                    background: rampColor(cell.rate),
                                    color: cell.rate * 1.6 > 0.55 ? "#fff" : "#0b0b0b",
                                  }}
                                />
                              }
                            >
                              {cell.rate > 0 ? fmtPct(cell.rate) : "—"}
                            </TooltipTrigger>
                            <TooltipContent className="text-xs">
                              {row.rep.name} · {cell.criterion.name}:{" "}
                              {fmtPct(cell.rate)} of calls flagged or failed
                            </TooltipContent>
                          </Tooltip>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>0%</span>
              <div className="flex h-2 w-40 gap-px overflow-hidden rounded-full">
                {RAMP.map((c) => (
                  <span key={c} className="flex-1" style={{ background: c }} />
                ))}
              </div>
              <span>60%+</span>
            </div>
          </CardContent>
        </Card>
      </Reveal>

      {/* Rep comparison + monthly reports */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Reveal delay={0.25} className="lg:col-span-2">
          <Card className="h-full gap-3">
            <CardHeader>
              <CardTitle className="text-[15px]">Representative comparison</CardTitle>
              <CardDescription>Compliance and coaching side by side — different problems, different owners</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Representative</TableHead>
                      <TableHead className="text-right">Calls</TableHead>
                      <TableHead className="text-right">Compliance</TableHead>
                      <TableHead className="text-right">High-risk</TableHead>
                      <TableHead className="text-right">Findings / call</TableHead>
                      <TableHead className="text-right">Talk ratio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {LEADERBOARD.map((row) => (
                      <TableRow key={row.rep.id}>
                        <TableCell>
                          <span className="flex items-center gap-2 text-[13px]">
                            <RepAvatar rep={row.rep} size="sm" />
                            {row.rep.name}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{row.calls}</TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-medium tabular-nums",
                            row.complianceRate >= 0.9
                              ? "text-status-good-fg"
                              : row.complianceRate < 0.8
                                ? "text-status-critical-fg"
                                : "",
                          )}
                        >
                          {fmtPct(row.complianceRate)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{row.highRisk}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.findingsPerCall}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtPct(row.avgTalkRatio)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal delay={0.3}>
          <Card className="h-full gap-3">
            <CardHeader>
              <CardTitle className="text-[15px]">Monthly reports</CardTitle>
              <CardDescription>Signed compliance summaries</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {MONTHLY_REPORTS.map((r) => (
                <Link
                  key={r.month}
                  href="/export"
                  className="group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50"
                >
                  <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <FileBarChart2 className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="text-[13px] font-medium">{r.month}</p>
                    <p className="text-[11.5px] text-muted-foreground">
                      {r.calls} calls · {fmtPct(r.rate)} compliant · {r.overrides} overrides
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    {r.status}
                  </Badge>
                  <Download className="size-3.5 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
                </Link>
              ))}
              <p className="pt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                July 2026 report generates on Aug 1 and will include the rubric v2.4
                re-audit diff as an appendix.
              </p>
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return <RoleGate admin={<AdminAnalytics />} rep={<AccessDenied screen="Aggregate analytics" />} />;
}
