"""Map anonymous diarization speaker labels (SPEAKER_00/SPEAKER_01) to agent/client roles."""

from collections import defaultdict
from typing import Dict, List

# Phrases that suggest a segment was spoken by the agent (the business's representative),
# checked as case-insensitive substrings. Edit freely to tune for your actual call scripts.
AGENT_PHRASES = [
    "thank you for calling",
    "thanks for calling",
    "how can i help",
    "how may i help",
    "how can i assist",
    "my name is",
    "before we begin",
    "this call may be recorded",
    "is there anything else i can help",
    "let me pull up your account",
]

# How many of a speaker's earliest segments to look at when scoring.
SEGMENTS_TO_CONSIDER_PER_SPEAKER = 3


def _agent_phrase_score(text: str) -> int:
    text_lower = text.lower()
    return sum(1 for phrase in AGENT_PHRASES if phrase in text_lower)


def assign_roles(merged_segments: List[Dict]) -> List[Dict]:
    """Relabel SPEAKER_00/SPEAKER_01-style diarization labels as "agent"/"client".

    Looks at each speaker's first `SEGMENTS_TO_CONSIDER_PER_SPEAKER` segments and
    scores them against AGENT_PHRASES; the higher-scoring speaker becomes "agent",
    the other "client". Ties default to whichever speaker id sorts first.

    Segments already labeled "agent"/"client" — e.g. from dual-channel mode, where
    the true role is known deterministically from which channel produced the
    audio — are returned unchanged, since there's nothing to infer.
    """
    speaker_ids = sorted({seg["speaker"] for seg in merged_segments if seg.get("speaker")})

    if not speaker_ids or set(speaker_ids) <= {"agent", "client"}:
        return list(merged_segments)

    if len(speaker_ids) != 2:
        raise ValueError(
            f"assign_roles expects exactly 2 distinct speakers, got {speaker_ids}. "
            "Calls with more than 2 speakers aren't supported by this heuristic."
        )

    early_segments_by_speaker = defaultdict(list)
    for seg in merged_segments:
        speaker = seg.get("speaker")
        if speaker in speaker_ids and len(early_segments_by_speaker[speaker]) < SEGMENTS_TO_CONSIDER_PER_SPEAKER:
            early_segments_by_speaker[speaker].append(seg)

    scores = {
        speaker: sum(_agent_phrase_score(seg["text"]) for seg in early_segments_by_speaker[speaker])
        for speaker in speaker_ids
    }

    speaker_a, speaker_b = speaker_ids
    agent_speaker = speaker_a if scores[speaker_a] >= scores[speaker_b] else speaker_b
    client_speaker = speaker_b if agent_speaker == speaker_a else speaker_a
    role_by_speaker = {agent_speaker: "agent", client_speaker: "client"}

    return [{**seg, "speaker": role_by_speaker.get(seg["speaker"], seg.get("speaker"))} for seg in merged_segments]
