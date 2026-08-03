"""Part A: sentiment scoring for client segments via cardiffnlp/twitter-roberta-base-sentiment-latest."""

from typing import Dict, List

from transformers import pipeline

SENTIMENT_MODEL = "cardiffnlp/twitter-roberta-base-sentiment-latest"
SENTIMENT_SIGN = {"positive": 1.0, "neutral": 0.0, "negative": -1.0}

_sentiment_pipeline = None


def _get_sentiment_pipeline():
    global _sentiment_pipeline
    if _sentiment_pipeline is None:
        _sentiment_pipeline = pipeline("sentiment-analysis", model=SENTIMENT_MODEL)
    return _sentiment_pipeline


def score_sentiment(client_segments: List[Dict]) -> List[Dict]:
    """Score each client segment's sentiment and reduce it to one continuous number.

    label + confidence -> score in [-1, 1]: positive=+1, neutral=0, negative=-1,
    each scaled by the model's confidence, so the sequence can be plotted as a
    trajectory over the call.
    """
    if not client_segments:
        return []

    classifier = _get_sentiment_pipeline()
    texts = [seg["text"] for seg in client_segments]
    results = classifier(texts, truncation=True)

    trajectory = []
    for seg, result in zip(client_segments, results):
        label = result["label"].lower()
        confidence = float(result["score"])
        sign = SENTIMENT_SIGN.get(label, 0.0)
        trajectory.append(
            {
                "start": seg["start"],
                "end": seg["end"],
                "text": seg["text"],
                "label": label,
                "confidence": round(confidence, 4),
                "score": round(sign * confidence, 4),
            }
        )

    return trajectory
