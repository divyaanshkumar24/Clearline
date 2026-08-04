export type RiskTier = "critical" | "high" | "medium" | "low";
export type ScoreLabel = "pass" | "flag" | "fail";
export type CallStatus = "pending" | "in_review" | "reviewed" | "escalated";
export type Severity = "critical" | "high" | "medium";

export interface Representative {
  id: string;
  name: string;
  initials: string;
  team: string;
  tenure: string;
  hue: number;
}

export interface Reviewer {
  id: string;
  name: string;
  initials: string;
  role: string;
}

export interface Criterion {
  id: string;
  code: string;
  name: string;
  description: string;
  severity: Severity;
  category: "Disclosure" | "Suitability" | "Prohibited Language" | "Conduct";
}

export interface RubricVersion {
  id: string;
  version: string;
  effectiveDate: string;
  author: string;
  status: "active" | "superseded" | "draft";
  changelog: string[];
  criteriaCount: number;
}

export interface Override {
  reviewerId: string;
  label: ScoreLabel;
  reason: string;
  timestamp: string;
}

export interface CriterionScore {
  criterionId: string;
  label: ScoreLabel;
  confidence: number; // 0..1
  evidenceTs: number; // seconds into call
  evidenceQuote: string;
  rationale: string;
  override?: Override;
}

export type FindingType =
  | "Weak discovery"
  | "Interruption"
  | "Long monologue"
  | "Empathy gap"
  | "Mishandled objection"
  | "Filler & hedging"
  | "Jargon-heavy explanation"
  | "Long silence";

export interface CoachingFinding {
  id: string;
  type: FindingType;
  ts: number;
  quote: string;
  suggestion: string;
  severity: "info" | "minor" | "major";
}

export interface AudioMetrics {
  talkRatioRep: number; // 0..1 share of rep talk time
  interruptions: number;
  longSilences: number;
  longestMonologueSec: number;
  fillerPerMin: number;
  discoveryQuestions: number;
}

export interface TranscriptSegment {
  speaker: "rep" | "client";
  start: number;
  end: number;
  text: string;
  /** ids of criterion scores or findings evidenced by this segment */
  evidenceOf?: string[];
}

export interface CallRecommendation {
  whatWentWrong: string;
  rootCause: string;
  repairSuggestion: string;
}

export interface CallPivotPoint {
  timestamp: number | null;
  description: string;
}

export interface Call {
  id: string;
  reference: string;
  repId: string;
  clientAlias: string;
  date: string; // ISO
  durationSec: number;
  source: "audio" | "transcript";
  product: string;
  riskTier: RiskTier;
  status: CallStatus;
  rubricVersionId: string;
  scores: CriterionScore[];
  findings: CoachingFinding[];
  metrics: AudioMetrics;
  reviewerId?: string;
  summary: string;
  adversarial?: boolean;
  /** Only present for calls analyzed live through /new-call — the LLM's root-cause/repair writeup. */
  recommendation?: CallRecommendation;
  /** Only present for calls analyzed live through /new-call. */
  pivotPoint?: CallPivotPoint;
  /**
   * Set for live calls where diarization separated fewer than two voices (or
   * couldn't tell rep from client). Speaker attribution on those calls is a
   * fallback, not a measurement, and the UI says so instead of presenting it
   * with the same confidence as a real two-party call.
   */
  speakerAttributionUnreliable?: boolean;
}

export interface ActivityEvent {
  id: string;
  type:
    | "call_audited"
    | "override"
    | "escalated"
    | "rubric_updated"
    | "export"
    | "reaudit";
  actor: string;
  detail: string;
  timestamp: string;
  callId?: string;
}
