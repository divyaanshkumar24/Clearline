"""Part D: LLM-generated coaching recommendation via an NVIDIA NIM-hosted Nemotron
model, forced through OpenAI-style tool/function calling.

NVIDIA NIM (build.nvidia.com) exposes an OpenAI-compatible chat completions API, so
this uses the official `openai` SDK pointed at NVIDIA's endpoint rather than a
NVIDIA-specific client. Forcing a tool call (rather than parsing free text) keeps the
response schema-conforming; if the model ignores `tool_choice` and answers in plain
text anyway, we still try to parse that text as JSON before giving up.
"""

import json
import os
import time
from typing import Dict, List, Optional

import openai
from dotenv import load_dotenv

load_dotenv()

NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1"

# NVIDIA NIM hosts several Nemotron variants under the same API, but not every
# variant is enabled for every account/key — "nvidia/llama-3.1-nemotron-70b-instruct"
# is listed by client.models.list() yet 404s ("Function ... Not found for account")
# when actually called under this project's key. Verified working (real API call,
# including forced tool-calling) as of this writing:
# "nvidia/llama-3.3-nemotron-super-49b-v1". Swap here if you have a different key/tier.
MODEL = "nvidia/llama-3.3-nemotron-super-49b-v1"

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
    "type": "function",
    "function": {
        "name": "submit_call_analysis",
        "description": "Submit the structured call-quality coaching analysis.",
        "parameters": {
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
        },
    },
}

REQUIRED_KEYS = ("what_went_wrong", "root_cause", "repair_suggestion")


def _get_client() -> openai.OpenAI:
    api_key = os.environ.get("NVIDIA_API_KEY")
    if not api_key:
        raise RuntimeError(
            "NVIDIA_API_KEY is not set. Add it to clearline-backend/.env (see "
            ".env.example) — get a free-tier key at https://build.nvidia.com/."
        )
    return openai.OpenAI(base_url=NVIDIA_BASE_URL, api_key=api_key)


def _format_transcript(merged_segments: List[Dict]) -> str:
    lines = []
    for seg in merged_segments:
        speaker = seg.get("speaker") or "unknown"
        lines.append(f"[{seg['start']:.1f}-{seg['end']:.1f}] {speaker}: {seg['text']}")
    return "\n".join(lines)


def _validate_recommendation(data) -> None:
    if not isinstance(data, dict):
        raise ValueError(f"recommendation is not a JSON object: {data!r}")
    missing = [key for key in REQUIRED_KEYS if not isinstance(data.get(key), str) or not data[key].strip()]
    if missing:
        raise ValueError(f"recommendation is missing/empty required field(s): {missing}")


def generate_recommendation(
    merged_segments: List[Dict],
    sentiment_trajectory: List[Dict],
    emotion_tags: List[Dict],
    pivot_point: Dict,
    model: str = MODEL,
    max_retries: int = 1,
) -> Dict:
    """Ask an NVIDIA-hosted Nemotron model for a structured coaching recommendation,
    forced via OpenAI-style tool/function calling.

    Retries up to `max_retries` additional times (default 1, so 2 attempts total) if
    the API call fails, or the model doesn't return a usable, schema-conforming
    recommendation (missing tool call and unparsable content, malformed JSON, or
    missing required fields).
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
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_content},
                ],
                tools=[RECOMMENDATION_TOOL],
                tool_choice={"type": "function", "function": {"name": "submit_call_analysis"}},
                temperature=0.2,
                max_tokens=1024,
            )
            message = response.choices[0].message

            if message.tool_calls:
                arguments = json.loads(message.tool_calls[0].function.arguments)
            elif message.content:
                # Some NIM models may ignore tool_choice and answer in plain text
                # instead — try to parse that directly rather than failing outright.
                arguments = json.loads(message.content)
            else:
                raise RuntimeError("NVIDIA API returned neither a tool call nor message content")

            _validate_recommendation(arguments)
            return {key: arguments[key] for key in REQUIRED_KEYS}
        except openai.AuthenticationError as exc:
            raise RuntimeError(
                "NVIDIA_API_KEY was rejected by the API — check that it's valid at "
                "https://build.nvidia.com/."
            ) from exc
        except Exception as exc:  # noqa: BLE001 - deliberately broad for this retry loop
            last_error = exc

        if attempt < max_retries:
            time.sleep(1.0)

    raise RuntimeError(
        f"Failed to get a recommendation from NVIDIA after {max_retries + 1} attempt(s): {last_error}"
    ) from last_error
