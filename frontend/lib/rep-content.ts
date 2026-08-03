import type { FindingType } from "./types";

/** One representative-facing tip per finding type, for the personal dashboard */
export const SUGGESTION_LOOKUP: Record<FindingType, string> = {
  "Weak discovery":
    "Lead with open questions — 'what would need to be true for you to feel good about this?' beats a yes/no.",
  Interruption:
    "Count one beat after the client stops talking before you respond.",
  "Long monologue":
    "Break explanations over a minute with a check-in: 'does that match what you were expecting?'",
  "Empathy gap":
    "Name the hesitation before answering it — clients need to feel heard before they hear numbers.",
  "Mishandled objection":
    "Clarify before countering: 'when you say too risky, what scenario are you picturing?'",
  "Filler & hedging":
    "Slow down — a pause reads as confidence, hedging reads as doubt.",
  "Jargon-heavy explanation":
    "Translate to dollars on their actual balance before layering in precision.",
  "Long silence":
    "After a price quote, check in within five seconds.",
};
