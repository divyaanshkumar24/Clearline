import type {
  ActivityEvent,
  AudioMetrics,
  Call,
  CoachingFinding,
  Criterion,
  CriterionScore,
  FindingType,
  Representative,
  Reviewer,
  RiskTier,
  RubricVersion,
  ScoreLabel,
  TranscriptSegment,
} from "./types";

/* ------------------------------------------------------------------ */
/* Deterministic RNG so server and client render identical data        */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const BASE_DATE = new Date("2026-07-15T17:30:00Z").getTime();
const DAY = 86_400_000;

/* ------------------------------------------------------------------ */
/* Static entities                                                      */
/* ------------------------------------------------------------------ */

export const ORGANIZATION = {
  name: "Meridian Wealth Advisors",
  plan: "Enterprise",
  region: "US-East",
};

export const REPRESENTATIVES: Representative[] = [
  { id: "rep-01", name: "Sarah Okafor", initials: "SO", team: "Advisory East", tenure: "4y 2m", hue: 212 },
  { id: "rep-02", name: "Daniel Reyes", initials: "DR", team: "Advisory East", tenure: "2y 7m", hue: 158 },
  { id: "rep-03", name: "Priya Raman", initials: "PR", team: "Advisory West", tenure: "6y 1m", hue: 262 },
  { id: "rep-04", name: "Marcus Feldman", initials: "MF", team: "Wealth Direct", tenure: "1y 3m", hue: 32 },
  { id: "rep-05", name: "Elena Vasquez", initials: "EV", team: "Advisory West", tenure: "3y 9m", hue: 340 },
  { id: "rep-06", name: "Tom Whitaker", initials: "TW", team: "Wealth Direct", tenure: "0y 8m", hue: 12 },
  { id: "rep-07", name: "Grace Lindqvist", initials: "GL", team: "Advisory East", tenure: "5y 4m", hue: 190 },
  { id: "rep-08", name: "Andre Boateng", initials: "AB", team: "Wealth Direct", tenure: "2y 1m", hue: 96 },
];

/** Baseline propensity to violate — drives realistic variance across reps */
const REP_RISK: Record<string, number> = {
  "rep-01": 0.06,
  "rep-02": 0.16,
  "rep-03": 0.05,
  "rep-04": 0.3,
  "rep-05": 0.12,
  "rep-06": 0.38,
  "rep-07": 0.08,
  "rep-08": 0.2,
};

export const REVIEWERS: Reviewer[] = [
  { id: "rev-01", name: "Janet Moss", initials: "JM", role: "Chief Compliance Officer" },
  { id: "rev-02", name: "Omar Haddad", initials: "OH", role: "Senior Compliance Analyst" },
  { id: "rev-03", name: "Lucy Chen", initials: "LC", role: "Compliance Analyst" },
  { id: "rev-04", name: "Robert Ellison", initials: "RE", role: "Sales Quality Lead" },
];

export const CRITERIA: Criterion[] = [
  {
    id: "crit-01", code: "C-01", name: "Recording disclosure",
    description: "Representative informed the client at the start of the call that the conversation is recorded and monitored for quality and compliance.",
    severity: "critical", category: "Disclosure",
  },
  {
    id: "crit-02", code: "C-02", name: "Risk disclosure",
    description: "Material investment risks were disclosed before any recommendation, including the possibility of loss of principal.",
    severity: "critical", category: "Disclosure",
  },
  {
    id: "crit-03", code: "C-03", name: "Fee & commission disclosure",
    description: "All fees, commissions, and expense ratios relevant to the discussed products were disclosed clearly.",
    severity: "high", category: "Disclosure",
  },
  {
    id: "crit-04", code: "C-04", name: "Suitability — financial situation",
    description: "Representative gathered the client's income, assets, liabilities, and liquidity needs before recommending.",
    severity: "high", category: "Suitability",
  },
  {
    id: "crit-05", code: "C-05", name: "Suitability — objectives & horizon",
    description: "Investment objectives, risk tolerance, and time horizon were established and reflected in the recommendation.",
    severity: "medium", category: "Suitability",
  },
  {
    id: "crit-06", code: "C-06", name: "No guaranteed returns",
    description: "No statement guarantees, promises, or assures a specific investment return or characterizes an investment as risk-free.",
    severity: "critical", category: "Prohibited Language",
  },
  {
    id: "crit-07", code: "C-07", name: "No pressure tactics",
    description: "Client was not pressured with artificial urgency, scarcity claims, or repeated closes after a stated hesitation.",
    severity: "high", category: "Conduct",
  },
  {
    id: "crit-08", code: "C-08", name: "Fair & balanced presentation",
    description: "Benefits were balanced with limitations; comparisons to alternatives were not misleading.",
    severity: "medium", category: "Conduct",
  },
];

export const RUBRIC_VERSIONS: RubricVersion[] = [
  {
    id: "rub-25", version: "v2.5", effectiveDate: "—", author: "Janet Moss", status: "draft",
    changelog: [
      "Add C-09 'Complaint handling acknowledgement' (medium severity)",
      "Broaden C-06 prohibited phrases to include 'downside is capped'",
      "Clarify C-03 to require expense-ratio disclosure for ETF discussions",
    ],
    criteriaCount: 9,
  },
  {
    id: "rub-24", version: "v2.4", effectiveDate: "2026-06-01", author: "Janet Moss", status: "active",
    changelog: [
      "C-06 expanded: 'assured growth' and 'can't lose' added to prohibited list",
      "C-04 now requires liquidity-needs question explicitly",
      "Severity of C-07 raised from medium to high",
    ],
    criteriaCount: 8,
  },
  {
    id: "rub-23", version: "v2.3", effectiveDate: "2026-03-15", author: "Omar Haddad", status: "superseded",
    changelog: [
      "Split suitability into C-04 (financial situation) and C-05 (objectives)",
      "Added C-08 fair & balanced presentation",
    ],
    criteriaCount: 8,
  },
  {
    id: "rub-22", version: "v2.2", effectiveDate: "2026-01-05", author: "Janet Moss", status: "superseded",
    changelog: ["Initial 2026 review cycle: recording disclosure wording aligned to state two-party consent guidance"],
    criteriaCount: 7,
  },
];

/* ------------------------------------------------------------------ */
/* Evidence & finding content pools                                     */
/* ------------------------------------------------------------------ */

const EVIDENCE: Record<string, Record<ScoreLabel, string[]>> = {
  "crit-01": {
    pass: [
      "Just so you know, this call is recorded for quality and compliance purposes — is that alright?",
      "Before we start, I have to let you know this line is recorded and monitored.",
    ],
    flag: [
      "Oh — and calls here get recorded, by the way. Anyway, about that rollover…",
    ],
    fail: [
      "(No recording disclosure detected in the first 120 seconds or elsewhere in the call.)",
    ],
  },
  "crit-02": {
    pass: [
      "I do want to be clear that markets move both ways — you could get back less than you put in.",
      "These funds carry market risk, and past performance doesn't predict future results.",
    ],
    flag: [
      "There's some risk, sure, but honestly with this fund it's pretty minimal.",
      "It's about as safe as these things get — small print stuff, really.",
    ],
    fail: [
      "(No risk disclosure found prior to the recommendation at any point in the call.)",
    ],
  },
  "crit-03": {
    pass: [
      "The advisory fee is 0.85% annually, and the fund itself has a 0.12% expense ratio.",
      "So you're aware, I'm compensated through a 1% commission on this product.",
    ],
    flag: [
      "The fees are pretty standard — nothing you'd really notice.",
      "There's a small fee, we can go over the exact numbers some other time.",
    ],
    fail: [
      "(Fees and commissions were never mentioned despite two product recommendations.)",
    ],
  },
  "crit-04": {
    pass: [
      "Walk me through your current picture — income, savings, anything you owe?",
      "How much of this would you need to be able to access on short notice?",
    ],
    flag: [
      "You said you're comfortable financially, right? Great, so here's what I'd do…",
    ],
    fail: [
      "(No questions asked about income, assets, liabilities, or liquidity before recommending.)",
    ],
  },
  "crit-05": {
    pass: [
      "What are you actually investing for — retirement, a house, your kids?",
      "And when do you expect to need this money? Five years? Ten?",
    ],
    flag: [
      "I'll assume you're a long-term investor like most of my clients.",
    ],
    fail: [
      "(Objectives, risk tolerance, and horizon were never established.)",
    ],
  },
  "crit-06": {
    pass: [
      "I can't promise returns — nobody honestly can — but here's the historical range.",
    ],
    flag: [
      "Realistically you're looking at eight percent — that's basically what it does every year.",
      "I've never seen this one lose money for a client of mine.",
    ],
    fail: [
      "I can guarantee you a twelve percent return on this — it's a sure thing.",
      "You literally cannot lose money on this product. It's guaranteed to grow.",
      "This is a risk-free way to double your money by 2030 — I'd stake my license on it.",
    ],
  },
  "crit-07": {
    pass: [
      "No pressure at all — take the week, talk to your wife, and I'll call Friday.",
    ],
    flag: [
      "I'd hate for you to miss this — the allocation window closes Friday.",
      "Most people who wait on this end up regretting it, just saying.",
    ],
    fail: [
      "I need a yes from you today — this exact offer won't exist tomorrow, I promise you.",
      "Look, we've been on this call an hour. Let's just get it done now, okay? Don't overthink it.",
    ],
  },
  "crit-08": {
    pass: [
      "The upside is the tax deferral; the trade-off is the surrender period — seven years is real.",
    ],
    flag: [
      "Compared to your 401(k), this is better in pretty much every way that matters.",
      "The downsides are mostly theoretical, honestly.",
    ],
    fail: [
      "(Presentation covered benefits only; surrender charges and liquidity restrictions were omitted while comparing against the client's index fund.)",
    ],
  },
};

const RATIONALE: Record<string, Record<ScoreLabel, string>> = {
  "crit-01": {
    pass: "Clear recording disclosure delivered within the opening segment.",
    flag: "Disclosure present but delivered mid-call and rushed; wording ambiguous.",
    fail: "No recording disclosure found anywhere in the transcript.",
  },
  "crit-02": {
    pass: "Risk of loss stated explicitly before the recommendation.",
    flag: "Risk acknowledged but minimized in a way that could mislead.",
    fail: "Recommendation made with no accompanying risk disclosure.",
  },
  "crit-03": {
    pass: "Specific fee figures disclosed for each product discussed.",
    flag: "Fees referenced only vaguely; no figures given.",
    fail: "No fee or commission disclosure despite product recommendations.",
  },
  "crit-04": {
    pass: "Income, assets, and liquidity needs gathered before recommending.",
    flag: "Financial situation assumed from prior context rather than asked.",
    fail: "No financial-situation discovery before the recommendation.",
  },
  "crit-05": {
    pass: "Objectives and time horizon established and reflected in advice.",
    flag: "Horizon assumed without confirmation from the client.",
    fail: "Objectives and horizon never established.",
  },
  "crit-06": {
    pass: "No guaranteeing language; historical ranges framed correctly.",
    flag: "Language implies near-certain returns without an explicit guarantee.",
    fail: "Explicit guarantee of returns — prohibited under rubric C-06.",
  },
  "crit-07": {
    pass: "Client given time and space; no urgency tactics.",
    flag: "Artificial deadline implied after client hesitation.",
    fail: "Repeated same-call closes after stated hesitation; explicit urgency pressure.",
  },
  "crit-08": {
    pass: "Benefits balanced with concrete limitations.",
    flag: "Comparison one-sided; limitations downplayed.",
    fail: "Material limitations omitted during a direct product comparison.",
  },
};

const SUGGESTIONS: Record<FindingType, string[]> = {
  "Weak discovery": [
    "Replace the closed question with an open one: 'What would need to be true for you to feel good about this?'",
    "Ask about the why behind the goal before sizing the product — it changes the recommendation.",
  ],
  Interruption: [
    "Let the client land the thought — count one beat after they stop before responding.",
    "When you catch yourself interrupting, hand it back: 'Sorry — you were saying?'",
  ],
  "Long monologue": [
    "Break explanations over 60s with a check-in: 'Does that match what you were expecting?'",
    "Chunk the product explanation into three parts and confirm understanding between each.",
  ],
  "Empathy gap": [
    "Acknowledge the hesitation before answering it: 'It sounds like the lock-up period worries you — that's fair.'",
    "Name the emotion you heard before returning to the numbers.",
  ],
  "Mishandled objection": [
    "Clarify the objection before countering: 'When you say too risky, what's the scenario you're picturing?'",
    "Validate first, respond second — countering instantly reads as dismissive.",
  ],
  "Filler & hedging": [
    "Slow the delivery; a pause is stronger than 'sort of, kind of, basically'.",
    "Rehearse the fee explanation until it needs no hedging — clients hear hedging as doubt.",
  ],
  "Jargon-heavy explanation": [
    "Swap 'basis points' for dollars-per-year on their actual balance.",
    "Explain the product the way you would to a family member, then layer in precision.",
  ],
  "Long silence": [
    "After a question, silence is fine — but after a price quote, check in within 5 seconds.",
  ],
};

const FINDING_QUOTES: Record<FindingType, string[]> = {
  "Weak discovery": [
    "So you're happy with your current returns, yes or no?",
    "You'd say you're an aggressive investor, right?",
  ],
  Interruption: [
    "Client: 'What I'm worried about is—' Rep: 'Let me stop you right there.'",
    "Client: 'My wife thinks—' Rep: 'Sure, sure, but here's the thing.'",
  ],
  "Long monologue": [
    "(Representative spoke uninterrupted for 3m 40s while explaining the fund structure.)",
    "(Uninterrupted 2m 55s product walkthrough with no comprehension check.)",
  ],
  "Empathy gap": [
    "Client: 'Honestly this makes me nervous.' Rep: 'Okay so the next thing is the allocation…'",
    "Client: 'I lost a lot in 2022.' Rep: 'Right. Anyway, the fund's five-year numbers are…'",
  ],
  "Mishandled objection": [
    "Client: 'The fees seem high.' Rep: 'Not really. So, should we do the paperwork?'",
    "Client: 'I want to compare options.' Rep: 'There's nothing better out there, trust me.'",
  ],
  "Filler & hedging": [
    "It's, um, sort of like a, you know, kind of a growth-ish fund, basically.",
    "The fee is, like, basically pretty much around one percent, more or less.",
  ],
  "Jargon-heavy explanation": [
    "The sub-account wrapper nets out M&E at 125 bips against the accumulation value.",
    "We'd overweight duration on the fixed sleeve to capture convexity.",
  ],
  "Long silence": [
    "(11.2s silence after the client asked about early-withdrawal penalties.)",
  ],
};

const PRODUCTS = [
  "Variable Annuity — Pinnacle VII",
  "Managed Growth Portfolio",
  "Fixed Index Annuity — SecureBridge",
  "Retirement Income Fund",
  "ESG Balanced Fund",
  "529 Education Plan",
  "High-Yield Bond Ladder",
  "Roth IRA Conversion",
];

const CLIENT_ALIASES_SEED = 4821;

/* ------------------------------------------------------------------ */
/* Call generation                                                      */
/* ------------------------------------------------------------------ */

function pick<T>(rnd: () => number, arr: T[]): T {
  return arr[Math.floor(rnd() * arr.length)];
}

export function deriveTier(scores: CriterionScore[]): RiskTier {
  const crits = new Map(CRITERIA.map((c) => [c.id, c]));
  let flags = 0;
  let nonCriticalFail = false;
  for (const s of scores) {
    const label = s.override?.label ?? s.label;
    const sev = crits.get(s.criterionId)!.severity;
    if (label === "fail" && sev === "critical") return "critical";
    if (label === "fail") nonCriticalFail = true;
    if (label === "flag") flags++;
  }
  if (nonCriticalFail || flags >= 2) return "high";
  if (flags === 1) return "medium";
  return "low";
}

function makeCall(index: number): Call {
  const rnd = mulberry32(1000 + index * 7919);
  const rep = REPRESENTATIVES[Math.floor(rnd() * REPRESENTATIVES.length)];
  const risk = REP_RISK[rep.id];
  const daysAgo = Math.floor(45 * Math.pow(rnd(), 1.6)); // mild recency skew
  const hour = 9 + Math.floor(rnd() * 8);
  const minute = Math.floor(rnd() * 60);
  const date = new Date(BASE_DATE - daysAgo * DAY);
  date.setUTCHours(hour, minute, 0, 0);
  const durationSec = 420 + Math.floor(rnd() * 2400);
  const adversarial = index % 31 === 17; // a handful of adversarial corpus calls

  const scores: CriterionScore[] = CRITERIA.map((c) => {
    const r = rnd();
    const sevBoost = c.severity === "critical" ? 0.7 : 1;
    let label: ScoreLabel = "pass";
    if (r < risk * 0.45 * sevBoost) label = "fail";
    else if (r < risk * 1.35) label = "flag";
    const confBase = label === "pass" ? 0.86 : label === "flag" ? 0.68 : 0.78;
    const confidence = Math.min(0.99, Math.max(0.42, confBase + (rnd() - 0.5) * 0.24));
    return {
      criterionId: c.id,
      label,
      confidence: Math.round(confidence * 100) / 100,
      evidenceTs: Math.floor(rnd() * (durationSec - 60)) + 20,
      evidenceQuote: pick(rnd, EVIDENCE[c.id][label]),
      rationale: RATIONALE[c.id][label],
    };
  });

  // Reviewer overrides on ~14% of non-pass scores for reviewed calls
  const statusRoll = rnd();
  const status: Call["status"] =
    daysAgo === 0 && statusRoll < 0.6
      ? "pending"
      : statusRoll < 0.24
        ? "pending"
        : statusRoll < 0.38
          ? "in_review"
          : statusRoll < 0.92
            ? "reviewed"
            : "escalated";

  let reviewerId: string | undefined;
  if (status === "reviewed" || status === "escalated" || status === "in_review") {
    reviewerId = pick(rnd, REVIEWERS).id;
    for (const s of scores) {
      if (s.label !== "pass" && rnd() < 0.14 && status === "reviewed") {
        const newLabel: ScoreLabel = rnd() < 0.6 ? (s.label === "fail" ? "flag" : "pass") : "fail";
        s.override = {
          reviewerId,
          label: newLabel,
          reason: newLabel === "pass"
            ? "Evidence span is the client speaking, not the representative — model misattributed the speaker."
            : newLabel === "flag"
              ? "Language is borderline; intent reads as sloppy phrasing rather than a promised return."
              : "Downgrade too lenient — the repeated close after hesitation meets the fail bar.",
          timestamp: new Date(date.getTime() + (2 + rnd() * 30) * 3_600_000).toISOString(),
        };
      }
    }
  }

  const findingCount = Math.floor(rnd() * 2 + risk * 9);
  const types = Object.keys(SUGGESTIONS) as FindingType[];
  const findings: CoachingFinding[] = Array.from({ length: findingCount }, (_, i) => {
    const type = pick(rnd, types);
    return {
      id: `f-${index}-${i}`,
      type,
      ts: Math.floor(rnd() * (durationSec - 90)) + 40,
      quote: pick(rnd, FINDING_QUOTES[type]),
      suggestion: pick(rnd, SUGGESTIONS[type]),
      severity: (rnd() < 0.25 ? "major" : rnd() < 0.6 ? "minor" : "info") as CoachingFinding["severity"],
    };
  }).sort((a, b) => a.ts - b.ts);

  const metrics: AudioMetrics = {
    talkRatioRep: Math.round((0.45 + risk * 0.5 + (rnd() - 0.5) * 0.16) * 100) / 100,
    interruptions: Math.floor(rnd() * 3 + risk * 14),
    longSilences: Math.floor(rnd() * 4),
    longestMonologueSec: Math.floor(45 + rnd() * 90 + risk * 240),
    fillerPerMin: Math.round((1.2 + risk * 7 + rnd() * 2) * 10) / 10,
    discoveryQuestions: Math.max(0, Math.floor(9 - risk * 14 + rnd() * 4)),
  };

  const aliasRnd = mulberry32(CLIENT_ALIASES_SEED + index);
  const tier = deriveTier(scores);
  const failed = scores.filter((s) => (s.override?.label ?? s.label) === "fail");
  const flagged = scores.filter((s) => (s.override?.label ?? s.label) === "flag");

  const summary =
    tier === "critical"
      ? `Critical: ${failed.map((f) => CRITERIA.find((c) => c.id === f.criterionId)!.name.toLowerCase()).join("; ")}. Immediate review required.`
      : tier === "high"
        ? `Elevated: ${[...failed, ...flagged].slice(0, 2).map((f) => CRITERIA.find((c) => c.id === f.criterionId)!.name.toLowerCase()).join("; ")}.`
        : tier === "medium"
          ? `One flagged criterion (${flagged.map((f) => CRITERIA.find((c) => c.id === f.criterionId)!.code).join(", ")}); otherwise compliant.`
          : "Fully compliant. Strong disclosures and balanced presentation.";

  return {
    id: `call-${String(index + 1).padStart(4, "0")}`,
    reference: `CALL-26${String(700 + Math.floor(daysAgo / 30))}-${String(index + 1).padStart(4, "0")}`,
    repId: rep.id,
    clientAlias: `Client #${String(Math.floor(aliasRnd() * 9000) + 1000)}`,
    date: date.toISOString(),
    durationSec,
    source: rnd() < 0.82 ? "audio" : "transcript",
    product: pick(rnd, PRODUCTS),
    riskTier: tier,
    status,
    rubricVersionId: daysAgo > 40 ? "rub-23" : "rub-24",
    scores,
    findings,
    metrics,
    reviewerId,
    summary,
    adversarial,
  };
}

export const CALLS: Call[] = Array.from({ length: 240 }, (_, i) => makeCall(i)).sort(
  (a, b) => {
    const tierOrder: Record<RiskTier, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return tierOrder[a.riskTier] - tierOrder[b.riskTier] || +new Date(b.date) - +new Date(a.date);
  },
);

export function getCall(id: string): Call | undefined {
  return CALLS.find((c) => c.id === id);
}

export function getRep(id: string): Representative {
  return REPRESENTATIVES.find((r) => r.id === id)!;
}

export function getReviewer(id?: string): Reviewer | undefined {
  return REVIEWERS.find((r) => r.id === id);
}

export function getCriterion(id: string): Criterion {
  return CRITERIA.find((c) => c.id === id)!;
}

/* ------------------------------------------------------------------ */
/* Transcript generation (deterministic per call)                       */
/* ------------------------------------------------------------------ */

const REP_LINES = [
  "Thanks for making the time today — I know schedules are tight.",
  "Let me pull up your file… okay, I've got everything here.",
  "The way this fund works is that contributions are invested across a diversified sleeve of equities and fixed income.",
  "That's a fair question, and honestly one more people should ask.",
  "What I'd suggest is we start with the allocation review and go from there.",
  "Historically the strategy has returned somewhere in the six to nine percent range, though that varies year to year.",
  "You'd have full online access, and statements come quarterly.",
  "Let me walk you through the fee schedule so there are no surprises.",
  "If it helps, I can send a one-page summary after this call.",
  "There's a surrender period on this product, and I want to make sure you understand it before we go further.",
];

const CLIENT_LINES = [
  "Yeah, that works. I've been meaning to sort this out for a while.",
  "Mostly I just don't want a repeat of what happened to my portfolio in 2022.",
  "How does that compare to what I'm in right now?",
  "And what happens if I need the money earlier than planned?",
  "Okay. What are the fees on something like that?",
  "I'd want to talk it over with my spouse before deciding anything.",
  "That sounds reasonable, I suppose.",
  "Can you explain that part again? I didn't quite follow.",
  "We're hoping to retire around sixty-two, if the numbers work.",
  "I'm not looking to take big risks at this point in my life.",
];

export function getTranscript(call: Call): TranscriptSegment[] {
  const rnd = mulberry32(hashString(call.id));
  const segments: TranscriptSegment[] = [];
  let t = 0;
  const target = call.durationSec;

  // Anchor evidence quotes into the transcript at their timestamps
  const anchors = [
    ...call.scores
      .filter((s) => !s.evidenceQuote.startsWith("("))
      .map((s) => ({ ts: s.evidenceTs, text: s.evidenceQuote, id: s.criterionId, speaker: "rep" as const })),
    ...call.findings
      .filter((f) => !f.quote.startsWith("(") && !f.quote.includes("Client:"))
      .map((f) => ({ ts: f.ts, text: f.quote, id: f.id, speaker: "rep" as const })),
  ].sort((a, b) => a.ts - b.ts);

  let anchorIdx = 0;
  let turn: "rep" | "client" = "rep";
  segments.push({
    speaker: "rep",
    start: 0,
    end: 14,
    text: `Good ${rnd() < 0.5 ? "morning" : "afternoon"}, this is ${getRep(call.repId).name.split(" ")[0]} from ${ORGANIZATION.name}. How are you today?`,
  });
  t = 15;
  while (t < target - 30) {
    const dur = 6 + Math.floor(rnd() * 26);
    const anchor = anchorIdx < anchors.length && anchors[anchorIdx].ts <= t + dur ? anchors[anchorIdx] : null;
    if (anchor) {
      segments.push({
        speaker: anchor.speaker,
        start: t,
        end: t + dur,
        text: anchor.text,
        evidenceOf: [anchor.id],
      });
      anchorIdx++;
      turn = "client";
    } else {
      segments.push({
        speaker: turn,
        start: t,
        end: t + dur,
        text: turn === "rep" ? pick(rnd, REP_LINES) : pick(rnd, CLIENT_LINES),
      });
      turn = turn === "rep" ? "client" : "rep";
    }
    t += dur + 1 + Math.floor(rnd() * 3);
  }
  segments.push({
    speaker: "rep",
    start: t,
    end: Math.min(t + 12, target),
    text: "Thanks again for your time — I'll follow up with that summary by email. Take care.",
  });
  return segments;
}

/* ------------------------------------------------------------------ */
/* Activity feed                                                        */
/* ------------------------------------------------------------------ */

export const ACTIVITY: ActivityEvent[] = (() => {
  const rnd = mulberry32(777);
  const events: ActivityEvent[] = [];
  const recent = CALLS.filter((c) => +new Date(c.date) > BASE_DATE - 3 * DAY);
  const templates: Array<() => ActivityEvent | null> = [
    () => {
      const c = pick(rnd, recent);
      return {
        id: "", type: "call_audited", actor: "Audit engine",
        detail: `${c.reference} scored under rubric v2.4 — ${c.riskTier} tier`,
        timestamp: c.date, callId: c.id,
      };
    },
    () => {
      const c = pick(rnd, recent.filter((c) => c.scores.some((s) => s.override)));
      if (!c) return null;
      const s = c.scores.find((s) => s.override)!;
      return {
        id: "", type: "override", actor: getReviewer(s.override!.reviewerId)!.name,
        detail: `Override on ${c.reference}: ${getCriterion(s.criterionId).code} ${s.label} → ${s.override!.label}`,
        timestamp: s.override!.timestamp, callId: c.id,
      };
    },
    () => {
      const c = pick(rnd, recent.filter((c) => c.status === "escalated"));
      if (!c) return null;
      return {
        id: "", type: "escalated", actor: getReviewer(c.reviewerId)?.name ?? "Janet Moss",
        detail: `${c.reference} escalated to legal review — ${getCriterion(c.scores.find((s) => s.label === "fail")?.criterionId ?? "crit-06").name.toLowerCase()}`,
        timestamp: new Date(+new Date(c.date) + 4 * 3_600_000).toISOString(), callId: c.id,
      };
    },
    () => {
      const c = pick(rnd, recent);
      return {
        id: "", type: "export", actor: pick(rnd, REVIEWERS).name,
        detail: `Audit PDF exported for ${c.reference}`,
        timestamp: new Date(+new Date(c.date) + 9 * 3_600_000).toISOString(), callId: c.id,
      };
    },
  ];
  for (let i = 0; i < 14; i++) {
    const e = templates[i % templates.length]();
    if (e) events.push({ ...e, id: `evt-${i}` });
  }
  events.push({
    id: "evt-rubric", type: "rubric_updated", actor: "Janet Moss",
    detail: "Rubric v2.5 draft updated — C-09 complaint handling criterion added",
    timestamp: new Date(BASE_DATE - 26 * 3_600_000).toISOString(),
  });
  events.push({
    id: "evt-reaudit", type: "reaudit", actor: "Omar Haddad",
    detail: "Re-audit of 41 calls under rubric v2.4 completed — 3 calls changed tier",
    timestamp: new Date(BASE_DATE - 50 * 3_600_000).toISOString(),
  });
  return events.sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp)).slice(0, 12);
})();
