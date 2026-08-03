"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AGREEMENT_BY_CRITERION,
  CALIBRATION,
  COACHING_TREND,
  RISK_DISTRIBUTION,
  TREND_30D,
  VIOLATIONS_BY_CRITERION,
} from "@/lib/derived";
import { TIER_META } from "@/lib/format";
import type { RiskTier } from "@/lib/types";

const TIER_COLOR: Record<RiskTier, string> = {
  critical: "var(--status-critical)",
  high: "var(--status-serious)",
  medium: "var(--status-warning)",
  low: "var(--status-good)",
};

/* Shared tooltip chrome */
function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number | string; color?: string }>;
  label?: string;
  formatter?: (v: number | string, name: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      {label ? <p className="mb-1.5 font-medium text-foreground">{label}</p> : null}
      <div className="space-y-1">
        {payload.map((p) => (
          <div key={p.name} className="flex items-center gap-2">
            <span
              className="size-2 rounded-[2px]"
              style={{ background: p.color }}
            />
            <span className="text-muted-foreground">{p.name}</span>
            <span className="ml-auto pl-4 font-medium tabular-nums text-foreground">
              {formatter ? formatter(p.value, p.name) : p.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Risk trend (stacked bars, 30d) ---------------- */

export function RiskTrendChart({ height = 240 }: { height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={TREND_30D} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} strokeDasharray="0" />
        <XAxis dataKey="day" tickLine={false} axisLine={false} interval={6} dy={4} />
        <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
        {(["low", "medium", "high", "critical"] as RiskTier[]).map((tier, i, arr) => (
          <Bar
            isAnimationActive={false}
            key={tier}
            dataKey={tier}
            name={TIER_META[tier].label}
            stackId="risk"
            fill={TIER_COLOR[tier]}
            stroke="var(--card)"
            strokeWidth={1}
            radius={i === arr.length - 1 ? [3, 3, 0, 0] : 0}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ---------------- Compliance rate line (30d) ---------------- */

export function ComplianceRateChart({ height = 240 }: { height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={TREND_30D} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="rateFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.22} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="day" tickLine={false} axisLine={false} interval={6} dy={4} />
        <YAxis
          domain={[50, 100]}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          content={<ChartTooltip formatter={(v) => `${v}%`} />}
          cursor={{ stroke: "var(--axis-ink)", strokeDasharray: "3 3" }}
        />
        <ReferenceLine
          y={90}
          stroke="var(--axis-ink)"
          strokeDasharray="4 4"
          label={{
            value: "Target 90%",
            position: "insideTopRight",
            fill: "var(--axis-ink)",
            fontSize: 10,
          }}
        />
        <Area
            isAnimationActive={false}
          type="monotone"
          dataKey="complianceRate"
          name="Compliance rate"
          stroke="var(--chart-1)"
          strokeWidth={2}
          fill="url(#rateFill)"
          connectNulls
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ---------------- Risk distribution donut ---------------- */

export function RiskDonut({ height = 200 }: { height?: number }) {
  const total = RISK_DISTRIBUTION.reduce((a, d) => a + d.count, 0);
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Tooltip content={<ChartTooltip />} />
          <Pie
            isAnimationActive={false}
            data={RISK_DISTRIBUTION.map((d) => ({
              name: TIER_META[d.tier].label,
              value: d.count,
              tier: d.tier,
            }))}
            dataKey="value"
            innerRadius="68%"
            outerRadius="92%"
            paddingAngle={2}
            strokeWidth={0}
          >
            {RISK_DISTRIBUTION.map((d) => (
              <Cell key={d.tier} fill={TIER_COLOR[d.tier]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-2xl font-semibold tabular-nums">{total}</p>
        <p className="text-[11px] text-muted-foreground">calls audited</p>
      </div>
    </div>
  );
}

/* ---------------- Violations horizontal bars ---------------- */

export function ViolationsChart({ height = 260 }: { height?: number }) {
  const data = VIOLATIONS_BY_CRITERION.map((v) => ({
    name: v.criterion.code,
    full: v.criterion.name,
    Fails: v.fails,
    Flags: v.flags,
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
        <CartesianGrid horizontal={false} />
        <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={44} />
        <Tooltip
          content={<ChartTooltip />}
          cursor={{ fill: "var(--muted)", opacity: 0.5 }}
        />
        <Bar isAnimationActive={false} dataKey="Fails" stackId="v" fill="var(--status-critical)" stroke="var(--card)" strokeWidth={1} />
        <Bar isAnimationActive={false} dataKey="Flags" stackId="v" fill="var(--status-warning)" stroke="var(--card)" strokeWidth={1} radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ---------------- Agreement per criterion ---------------- */

export function AgreementChart({ height = 260 }: { height?: number }) {
  const data = AGREEMENT_BY_CRITERION.map((a) => ({
    name: a.criterion.code,
    Agreement: Math.round(a.agreement * 100),
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }} barCategoryGap="35%">
        <CartesianGrid horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={44} />
        <Tooltip content={<ChartTooltip formatter={(v) => `${v}%`} />} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
        <ReferenceLine x={90} stroke="var(--axis-ink)" strokeDasharray="4 4" />
        <Bar isAnimationActive={false} dataKey="Agreement" fill="var(--chart-1)" radius={[0, 3, 3, 0]}>
          {data.map((d) => (
            <Cell
              key={d.name}
              fill={d.Agreement < 85 ? "var(--status-serious)" : "var(--chart-1)"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ---------------- Coaching trend ---------------- */

export function CoachingTrendChart({ height = 240 }: { height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={COACHING_TREND} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="week" tickLine={false} axisLine={false} dy={4} />
        <YAxis tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--axis-ink)", strokeDasharray: "3 3" }} />
        <Line
            isAnimationActive={false}
          type="monotone"
          dataKey="findingsPerCall"
          name="Findings / call"
          stroke="var(--chart-1)"
          strokeWidth={2}
          dot={false}
          connectNulls
          activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
        />
        <Line
            isAnimationActive={false}
          type="monotone"
          dataKey="interruptionsPerCall"
          name="Interruptions / call"
          stroke="var(--chart-2)"
          strokeWidth={2}
          dot={false}
          connectNulls
          activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ---------------- Calibration reliability ---------------- */

export function CalibrationChart({ height = 240 }: { height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={CALIBRATION} margin={{ top: 4, right: 4, left: -12, bottom: 0 }} barCategoryGap="32%">
        <CartesianGrid vertical={false} />
        <XAxis dataKey="bucket" tickLine={false} axisLine={false} dy={4} />
        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTooltip formatter={(v) => `${v}%`} />} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
        <Bar isAnimationActive={false} dataKey="stated" name="Stated confidence" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
        <Bar isAnimationActive={false} dataKey="observed" name="Observed accuracy" fill="var(--chart-2)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ---------------- Chart legend (identity, never color-alone) ---------------- */

export function ChartLegend({
  items,
}: {
  items: Array<{ label: string; color: string }>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <span className="size-2 rounded-[2px]" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

export const TIER_LEGEND = (["critical", "high", "medium", "low"] as RiskTier[]).map(
  (t) => ({ label: TIER_META[t].label, color: TIER_COLOR[t] }),
);
