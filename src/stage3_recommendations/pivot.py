"""Part C: pivot-point detection via ruptures' PELT change-point algorithm."""

from typing import Dict, List, Optional

import numpy as np
import ruptures as rpt

NO_PIVOT: Dict = {"turn_index": None, "description": "no clear pivot detected"}

DEFAULT_PENALTY = 1.0
MIN_SEGMENTS_FOR_PIVOT = 3


def detect_pivot(sentiment_trajectory: List[Dict], penalty: float = DEFAULT_PENALTY) -> Dict:
    """Find the index of the most significant negative sentiment shift.

    Runs PELT on the client's sentiment score sequence. Among all change points
    PELT reports, picks the one with the most negative (mean-after - mean-before)
    delta. If PELT finds no change points, or every change point is a flat/positive
    shift, returns {"turn_index": None, "description": "no clear pivot detected"}
    instead of raising.
    """
    scores = [seg["score"] for seg in sentiment_trajectory]
    n = len(scores)

    if n < MIN_SEGMENTS_FOR_PIVOT:
        return dict(NO_PIVOT)

    try:
        signal = np.array(scores, dtype=float).reshape(-1, 1)
        # jump=1 is required so every index is a candidate breakpoint — ruptures'
        # default (jump=5) only considers every 5th index, which silently misses
        # every change point on the short sequences (a handful of turns) typical
        # of a single call's client-side sentiment trajectory.
        algo = rpt.Pelt(model="l2", min_size=2, jump=1).fit(signal)
        breakpoints = algo.predict(pen=penalty)
    except Exception:
        return dict(NO_PIVOT)

    # ruptures always includes n (the signal length) as a trailing sentinel — drop it.
    change_points = [bp for bp in breakpoints if 0 < bp < n]
    if not change_points:
        return dict(NO_PIVOT)

    best: Optional[Dict] = None
    for idx in change_points:
        pre_mean = sum(scores[:idx]) / idx
        post_mean = sum(scores[idx:]) / (n - idx)
        delta = post_mean - pre_mean
        if delta < 0 and (best is None or delta < best["delta"]):
            best = {"idx": idx, "pre_mean": pre_mean, "post_mean": post_mean, "delta": delta}

    if best is None:
        return dict(NO_PIVOT)

    idx = best["idx"]
    return {
        "turn_index": idx,
        "timestamp": sentiment_trajectory[idx]["start"],
        "description": f"sentiment dropped from {best['pre_mean']:.2f} to {best['post_mean']:.2f}",
    }
