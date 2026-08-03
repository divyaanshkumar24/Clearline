"""Part B: emotion tagging for client segments via SamLowe/roberta-base-go_emotions."""

from typing import Dict, List

from transformers import pipeline

EMOTION_MODEL = "SamLowe/roberta-base-go_emotions"

_emotion_pipeline = None


def _get_emotion_pipeline():
    global _emotion_pipeline
    if _emotion_pipeline is None:
        _emotion_pipeline = pipeline("text-classification", model=EMOTION_MODEL, top_k=1)
    return _emotion_pipeline


def tag_emotions(client_segments: List[Dict]) -> List[Dict]:
    """Tag each client segment with its single highest-confidence emotion label."""
    if not client_segments:
        return []

    classifier = _get_emotion_pipeline()
    texts = [seg["text"] for seg in client_segments]
    results = classifier(texts, truncation=True)

    tags = []
    for seg, result in zip(client_segments, results):
        # top_k=1 returns, per input, a list containing one {"label", "score"} dict.
        top = result[0] if isinstance(result, list) else result
        tags.append(
            {
                "start": seg["start"],
                "end": seg["end"],
                "text": seg["text"],
                "emotion": top["label"],
                "confidence": round(float(top["score"]), 4),
            }
        )

    return tags
