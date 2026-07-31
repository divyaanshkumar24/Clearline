"""Part F: compliance criterion scoring + coaching findings, grounded in real
transcript evidence.

Output matches the Clearline frontend's TypeScript types exactly (camelCase field
names, not this project's usual snake_case) — see lib/types.ts in the frontend repo:

    type ScoreLabel = "pass" | "flag" | "fail"
    interface CriterionScore { criterionId, label, confidence, evidenceTs, evidenceQuote, rationale }
    type FindingType = "Weak discovery" | "Interruption" | "Long monologue" | "Empathy gap"
                      | "Mishandled objection" | "Filler & hedging" | "Jargon-heavy explanation" | "Long silence"
    interface CoachingFinding { id, type, ts, quote, suggestion, severity }

This is a SEPARATE structured LLM call from generate_recommendation() — see the
module docstring there / README for the trade-off (smaller, single-purpose schemas
are more reliable on an open model than one call covering everything, and it lets
this call's strict evidence-grounding retry loop run independently of the
already-reliable recommendation call).

evidenceTs/ts are never trusted from the model: after validating that
evidenceQuote/quote is a real verbatim (whitespace-normalized) substring of the
transcript, the timestamp is always overwritten with the real start time of
whichever segment contains that quote. Timestamp correctness is enforced as an
invariant of this code, not something we hope the model gets right.
"""

import json
import time
import uuid
from typing import Dict, List, Optional, Tuple

import openai

from .recommendation import MODEL, _format_transcript, _get_client

COMPLIANCE_CRITERIA = [
    {
        "id": "recording_disclosure",
        "description": "Agent disclosed that the call may be recorded and/or monitored.",
    },
    {
        "id": "risk_disclosure",
        "description": "Agent disclosed the risks associated with the product/investment being discussed.",
    },
    {
        "id": "fee_disclosure",
        "description": "Agent disclosed the fees or costs associated with the product/service.",
    },
    {
        "id": "suitability_needs_assessment",
        "description": "Agent assessed the client's financial situation, goals, or needs before recommending anything.",
    },
    {
        "id": "suitability_recommendation_fit",
        "description": "Agent's recommendation was consistent with the client's stated needs, goals, and risk tolerance.",
    },
    {
        "id": "no_guaranteed_returns",
        "description": "Agent did not guarantee or promise investment returns or outcomes.",
    },
    {
        "id": "no_pressure_tactics",
        "description": "Agent did not use high-pressure or urgency-based sales tactics.",
    },
    {
        "id": "fair_balanced_presentation",
        "description": "Agent presented both benefits and risks/downsides in a fair, balanced way rather than one-sided.",
    },
]
CRITERION_IDS = {c["id"] for c in COMPLIANCE_CRITERIA}

FINDING_TYPES = [
    "Weak discovery",
    "Interruption",
    "Long monologue",
    "Empathy gap",
    "Mishandled objection",
    "Filler & hedging",
    "Jargon-heavy explanation",
    "Long silence",
]

SCORE_LABELS = {"pass", "flag", "fail"}
SEVERITIES = {"info", "minor", "major"}

COMPLIANCE_SYSTEM_PROMPT = (
    "You are a compliance and coaching analyst reviewing a call transcript between "
    "an agent and a client. You will score the call against a fixed list of "
    "compliance criteria and identify coaching findings, then call the "
    "submit_compliance_review tool with your analysis — do not respond with plain text.\n\n"
    "CRITICAL RULE: every `evidenceQuote` and every `quote` value you produce MUST be "
    "copied character-for-character from the transcript below — do not paraphrase, "
    "summarize, translate, or invent text. If nothing in the call directly addresses a "
    "criterion, still score it (most likely \"fail\" or \"flag\") and quote the single "
    "most relevant line from the call, rather than inventing a quote.\n\n"
    "Score EVERY one of these criteria, using exactly these criterionId values:\n"
    + "\n".join(f"- {c['id']}: {c['description']}" for c in COMPLIANCE_CRITERIA)
    + "\n\nFor coaching findings, use ONLY these exact values for `type` (omit findings "
    "that don't apply — an empty list is fine if nothing stands out):\n"
    + "\n".join(f"- {t}" for t in FINDING_TYPES)
)

COMPLIANCE_TOOL = {
    "type": "function",
    "function": {
        "name": "submit_compliance_review",
        "description": "Submit compliance criterion scores and coaching findings for this call.",
        "parameters": {
            "type": "object",
            "properties": {
                "criterion_scores": {
                    "type": "array",
                    "description": f"Exactly {len(COMPLIANCE_CRITERIA)} entries, one per listed criterion.",
                    "minItems": len(COMPLIANCE_CRITERIA),
                    "maxItems": len(COMPLIANCE_CRITERIA),
                    "items": {
                        "type": "object",
                        "properties": {
                            "criterionId": {"type": "string", "enum": sorted(CRITERION_IDS)},
                            "label": {"type": "string", "enum": sorted(SCORE_LABELS)},
                            "confidence": {"type": "number"},
                            "evidenceTs": {"type": "number"},
                            "evidenceQuote": {"type": "string"},
                            "rationale": {"type": "string"},
                        },
                        "required": [
                            "criterionId",
                            "label",
                            "confidence",
                            "evidenceTs",
                            "evidenceQuote",
                            "rationale",
                        ],
                    },
                },
                "coaching_findings": {
                    "type": "array",
                    "description": "Notable coaching moments found in the call. Empty list if none.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "type": {"type": "string", "enum": FINDING_TYPES},
                            "ts": {"type": "number"},
                            "quote": {"type": "string"},
                            "suggestion": {"type": "string"},
                            "severity": {"type": "string", "enum": sorted(SEVERITIES)},
                        },
                        "required": ["type", "ts", "quote", "suggestion", "severity"],
                    },
                },
            },
            "required": ["criterion_scores", "coaching_findings"],
        },
    },
}


def _find_quote_segment(quote: str, merged_segments: List[Dict]) -> Optional[Dict]:
    """Return the first segment whose text contains `quote` verbatim (after
    collapsing whitespace on both sides), or None if it appears nowhere."""
    quote_normalized = " ".join(quote.split())
    if not quote_normalized:
        return None
    for seg in merged_segments:
        seg_text_normalized = " ".join(seg["text"].split())
        if quote_normalized in seg_text_normalized:
            return seg
    return None


def _validate_and_fix_criterion_scores(
    raw_scores: List[Dict], merged_segments: List[Dict]
) -> Tuple[List[Dict], List[str]]:
    valid: List[Dict] = []
    bad_quotes: List[str] = []
    seen_ids = set()

    for item in raw_scores if isinstance(raw_scores, list) else []:
        criterion_id = item.get("criterionId") if isinstance(item, dict) else None
        quote = item.get("evidenceQuote", "") if isinstance(item, dict) else ""

        if criterion_id not in CRITERION_IDS or criterion_id in seen_ids:
            bad_quotes.append(f"criterion {criterion_id!r}: unknown or duplicate criterionId")
            continue
        if item.get("label") not in SCORE_LABELS:
            bad_quotes.append(f"criterion {criterion_id!r}: invalid label {item.get('label')!r}")
            continue

        segment = _find_quote_segment(quote, merged_segments)
        if segment is None:
            bad_quotes.append(quote)
            continue

        seen_ids.add(criterion_id)
        confidence = max(0.0, min(1.0, float(item.get("confidence", 0.5))))
        valid.append(
            {
                "criterionId": criterion_id,
                "label": item["label"],
                "confidence": confidence,
                "evidenceTs": segment["start"],
                "evidenceQuote": quote,
                "rationale": item.get("rationale", ""),
            }
        )

    missing = CRITERION_IDS - seen_ids
    if missing:
        bad_quotes.append(f"missing criteria: {sorted(missing)}")

    return valid, bad_quotes


def _validate_and_fix_coaching_findings(
    raw_findings: List[Dict], merged_segments: List[Dict]
) -> Tuple[List[Dict], List[str]]:
    valid: List[Dict] = []
    bad_quotes: List[str] = []

    for item in raw_findings if isinstance(raw_findings, list) else []:
        finding_type = item.get("type") if isinstance(item, dict) else None
        quote = item.get("quote", "") if isinstance(item, dict) else ""

        if finding_type not in FINDING_TYPES:
            bad_quotes.append(f"finding: unknown type {finding_type!r}")
            continue
        if item.get("severity") not in SEVERITIES:
            bad_quotes.append(f"finding {finding_type!r}: invalid severity {item.get('severity')!r}")
            continue

        segment = _find_quote_segment(quote, merged_segments)
        if segment is None:
            bad_quotes.append(quote)
            continue

        valid.append(
            {
                "id": str(uuid.uuid4()),
                "type": finding_type,
                "ts": segment["start"],
                "quote": quote,
                "suggestion": item.get("suggestion", ""),
                "severity": item["severity"],
            }
        )

    return valid, bad_quotes


def generate_compliance_scoring(
    merged_segments: List[Dict],
    model: str = MODEL,
    max_retries: int = 1,
) -> Tuple[List[Dict], List[Dict]]:
    """Score the call against the 8 compliance criteria and extract coaching
    findings, via a forced tool call.

    If any returned evidenceQuote/quote isn't a real verbatim substring of the
    transcript (or an enum value is invalid, or a criterion is missing), the whole
    call is retried once with corrective feedback naming the specific problems.
    Items still invalid after that are dropped rather than failing the call — one
    hallucinated quote shouldn't erase every other valid score/finding.

    Raises RuntimeError if the API call itself fails (network, auth, etc.) after
    exhausting retries, or if NVIDIA_API_KEY is missing/invalid.
    """
    client = _get_client()
    transcript = _format_transcript(merged_segments)

    correction_note = ""
    last_error: Optional[BaseException] = None
    valid_scores: List[Dict] = []
    valid_findings: List[Dict] = []

    for attempt in range(max_retries + 1):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": COMPLIANCE_SYSTEM_PROMPT},
                    {"role": "user", "content": f"## Transcript\n{transcript}{correction_note}"},
                ],
                tools=[COMPLIANCE_TOOL],
                tool_choice={"type": "function", "function": {"name": "submit_compliance_review"}},
                temperature=0.2,
                max_tokens=3000,
            )
            message = response.choices[0].message

            if message.tool_calls:
                arguments = json.loads(message.tool_calls[0].function.arguments)
            elif message.content:
                arguments = json.loads(message.content)
            else:
                raise RuntimeError("NVIDIA API returned neither a tool call nor message content")
        except openai.AuthenticationError as exc:
            raise RuntimeError(
                "NVIDIA_API_KEY was rejected by the API — check that it's valid at "
                "https://build.nvidia.com/."
            ) from exc
        except Exception as exc:  # noqa: BLE001 - deliberately broad for this retry loop
            last_error = exc
            if attempt < max_retries:
                time.sleep(1.0)
                continue
            raise RuntimeError(
                f"Failed to get compliance scoring from NVIDIA after {max_retries + 1} attempt(s): {last_error}"
            ) from last_error

        valid_scores, bad_score_quotes = _validate_and_fix_criterion_scores(
            arguments.get("criterion_scores", []), merged_segments
        )
        valid_findings, bad_finding_quotes = _validate_and_fix_coaching_findings(
            arguments.get("coaching_findings", []), merged_segments
        )
        bad_quotes = bad_score_quotes + bad_finding_quotes

        if not bad_quotes:
            return valid_scores, valid_findings

        if attempt < max_retries:
            correction_note = (
                "\n\n## Correction needed\n"
                "Your previous response had problems with these items — quotes that don't "
                "appear verbatim in the transcript above, invalid enum values, or missing "
                "criteria: " + "; ".join(repr(q) for q in bad_quotes) + ". Every "
                "evidenceQuote/quote MUST be copied character-for-character from the "
                "transcript. Re-submit a COMPLETE, corrected response covering every "
                "criterion and finding."
            )

    # Exhausted retries with some items still failing validation: keep what validated,
    # drop the rest, rather than crashing the whole call over one hallucinated quote.
    return valid_scores, valid_findings
