"""Part E: combine sentiment, emotion, pivot, and recommendation into one call analysis."""

from typing import Dict, List, Optional

from .emotion import tag_emotions
from .pivot import detect_pivot
from .recommendation import generate_recommendation
from .sentiment import score_sentiment


def analyze_call(merged_segments: List[Dict], call_id: Optional[str] = None) -> Dict:
    """Run Stage 3 (sentiment, emotion, pivot detection, LLM recommendation) on a
    Stage 2 speaker-tagged transcript.

    Args:
        merged_segments: Stage 2's "segments" list — [{"start", "end", "text", "speaker"}, ...].
        call_id: The call's ID (from Stage 1/2's output), included in the returned dict.

    Returns:
        {"call_id", "sentiment_trajectory", "emotion_tags", "pivot_point", "recommendation"}
    """
    client_segments = [seg for seg in merged_segments if seg.get("speaker") == "client"]

    sentiment_trajectory = score_sentiment(client_segments)
    emotion_tags = tag_emotions(client_segments)
    pivot_point = detect_pivot(sentiment_trajectory)
    recommendation = generate_recommendation(
        merged_segments, sentiment_trajectory, emotion_tags, pivot_point
    )

    return {
        "call_id": call_id,
        "sentiment_trajectory": sentiment_trajectory,
        "emotion_tags": emotion_tags,
        "pivot_point": pivot_point,
        "recommendation": recommendation,
    }
