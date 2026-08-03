import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Minus, SearchX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { LABEL_META, STATUS_META, TIER_META } from "@/lib/format";
import type { CallStatus, Representative, RiskTier, ScoreLabel } from "@/lib/types";

/* ---------------- Page header ---------------- */

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 pb-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {children ? <div className="flex items-center gap-2">{children}</div> : null}
    </div>
  );
}

/* ---------------- Badges ---------------- */

export function RiskBadge({ tier, className }: { tier: RiskTier; className?: string }) {
  const meta = TIER_META[tier];
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 font-medium", meta.className, className)}
    >
      <span className={cn("size-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </Badge>
  );
}

export function LabelBadge({ label, className }: { label: ScoreLabel; className?: string }) {
  const meta = LABEL_META[label];
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 font-medium", meta.className, className)}
    >
      <span className={cn("size-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </Badge>
  );
}

export function StatusChip({ status, className }: { status: CallStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <Badge variant="outline" className={cn("font-medium", meta.className, className)}>
      {meta.label}
    </Badge>
  );
}

/* ---------------- Rep avatar ---------------- */

export function RepAvatar({
  rep,
  size = "md",
  className,
}: {
  rep: Representative;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = { sm: "size-6 text-[10px]", md: "size-8 text-[11px]", lg: "size-10 text-sm" };
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        sizes[size],
        className,
      )}
      style={{
        background: `oklch(0.55 0.13 ${rep.hue})`,
      }}
      aria-hidden
    >
      {rep.initials}
    </div>
  );
}

/* ---------------- Confidence meter ---------------- */

export function ConfidenceMeter({
  value,
  calibrated = true,
  className,
}: {
  value: number;
  calibrated?: boolean;
  className?: string;
}) {
  const pct = Math.round(value * 100);
  const tone =
    value >= 0.8 ? "bg-status-good" : value >= 0.65 ? "bg-status-warning" : "bg-status-serious";
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span className={cn("flex items-center gap-2", className)} />}
      >
        <span className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
          <span
            className={cn("block h-full rounded-full transition-all", tone)}
            style={{ width: `${pct}%` }}
          />
        </span>
        <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
          {pct}%
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-56 text-xs">
        {calibrated
          ? `Calibrated confidence: ${pct}%. Verified against labeled evaluation data (reliability report, Jun 2026).`
          : `Raw model confidence: ${pct}% — not yet calibration-verified.`}
      </TooltipContent>
    </Tooltip>
  );
}

/* ---------------- KPI card ---------------- */

export function KpiCard({
  label,
  value,
  delta,
  deltaLabel,
  positiveIsGood = true,
  icon,
  footer,
}: {
  label: string;
  value: string;
  delta?: number;
  deltaLabel?: string;
  positiveIsGood?: boolean;
  icon?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const good = delta !== undefined && (positiveIsGood ? delta >= 0 : delta <= 0);
  return (
    <Card className="gap-0 py-0">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12.5px] font-medium text-muted-foreground">{label}</p>
          {icon ? <span className="text-muted-foreground/60">{icon}</span> : null}
        </div>
        <p className="mt-1.5 text-[26px] font-semibold leading-none tracking-tight tabular-nums">
          {value}
        </p>
        <div className="mt-2 flex items-center gap-1.5 text-[11.5px]">
          {delta !== undefined ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-medium",
                delta === 0
                  ? "text-muted-foreground"
                  : good
                    ? "text-status-good-fg"
                    : "text-status-critical-fg",
              )}
            >
              {delta === 0 ? (
                <Minus className="size-3" />
              ) : delta > 0 ? (
                <ArrowUpRight className="size-3" />
              ) : (
                <ArrowDownRight className="size-3" />
              )}
              {Math.abs(delta)}
              {deltaLabel?.startsWith("pt") ? deltaLabel : "%"}
            </span>
          ) : null}
          {deltaLabel && !deltaLabel.startsWith("pt") ? (
            <span className="text-muted-foreground">{deltaLabel}</span>
          ) : deltaLabel?.startsWith("pt") ? (
            <span className="text-muted-foreground">vs last week</span>
          ) : null}
          {footer}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- Empty state ---------------- */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-14 text-center",
        className,
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon ?? <SearchX className="size-5" />}
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description ? (
        <p className="max-w-sm text-[13px] text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
