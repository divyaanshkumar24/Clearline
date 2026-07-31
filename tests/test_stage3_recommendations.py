import os
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from dotenv import load_dotenv

from src.stage3_recommendations import analyze as analyze_module
from src.stage3_recommendations import emotion
from src.stage3_recommendations import pivot as pivot_module
from src.stage3_recommendations import recommendation
from src.stage3_recommendations import sentiment

load_dotenv()

SAMPLE_AUDIO_DIR = Path(__file__).resolve().parent.parent / "sample_audio"
AUDIO_EXTENSIONS = {".wav", ".mp3", ".m4a", ".flac", ".ogg", ".aiff", ".aif"}


def _find_sample_audio():
    if not SAMPLE_AUDIO_DIR.exists():
        return None
    for path in sorted(SAMPLE_AUDIO_DIR.iterdir()):
        if path.suffix.lower() in AUDIO_EXTENSIONS:
            return path
    return None


class FakeToolUseBlock:
    def __init__(self, name, input_):
        self.type = "tool_use"
        self.name = name
        self.input = input_


class FakeResponse:
    def __init__(self, content, stop_reason="tool_use"):
        self.content = content
        self.stop_reason = stop_reason


# --- Part A: sentiment (real local model, synthetic text) ---


def test_score_sentiment_labels_synthetic_segments():
    client_segments = [
        {"start": 0.0, "end": 1.0, "text": "This is amazing, thank you so much!"},
        {"start": 1.0, "end": 2.0, "text": "This is absolutely terrible and I'm furious."},
    ]

    trajectory = sentiment.score_sentiment(client_segments)

    assert len(trajectory) == 2
    assert trajectory[0]["label"] == "positive"
    assert trajectory[0]["score"] > 0
    assert trajectory[1]["label"] == "negative"
    assert trajectory[1]["score"] < 0
    for entry in trajectory:
        assert -1.0 <= entry["score"] <= 1.0


def test_score_sentiment_empty_input():
    assert sentiment.score_sentiment([]) == []


# --- Part B: emotion (real local model, synthetic text) ---


def test_tag_emotions_synthetic_segments():
    client_segments = [
        {"start": 0.0, "end": 1.0, "text": "Thank you so much, I really appreciate your help!"},
    ]

    tags = emotion.tag_emotions(client_segments)

    assert len(tags) == 1
    assert isinstance(tags[0]["emotion"], str) and tags[0]["emotion"]
    assert 0.0 <= tags[0]["confidence"] <= 1.0


def test_tag_emotions_empty_input():
    assert emotion.tag_emotions([]) == []


# --- Part C: pivot detection (synthetic trajectory, no audio/model needed) ---


def test_detect_pivot_finds_clear_negative_shift():
    trajectory = [
        {"start": 0.0, "score": 0.9},
        {"start": 1.0, "score": 0.85},
        {"start": 2.0, "score": 0.8},
        {"start": 3.0, "score": -0.7},
        {"start": 4.0, "score": -0.8},
        {"start": 5.0, "score": -0.85},
    ]

    result = pivot_module.detect_pivot(trajectory)

    assert result["turn_index"] is not None
    assert 1 <= result["turn_index"] <= 4
    assert "dropped" in result["description"]
    assert result["timestamp"] == trajectory[result["turn_index"]]["start"]


def test_detect_pivot_flat_trajectory_returns_no_pivot():
    trajectory = [{"start": float(i), "score": 0.1} for i in range(6)]

    result = pivot_module.detect_pivot(trajectory)

    assert result == {"turn_index": None, "description": "no clear pivot detected"}


def test_detect_pivot_too_short_returns_no_pivot():
    trajectory = [{"start": 0.0, "score": 0.5}, {"start": 1.0, "score": -0.5}]

    result = pivot_module.detect_pivot(trajectory)

    assert result == {"turn_index": None, "description": "no clear pivot detected"}


# --- Part D: LLM recommendation (mocked — no real API calls) ---


def test_generate_recommendation_returns_tool_input(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    expected = {
        "what_went_wrong": "The agent quoted an outdated policy detail.",
        "root_cause": "The agent looked up an old cached account record.",
        "repair_suggestion": "Refresh the account record before quoting policy details.",
    }
    fake_response = FakeResponse([FakeToolUseBlock("submit_call_analysis", expected)])
    fake_client = MagicMock()
    fake_client.messages.create.return_value = fake_response
    monkeypatch.setattr(recommendation.anthropic, "Anthropic", lambda **kwargs: fake_client)

    result = recommendation.generate_recommendation(
        merged_segments=[{"start": 0.0, "end": 1.0, "text": "hi", "speaker": "agent"}],
        sentiment_trajectory=[],
        emotion_tags=[],
        pivot_point={"turn_index": None, "description": "no clear pivot detected"},
    )

    assert result == expected
    fake_client.messages.create.assert_called_once()
    call_kwargs = fake_client.messages.create.call_args.kwargs
    assert call_kwargs["tool_choice"] == {"type": "tool", "name": "submit_call_analysis"}
    assert call_kwargs["tools"][0]["name"] == "submit_call_analysis"


def test_generate_recommendation_missing_api_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)

    with pytest.raises(RuntimeError, match="ANTHROPIC_API_KEY"):
        recommendation.generate_recommendation([], [], [], {"turn_index": None, "description": "x"})


def test_generate_recommendation_retries_once_then_succeeds(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    expected = {"what_went_wrong": "a", "root_cause": "b", "repair_suggestion": "c"}
    fake_response = FakeResponse([FakeToolUseBlock("submit_call_analysis", expected)])
    fake_client = MagicMock()
    fake_client.messages.create.side_effect = [RuntimeError("transient failure"), fake_response]
    monkeypatch.setattr(recommendation.anthropic, "Anthropic", lambda **kwargs: fake_client)
    monkeypatch.setattr(recommendation.time, "sleep", lambda seconds: None)

    result = recommendation.generate_recommendation([], [], [], {}, max_retries=1)

    assert result == expected
    assert fake_client.messages.create.call_count == 2


def test_generate_recommendation_raises_after_exhausting_retries(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    fake_client = MagicMock()
    fake_client.messages.create.side_effect = RuntimeError("boom")
    monkeypatch.setattr(recommendation.anthropic, "Anthropic", lambda **kwargs: fake_client)
    monkeypatch.setattr(recommendation.time, "sleep", lambda seconds: None)

    with pytest.raises(RuntimeError, match="Failed to get a recommendation"):
        recommendation.generate_recommendation([], [], [], {}, max_retries=1)

    assert fake_client.messages.create.call_count == 2


# --- Part E: analyze_call schema (mocked recommendation, real sentiment/emotion) ---


def test_analyze_call_schema(monkeypatch):
    fake_recommendation = {"what_went_wrong": "x", "root_cause": "y", "repair_suggestion": "z"}
    monkeypatch.setattr(analyze_module, "generate_recommendation", lambda *a, **kw: fake_recommendation)

    merged_segments = [
        {"start": 0.0, "end": 2.0, "text": "Thank you for calling.", "speaker": "agent"},
        {"start": 2.0, "end": 4.0, "text": "I am extremely upset about this.", "speaker": "client"},
        {"start": 4.0, "end": 6.0, "text": "I understand, let me help.", "speaker": "agent"},
        {"start": 6.0, "end": 8.0, "text": "Thank you, that is much better.", "speaker": "client"},
    ]

    result = analyze_module.analyze_call(merged_segments, call_id="test-call")

    assert set(result.keys()) == {
        "call_id",
        "sentiment_trajectory",
        "emotion_tags",
        "pivot_point",
        "recommendation",
    }
    assert result["call_id"] == "test-call"
    assert len(result["sentiment_trajectory"]) == 2  # only the 2 client segments
    assert len(result["emotion_tags"]) == 2
    assert result["recommendation"] == fake_recommendation


# --- End-to-end test using real audio + real Claude API ---


def test_analyze_call_end_to_end_on_sample_audio():
    sample_path = _find_sample_audio()
    if sample_path is None:
        pytest.skip(
            f"No audio file found in {SAMPLE_AUDIO_DIR}. "
            "Add a call recording (.wav/.mp3/etc) there and re-run this test."
        )
    if not os.environ.get("HF_TOKEN"):
        pytest.skip("HF_TOKEN is not set; can't run real diarization for the Stage 2 step.")
    if not os.environ.get("ANTHROPIC_API_KEY"):
        pytest.skip("ANTHROPIC_API_KEY is not set; can't call the real Claude API for Stage 3.")

    from src.stage1_asr.transcribe import transcribe_call
    from src.stage2_diarization.label import label_speakers

    asr_result = transcribe_call(str(sample_path), model_size="medium")
    stage2_result = label_speakers(asr_result, str(sample_path))
    result = analyze_module.analyze_call(stage2_result["segments"], call_id=stage2_result["call_id"])

    assert result["call_id"] == stage2_result["call_id"]
    assert "recommendation" in result
    for key in ("what_went_wrong", "root_cause", "repair_suggestion"):
        assert key in result["recommendation"]
        assert result["recommendation"][key].strip() != ""
