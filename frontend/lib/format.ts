import type { RiskTier, ScoreLabel, CallStatus } from "./types";

export function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function fmtTimestamp(sec: number): string {
  return fmtDuration(sec);
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export function fmtRelative(iso: string): string {
  const now = new Date("2026-07-15T17:30:00Z").getTime();
  const diff = now - +new Date(iso);
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return fmtDate(iso);
}

export function fmtPct(n: number, digits = 0): string {
  return `${(n * 100).toFixed(digits)}%`;
}

export const TIER_META: Record<
  RiskTier,
  { label: string; className: string; dot: string }
> = {
  critical: {
    label: "Critical",
    className:
      "bg-status-critical/10 text-status-critical-fg border-status-critical/30",
    dot: "bg-status-critical",
  },
  high: {
    label: "High",
    className:
      "bg-status-serious/10 text-status-serious-fg border-status-serious/30",
    dot: "bg-status-serious",
  },
  medium: {
    label: "Medium",
    className:
      "bg-status-warning/10 text-status-warning-fg border-status-warning/40",
    dot: "bg-status-warning",
  },
  low: {
    label: "Low",
    className: "bg-status-good/10 text-status-good-fg border-status-good/30",
    dot: "bg-status-good",
  },
};

export const LABEL_META: Record<
  ScoreLabel,
  { label: string; className: string; dot: string }
> = {
  pass: {
    label: "Pass",
    className: "bg-status-good/10 text-status-good-fg border-status-good/30",
    dot: "bg-status-good",
  },
  flag: {
    label: "Flag",
    className:
      "bg-status-warning/10 text-status-warning-fg border-status-warning/40",
    dot: "bg-status-warning",
  },
  fail: {
    label: "Fail",
    className:
      "bg-status-critical/10 text-status-critical-fg border-status-critical/30",
    dot: "bg-status-critical",
  },
};

export const STATUS_META: Record<CallStatus, { label: string; className: string }> = {
  pending: {
    label: "Pending review",
    className: "bg-muted text-muted-foreground border-transparent",
  },
  in_review: {
    label: "In review",
    className: "bg-primary/10 text-primary border-primary/25",
  },
  reviewed: {
    label: "Reviewed",
    className: "bg-status-good/10 text-status-good-fg border-status-good/25",
  },
  escalated: {
    label: "Escalated",
    className:
      "bg-status-critical/10 text-status-critical-fg border-status-critical/30",
  },
};
