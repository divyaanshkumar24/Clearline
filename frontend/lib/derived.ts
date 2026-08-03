import { CALLS, CRITERIA, REPRESENTATIVES, getCriterion } from "./mock-data";
import type { Call, RiskTier, ScoreLabel } from "./types";

const DAY = 86_400_000;
const NOW = new Date("2026-07-15T17:30:00Z").getTime();

export function effectiveLabel(s: Call["scores"][number]): ScoreLabel {
  return s.override?.label ?? s.label;
}

export function callComplianceRate(call: Call): number {
  const pass = call.scores.filter((s) => effectiveLabel(s) === "pass").length;
  return pass / call.scores.length;
}

/* ---------------- KPIs ---------------- */

export const KPIS = (() => {
  const today = CALLS.filter((c) => NOW - +new Date(c.date) < DAY);
  const week = CALLS.filter((c) => NOW - +new Date(c.date) < 7 * DAY);
  const prevWeek = CALLS.filter((c) => {
    const age = NOW - +new Date(c.date);
    return age >= 7 * DAY && age < 14 * DAY;
  });
  const rate = (calls: Call[]) =>
    calls.length === 0
      ? 0
      : calls.reduce((a, c) => a + callComplianceRate(c), 0) / calls.length;

  const overrides = CALLS.flatMap((c) => c.scores).filter((s) => s.override);
  const reviewedScores = CALLS.filter((c) => c.status === "reviewed").flatMap((c) => c.scores);
  const agreement = 1 - overrides.length / Math.max(1, reviewedScores.length);

  return {
    auditedToday: today.length,
    auditedWeek: week.length,
    auditedDeltaPct: prevWeek.length
      ? Math.round(((week.length - prevWeek.length) / prevWeek.length) * 100)
      : 0,
    complianceRate: rate(week),
    complianceDelta: rate(week) - rate(prevWeek),
    highRiskOpen: CALLS.filter(
      (c) => (c.riskTier === "critical" || c.riskTier === "high") && c.status !== "reviewed",
    ).length,
    pendingReviews: CALLS.filter((c) => c.status === "pending" || c.status === "in_review").length,
    agreementRate: agreement,
    totalCalls: CALLS.length,
  };
})();

/* ---------------- Risk distribution ---------------- */

export const RISK_DISTRIBUTION: { tier: RiskTier; count: number }[] = (
  ["critical", "high", "medium", "low"] as RiskTier[]
).map((tier) => ({ tier, count: CALLS.filter((c) => c.riskTier === tier).length }));

/* ---------------- 30-day trend ---------------- */

export const TREND_30D = Array.from({ length: 30 }, (_, i) => {
  const dayStart = NOW - (29 - i) * DAY;
  const dayCalls = CALLS.filter((c) => {
    const t = +new Date(c.date);
    return t >= dayStart - DAY && t < dayStart;
  });
  // 5-day trailing window for a stable daily compliance-rate average
  const windowCalls = CALLS.filter((c) => {
    const t = +new Date(c.date);
    return t >= dayStart - 5 * DAY && t < dayStart;
  });
  const date = new Date(dayStart);
  const pct = (tier: RiskTier) => dayCalls.filter((c) => c.riskTier === tier).length;
  return {
    day: `${date.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${date.getUTCDate()}`,
    audited: dayCalls.length,
    complianceRate: windowCalls.length
      ? Math.round(
          (windowCalls.reduce((a, c) => a + callComplianceRate(c), 0) / windowCalls.length) * 100,
        )
      : null,
    critical: pct("critical"),
    high: pct("high"),
    medium: pct("medium"),
    low: pct("low"),
  };
});

/* ---------------- Leaderboard ---------------- */

export const LEADERBOARD = REPRESENTATIVES.map((rep) => {
  const calls = CALLS.filter((c) => c.repId === rep.id);
  const rate = calls.reduce((a, c) => a + callComplianceRate(c), 0) / Math.max(1, calls.length);
  const findingsPerCall =
    calls.reduce((a, c) => a + c.findings.length, 0) / Math.max(1, calls.length);
  const highRisk = calls.filter((c) => c.riskTier === "critical" || c.riskTier === "high").length;
  const talkRatio = calls.reduce((a, c) => a + c.metrics.talkRatioRep, 0) / Math.max(1, calls.length);
  return {
    rep,
    calls: calls.length,
    complianceRate: rate,
    findingsPerCall: Math.round(findingsPerCall * 10) / 10,
    highRisk,
    avgTalkRatio: Math.round(talkRatio * 100) / 100,
  };
}).sort((a, b) => b.complianceRate - a.complianceRate);

/* ---------------- Violations frequency ---------------- */

export const VIOLATIONS_BY_CRITERION = CRITERIA.map((crit) => {
  const scores = CALLS.flatMap((c) => c.scores.filter((s) => s.criterionId === crit.id));
  return {
    criterion: crit,
    fails: scores.filter((s) => effectiveLabel(s) === "fail").length,
    flags: scores.filter((s) => effectiveLabel(s) === "flag").length,
  };
}).sort((a, b) => b.fails + b.flags - (a.fails + a.flags));

/* ---------------- Model vs human agreement per criterion ---------------- */

export const AGREEMENT_BY_CRITERION = CRITERIA.map((crit) => {
  const reviewed = CALLS.filter((c) => c.status === "reviewed").flatMap((c) =>
    c.scores.filter((s) => s.criterionId === crit.id),
  );
  const overridden = reviewed.filter((s) => s.override).length;
  return {
    criterion: crit,
    reviewed: reviewed.length,
    overridden,
    agreement: reviewed.length ? 1 - overridden / reviewed.length : 1,
  };
}).sort((a, b) => a.agreement - b.agreement);

/* ---------------- Heatmap: rep × criterion issue rate ---------------- */

export const HEATMAP = REPRESENTATIVES.map((rep) => {
  const calls = CALLS.filter((c) => c.repId === rep.id);
  return {
    rep,
    cells: CRITERIA.map((crit) => {
      const scores = calls.flatMap((c) => c.scores.filter((s) => s.criterionId === crit.id));
      const bad = scores.filter((s) => effectiveLabel(s) !== "pass").length;
      return {
        criterion: crit,
        rate: scores.length ? bad / scores.length : 0,
      };
    }),
  };
});

/* ---------------- Coaching aggregates ---------------- */

export const COACHING_BY_TYPE = (() => {
  const map = new Map<string, number>();
  for (const c of CALLS) for (const f of c.findings) map.set(f.type, (map.get(f.type) ?? 0) + 1);
  return [...map.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
})();

export const COACHING_TREND = Array.from({ length: 8 }, (_, i) => {
  const weekStart = NOW - (7 - i) * 7 * DAY;
  const weekCalls = CALLS.filter((c) => {
    const t = +new Date(c.date);
    return t >= weekStart - 7 * DAY && t < weekStart;
  });
  const date = new Date(weekStart);
  return {
    week: `${date.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${date.getUTCDate()}`,
    findingsPerCall: weekCalls.length
      ? Math.round((weekCalls.reduce((a, c) => a + c.findings.length, 0) / weekCalls.length) * 10) / 10
      : null,
    interruptionsPerCall: weekCalls.length
      ? Math.round((weekCalls.reduce((a, c) => a + c.metrics.interruptions, 0) / weekCalls.length) * 10) / 10
      : null,
  };
});

/* ---------------- Per-representative stats (employee view) ---------------- */

export function repStats(repId: string) {
  const calls = CALLS.filter((c) => c.repId === repId);
  const n = Math.max(1, calls.length);
  const complianceRate = calls.reduce((a, c) => a + callComplianceRate(c), 0) / n;
  const rank =
    LEADERBOARD.findIndex((row) => row.rep.id === repId) + 1 || LEADERBOARD.length;
  const findingsPerCall = calls.reduce((a, c) => a + c.findings.length, 0) / n;
  const typeCounts = new Map<string, number>();
  for (const c of calls)
    for (const f of c.findings) typeCounts.set(f.type, (typeCounts.get(f.type) ?? 0) + 1);
  const topTypes = [...typeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const flagged = calls
    .filter((c) => c.riskTier !== "low")
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
  const clean = calls.filter((c) => c.riskTier === "low");
  return {
    calls,
    complianceRate,
    rank,
    totalReps: LEADERBOARD.length,
    findingsPerCall: Math.round(findingsPerCall * 10) / 10,
    avgTalkRatio: calls.reduce((a, c) => a + c.metrics.talkRatioRep, 0) / n,
    avgDiscovery: calls.reduce((a, c) => a + c.metrics.discoveryQuestions, 0) / n,
    topTypes,
    flagged,
    clean,
  };
}

export function repWeeklyTrend(repId: string) {
  return Array.from({ length: 8 }, (_, i) => {
    const weekStart = NOW - (7 - i) * 7 * DAY;
    const weekCalls = CALLS.filter((c) => {
      if (c.repId !== repId) return false;
      const t = +new Date(c.date);
      return t >= weekStart - 7 * DAY && t < weekStart;
    });
    const date = new Date(weekStart);
    return {
      week: `${date.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${date.getUTCDate()}`,
      compliance: weekCalls.length
        ? Math.round(
            (weekCalls.reduce((a, c) => a + callComplianceRate(c), 0) / weekCalls.length) * 100,
          )
        : null,
      findings: weekCalls.length
        ? Math.round(
            (weekCalls.reduce((a, c) => a + c.findings.length, 0) / weekCalls.length) * 10,
          ) / 10
        : null,
    };
  });
}

/* ---------------- Calibration (mock reliability report) ---------------- */

export const CALIBRATION = [
  { bucket: "50–60%", stated: 55, observed: 51, n: 84 },
  { bucket: "60–70%", stated: 65, observed: 62, n: 143 },
  { bucket: "70–80%", stated: 75, observed: 74, n: 267 },
  { bucket: "80–90%", stated: 85, observed: 87, n: 305 },
  { bucket: "90–100%", stated: 95, observed: 93, n: 225 },
];

export { getCriterion };
