"""Part D: LLM-generated coaching recommendation via Claude, forced through tool use.

Uses a forced tool call (tool_choice naming the tool, plus strict:true on its
input_schema) rather than parsing free text, so the response is guaranteed to be
valid, schema-conforming JSON.
"""

import os
import time
from typing import Dict, List, Optional

import anthropic
from dotenv import load_dotenv

load_dotenv()

MODEL = "claude-opus-5"

SYSTEM_PROMPT = (
    "You are a call-quality coaching assistant analyzing a compliance call between "
    "a call center agent and a client. You will be given the full speaker-tagged "
    "transcript, a sentiment trajectory tracking the client's sentiment over the "
    "call, emotion tags for the client's segments, and (if one was detected) the "
    "point where the client's sentiment took its most significant negative turn. "
    "Analyze the call and report what went wrong, why it went wrong, and how the "
    "agent should repair or prevent it in future calls. Call the "
    "submit_call_analysis tool with your analysis — do not respond with plain text."
)

RECOMMENDATION_TOOL = {
    "name": "submit_call_analysis",
    "description": "Submit the structured call-quality coaching analysis.",
    "input_schema": {
        "type": "object",
        "properties": {
            "what_went_wrong": {
                "type": "string",
                "description": "What went wrong in the call, in plain language. If nothing went wrong, say so.",
            },
            "root_cause": {
                "type": "string",
                "description": "The underlying root cause behind what went wrong.",
            },
            "repair_suggestion": {
                "type": "string",
                "description": "A concrete, actionable suggestion for the agent to repair or prevent this in future calls.",
            },
        },
        "required": ["what_went_wrong", "root_cause", "repair_suggestion"],
        "additionalProperties": False,
    },
    "strict": True,
}


def _get_client() -> anthropic.Anthropic:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError(
            "ANTHROPIC_API_KEY is not set. Add it to clearline-backend/.env (see "
            ".env.example) — get a key at https://console.anthropic.com/settings/keys."
        )
    return anthropic.Anthropic(api_key=api_key)


def _format_transcript(merged_segments: List[Dict]) -> str:
    lines = []
    for seg in merged_segments:
        speaker = seg.get("speaker") or "unknown"
        lines.append(f"[{seg['start']:.1f}-{seg['end']:.1f}] {speaker}: {seg['text']}")
    return "\n".join(lines)


def generate_recommendation(
    merged_segments: List[Dict],
    sentiment_trajectory: List[Dict],
    emotion_tags: List[Dict],
    pivot_point: Dict,
    model: str = MODEL,
    max_retries: int = 1,
) -> Dict:
    """Ask Claude for a structured coaching recommendation, forced via tool use.

    Retries up to `max_retries` additional times (default 1, so 2 attempts total)
    if the API call fails or Claude doesn't return the expected tool call.
    """
    client = _get_client()

    user_content = (
        "## Transcript\n"
        f"{_format_transcript(merged_segments)}\n\n"
        "## Client sentiment trajectory (chronological)\n"
        f"{sentiment_trajectory}\n\n"
        "## Client emotion tags (chronological)\n"
        f"{emotion_tags}\n\n"
        "## Detected sentiment pivot point\n"
        f"{pivot_point}"
    )

    last_error: Optional[BaseException] = None
    for attempt in range(max_retries + 1):
        try:
            response = client.messages.create(
                model=model,
                max_tokens=1024,
                system=SYSTEM_PROMPT,
                tools=[RECOMMENDATION_TOOL],
                tool_choice={"type": "tool", "name": "submit_call_analysis"},
                messages=[{"role": "user", "content": user_content}],
            )

            for block in response.content:
                if block.type == "tool_use" and block.name == "submit_call_analysis":
                    return dict(block.input)

            last_error = RuntimeError(
                f"Claude did not call submit_call_analysis (stop_reason={response.stop_reason})"
            )
        except anthropic.AuthenticationError as exc:
            raise RuntimeError(
                "ANTHROPIC_API_KEY was rejected by the API — check that it's valid "
                "at https://console.anthropic.com/settings/keys."
            ) from exc
        except Exception as exc:  # noqa: BLE001 - deliberately broad for this retry loop
            last_error = exc

        if attempt < max_retries:
            time.sleep(1.0)

    raise RuntimeError(
        f"Failed to get a recommendation from Claude after {max_retries + 1} attempt(s): {last_error}"
    ) from last_error
