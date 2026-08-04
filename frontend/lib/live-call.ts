import { deriveTier, getCriterion, getRep } from "./mock-data";
import type {
  AudioMetrics,
  Call,
  CoachingFinding,
  CriterionScore,
  Representative,
  TranscriptSegment,
} from "./types";

/**
 * The backend's compliance checks (src/stage3_recommendations/compliance.py) are the
 * same 8 criteria as the demo rubric, identified by semantic slugs instead of the
 * mock catalog's crit-01..crit-08 ids. Remapping lets a real call reuse the existing
 * Criterion catalog (name/description/severity/category) with no loss of fidelity.
 */
const BACKEND_CRITERION_ID_MAP: Record<string, string> = {
  recording_disclosure: "crit-01",
  risk_disclosure: "crit-02",
  fee_disclosure: "crit-03",
  suitability_needs_assessment: "crit-04",
  suitability_recommendation_fit: "crit-05",
  no_guaranteed_returns: "crit-06",
  no_pressure_tactics: "crit-07",
  fair_balanced_presentation: "crit-08",
};

function remapCriterionId(id: string): string {
  return BACKEND_CRITERION_ID_MAP[id] ?? id;
}

function normalizeSpeaker(raw: string | null | undefined): "rep" | "client" {
  // Backend labels the two parties "agent"/"client". Anything else (raw
  // diarization labels like SPEAKER_00, or null when speaker-overlap was
  // ambiguous — see stage2_diarization/roles.py) falls back to "rep".
  return raw === "client" ? "client" : "rep";
}

export const LIVE_REP: Representative = {
  id: "live",
  name: "You",
  initials: "ME",
  team: "This session",
  tenure: "—",
  hue: 210,
};

/** Rep for any call, mock or live. Live calls aren't in the mock roster. */
export function resolveRep(id: string): Representative {
  return id === LIVE_REP.id ? LIVE_REP : getRep(id);
}

interface BackendSegment {
  start: number;
  end: number;
  text: string;
  speaker: string | null;
}

interface BackendCriterionScore {
  criterionId: string;
  label: CriterionScore["label"];
  confidence: number;
  evidenceTs: number;
  evidenceQuote: string;
  rationale: string;
}

interface BackendCoachingFinding {
  id: string;
  type: CoachingFinding["type"];
  ts: number;
  quote: string;
  suggestion: string;
  severity: CoachingFinding["severity"];
}

interface BackendPivotPoint {
  turn_index: number | null;
  timestamp?: number;
  description: string;
}

interface BackendRecommendation {
  what_went_wrong: string;
  root_cause: string;
  repair_suggestion: string;
}

export interface BackendCallResult {
  call_id: string;
  /** Distinct voices diarization separated. 1 means every line is one speaker. */
  speaker_count?: number;
  /** False when the two parties couldn't be told apart as rep vs client. */
  roles_assigned?: boolean;
  segments: BackendSegment[];
  criterion_scores: BackendCriterionScore[];
  coaching_findings: BackendCoachingFinding[];
  pivot_point?: BackendPivotPoint;
  recommendation?: BackendRecommendation;
}

const FILLER_WORDS = /\b(um+|uh+|like|sort of|kind of|basically|you know)\b/gi;
const QUESTION_OPENERS =
  /^(what|how|why|when|where|which|do you|are you|would you|could you|can you)\b/i;

/** Objective metrics computed from the diarized transcript — no LLM involved. */
function deriveAudioMetrics(segments: TranscriptSegment[], durationSec: number): AudioMetrics {
  let repDuration = 0;
  let interruptions = 0;
  let longSilences = 0;
  let longestMonologueSec = 0;
  let fillerCount = 0;
  let discoveryQuestions = 0;
  let monologueSpeaker: TranscriptSegment["speaker"] | null = null;
  let monologueSec = 0;

  segments.forEach((seg, i) => {
    const dur = Math.max(0, seg.end - seg.start);
    const text = seg.text.trim();

    if (seg.speaker === "rep") {
      repDuration += dur;
      if (/\?\s*$/.test(text) || QUESTION_OPENERS.test(text)) discoveryQuestions++;
    }
    fillerCount += (text.match(FILLER_WORDS) ?? []).length;

    if (seg.speaker === monologueSpeaker) {
      monologueSec += dur;
    } else {
      monologueSpeaker = seg.speaker;
      monologueSec = dur;
    }
    longestMonologueSec = Math.max(longestMonologueSec, monologueSec);

    if (i > 0) {
      const prev = segments[i - 1];
      const gap = seg.start - prev.end;
      if (gap > 3) longSilences++;
      if (gap < 0.4 && prev.speaker !== seg.speaker) interruptions++;
    }
  });

  return {
    talkRatioRep: durationSec > 0 ? Math.round((repDuration / durationSec) * 100) / 100 : 0,
    interruptions,
    longSilences,
    longestMonologueSec: Math.round(longestMonologueSec),
    fillerPerMin:
      durationSec > 0 ? Math.round((fillerCount / (durationSec / 60)) * 10) / 10 : 0,
    discoveryQuestions,
  };
}

/** Turn the backend's raw pipeline result into the frontend's Call/TranscriptSegment shape. */
export function adaptLiveCall(result: BackendCallResult): {
  call: Call;
  transcript: TranscriptSegment[];
} {
  const durationSec = result.segments.reduce((max, s) => Math.max(max, s.end), 0);

  const scores: CriterionScore[] = result.criterion_scores.map((s) => ({
    criterionId: remapCriterionId(s.criterionId),
    label: s.label,
    confidence: s.confidence,
    evidenceTs: s.evidenceTs,
    evidenceQuote: s.evidenceQuote,
    rationale: s.rationale,
  }));

  const findings: CoachingFinding[] = result.coaching_findings.map((f) => ({ ...f }));

  // Backend guarantees evidenceTs/ts equal the exact start time of the transcript
  // segment the quote was verified against (see stage3_recommendations/compliance.py's
  // evidence-grounding invariant), so evidence links attach by exact timestamp match.
  const transcript: TranscriptSegment[] = result.segments.map((seg) => {
    const evidenceOf = [
      ...scores.filter((s) => s.evidenceTs === seg.start).map((s) => s.criterionId),
      ...findings.filter((f) => f.ts === seg.start).map((f) => f.id),
    ];
    return {
      speaker: normalizeSpeaker(seg.speaker),
      start: seg.start,
      end: seg.end,
      text: seg.text,
      ...(evidenceOf.length ? { evidenceOf } : {}),
    };
  });

  const metrics = deriveAudioMetrics(transcript, durationSec);
  const riskTier = deriveTier(scores);
  const failedNames = scores
    .filter((s) => s.label === "fail")
    .map((s) => getCriterion(s.criterionId).name.toLowerCase());
  const flaggedNames = scores
    .filter((s) => s.label === "flag")
    .map((s) => getCriterion(s.criterionId).name.toLowerCase());

  const summary =
    riskTier === "critical"
      ? `Critical: ${failedNames.join("; ")}. Immediate review required.`
      : riskTier === "high"
        ? `Elevated: ${[...failedNames, ...flaggedNames].slice(0, 2).join("; ")}.`
        : riskTier === "medium"
          ? "One flagged criterion; otherwise compliant."
          : "Fully compliant. Strong disclosures and balanced presentation.";

  const call: Call = {
    id: result.call_id,
    reference: `LIVE-${result.call_id.slice(0, 8).toUpperCase()}`,
    repId: LIVE_REP.id,
    clientAlias: "This client",
    date: new Date().toISOString(),
    durationSec,
    source: "audio",
    product: "New submission",
    riskTier,
    status: "pending",
    rubricVersionId: "rub-24",
    scores,
    findings,
    metrics,
    summary,
    adversarial: false,
    // Older results predate these fields; absent means "assume it was fine"
    // rather than warning on every previously analyzed call.
    speakerAttributionUnreliable:
      result.roles_assigned === false || (result.speaker_count ?? 2) < 2,
    ...(result.recommendation
      ? {
          recommendation: {
            whatWentWrong: result.recommendation.what_went_wrong,
            rootCause: result.recommendation.root_cause,
            repairSuggestion: result.recommendation.repair_suggestion,
          },
        }
      : {}),
    ...(result.pivot_point
      ? {
          pivotPoint: {
            timestamp: result.pivot_point.timestamp ?? null,
            description: result.pivot_point.description,
          },
        }
      : {}),
  };

  return { call, transcript };
}
