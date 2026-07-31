import json
import os
from unittest.mock import MagicMock

import pytest
from dotenv import load_dotenv

from src.stage3_recommendations import compliance

load_dotenv()


class FakeFunctionCall:
    def __init__(self, name, arguments_dict):
        self.name = name
        self.arguments = json.dumps(arguments_dict)


class FakeToolCall:
    def __init__(self, name, arguments_dict):
        self.function = FakeFunctionCall(name, arguments_dict)


class FakeMessage:
    def __init__(self, tool_calls=None, content=None):
        self.tool_calls = tool_calls
        self.content = content


class FakeChoice:
    def __init__(self, message):
        self.message = message


class FakeResponse:
    def __init__(self, choices):
        self.choices = choices


# A hand-authored financial-advisory call transcript, standing in for a real
# "sample call" since sample_audio/ has none yet. Deliberately contains:
#   - a MISSING recording disclosure (never said anywhere)
#   - a real risk disclosure, fee disclosure, and suitability discussion (PASS-able)
#   - a clear guaranteed-returns violation ("guaranteed to see at least eight percent")
#   - an interruption and a long monologue, for coaching findings
FINANCIAL_CALL_SEGMENTS = [
    {"start": 0.0, "end": 4.0, "text": "Hi, this is Morgan from Meridian Wealth Advisors. Thanks for taking my call today.", "speaker": "agent"},
    {"start": 4.5, "end": 6.0, "text": "Sure, no problem.", "speaker": "client"},
    {"start": 6.5, "end": 12.0, "text": "Great. Before we get started, I'd like to understand your financial goals and your timeline for this investment.", "speaker": "agent"},
    {"start": 12.5, "end": 18.0, "text": "Well, I'm hoping to retire in about fifteen years and I want something that grows steadily without too much risk.", "speaker": "client"},
    {"start": 18.5, "end": 40.0, "text": "That's really helpful context. Based on what you've told me about your fifteen year timeline and your preference for steady growth, I think our Meridian Balanced Growth Fund would be a great fit. It's a mix of large cap equities and investment grade bonds, and it's designed for investors who want moderate growth without excessive volatility. The fund charges a one percent annual management fee, which covers all the active rebalancing and research our team does throughout the year. Historically the fund has performed well, though of course there's always market risk with any investment like this. I really think, based on everything you've shared, this lines up well with your fifteen year retirement goal and your comfort with moderate risk.", "speaker": "agent"},
    {"start": 40.5, "end": 43.0, "text": "That sounds interesting. What kind of returns could I expect?", "speaker": "client"},
    {"start": 43.5, "end": 48.0, "text": "Honestly, with this fund you're guaranteed to see at least eight percent a year, so you really can't go wrong here.", "speaker": "agent"},
    {"start": 48.5, "end": 51.0, "text": "Oh wow, that's great to hear. I was also wondering—", "speaker": "client"},
    {"start": 51.0, "end": 52.5, "text": "Yeah so let's go ahead and get the paperwork started right now.", "speaker": "agent"},
    {"start": 53.0, "end": 55.0, "text": "Oh, okay. I guess that works.", "speaker": "client"},
]


# --- _find_quote_segment ---


def test_find_quote_segment_exact_match():
    segments = [{"start": 1.0, "text": "Hello there friend"}, {"start": 2.0, "text": "Goodbye now"}]
    assert compliance._find_quote_segment("there friend", segments)["start"] == 1.0
    assert compliance._find_quote_segment("Goodbye now", segments)["start"] == 2.0


def test_find_quote_segment_normalizes_whitespace():
    segments = [{"start": 1.0, "text": "Hello   there\nfriend"}]
    assert compliance._find_quote_segment("Hello there friend", segments)["start"] == 1.0


def test_find_quote_segment_no_match_returns_none():
    segments = [{"start": 1.0, "text": "Hello there friend"}]
    assert compliance._find_quote_segment("this was never said", segments) is None


def test_find_quote_segment_empty_quote_returns_none():
    segments = [{"start": 1.0, "text": "Hello there friend"}]
    assert compliance._find_quote_segment("", segments) is None


# --- _validate_and_fix_criterion_scores ---


def _make_score(criterion_id, label="fail", quote="Hello there friend", **overrides):
    score = {
        "criterionId": criterion_id,
        "label": label,
        "confidence": 0.8,
        "evidenceTs": 999.0,  # deliberately wrong — must be overwritten
        "evidenceQuote": quote,
        "rationale": "because reasons",
    }
    score.update(overrides)
    return score


def test_validate_criterion_scores_overwrites_evidence_ts():
    segments = [{"start": 5.0, "end": 6.0, "text": "Hello there friend"}]

    valid, bad = _fill_all_criteria_valid(segments)

    assert bad == []
    assert len(valid) == len(compliance.CRITERION_IDS)
    for item in valid:
        assert item["evidenceTs"] == 5.0  # overwritten from the model's bogus 999.0


def _fill_all_criteria_valid(segments):
    raw = [_make_score(cid) for cid in sorted(compliance.CRITERION_IDS)]
    return compliance._validate_and_fix_criterion_scores(raw, segments)


def test_validate_criterion_scores_drops_hallucinated_quote():
    segments = [{"start": 5.0, "end": 6.0, "text": "Hello there friend"}]
    raw = [_make_score(cid) for cid in sorted(compliance.CRITERION_IDS)]
    raw[0]["evidenceQuote"] = "this text does not exist in the transcript"

    valid, bad = compliance._validate_and_fix_criterion_scores(raw, segments)

    assert len(valid) == len(compliance.CRITERION_IDS) - 1
    assert any("this text does not exist" in b for b in bad)


def test_validate_criterion_scores_drops_unknown_criterion_id():
    segments = [{"start": 5.0, "end": 6.0, "text": "Hello there friend"}]
    raw = [_make_score(cid) for cid in sorted(compliance.CRITERION_IDS)]
    raw[0]["criterionId"] = "not_a_real_criterion"

    valid, bad = compliance._validate_and_fix_criterion_scores(raw, segments)

    assert len(valid) == len(compliance.CRITERION_IDS) - 1
    assert any("unknown or duplicate" in b for b in bad)


def test_validate_criterion_scores_drops_invalid_label():
    segments = [{"start": 5.0, "end": 6.0, "text": "Hello there friend"}]
    raw = [_make_score(cid) for cid in sorted(compliance.CRITERION_IDS)]
    raw[0]["label"] = "not_a_real_label"

    valid, bad = compliance._validate_and_fix_criterion_scores(raw, segments)

    assert len(valid) == len(compliance.CRITERION_IDS) - 1


def test_validate_criterion_scores_flags_missing_criteria():
    segments = [{"start": 5.0, "end": 6.0, "text": "Hello there friend"}]
    raw = [_make_score(cid) for cid in sorted(compliance.CRITERION_IDS)][:-1]  # drop one

    valid, bad = compliance._validate_and_fix_criterion_scores(raw, segments)

    assert len(valid) == len(compliance.CRITERION_IDS) - 1
    assert any("missing criteria" in b for b in bad)


# --- _validate_and_fix_coaching_findings ---


def test_validate_coaching_findings_overwrites_ts_and_assigns_id():
    segments = [{"start": 7.5, "text": "I was also wondering something"}]
    raw = [
        {
            "type": "Interruption",
            "ts": 0.0,
            "quote": "I was also wondering something",
            "suggestion": "Let the client finish.",
            "severity": "minor",
        }
    ]

    valid, bad = compliance._validate_and_fix_coaching_findings(raw, segments)

    assert bad == []
    assert len(valid) == 1
    assert valid[0]["ts"] == 7.5
    assert valid[0]["id"]  # a uuid string was assigned


def test_validate_coaching_findings_drops_unknown_type():
    segments = [{"start": 7.5, "text": "some text"}]
    raw = [{"type": "Not A Real Type", "ts": 0.0, "quote": "some text", "suggestion": "x", "severity": "minor"}]

    valid, bad = compliance._validate_and_fix_coaching_findings(raw, segments)

    assert valid == []
    assert bad


def test_validate_coaching_findings_drops_hallucinated_quote():
    segments = [{"start": 7.5, "text": "some text"}]
    raw = [{"type": "Interruption", "ts": 0.0, "quote": "never said this", "suggestion": "x", "severity": "minor"}]

    valid, bad = compliance._validate_and_fix_coaching_findings(raw, segments)

    assert valid == []
    assert bad


# --- generate_compliance_scoring (mocked — no real API calls) ---


def _all_criteria_response(quote="Hello there friend", extra_findings=None):
    return {
        "criterion_scores": [_make_score(cid, quote=quote) for cid in sorted(compliance.CRITERION_IDS)],
        "coaching_findings": extra_findings or [],
    }


def test_generate_compliance_scoring_success(monkeypatch):
    monkeypatch.setenv("NVIDIA_API_KEY", "test-key")
    segments = [{"start": 5.0, "end": 6.0, "text": "Hello there friend"}]
    fake_response = FakeResponse(
        [FakeChoice(FakeMessage(tool_calls=[FakeToolCall("submit_compliance_review", _all_criteria_response())]))]
    )
    fake_client = MagicMock()
    fake_client.chat.completions.create.return_value = fake_response
    monkeypatch.setattr(compliance.openai, "OpenAI", lambda **kwargs: fake_client)

    scores, findings = compliance.generate_compliance_scoring(segments)

    assert len(scores) == len(compliance.CRITERION_IDS)
    assert findings == []
    fake_client.chat.completions.create.assert_called_once()
    call_kwargs = fake_client.chat.completions.create.call_args.kwargs
    assert call_kwargs["tool_choice"] == {"type": "function", "function": {"name": "submit_compliance_review"}}


def test_generate_compliance_scoring_missing_api_key(monkeypatch):
    monkeypatch.delenv("NVIDIA_API_KEY", raising=False)

    with pytest.raises(RuntimeError, match="NVIDIA_API_KEY"):
        compliance.generate_compliance_scoring([{"start": 0.0, "text": "hi"}])


def test_generate_compliance_scoring_retries_then_succeeds_on_bad_quote(monkeypatch):
    monkeypatch.setenv("NVIDIA_API_KEY", "test-key")
    segments = [{"start": 5.0, "end": 6.0, "text": "Hello there friend"}]

    bad_payload = _all_criteria_response()
    bad_payload["criterion_scores"][0]["evidenceQuote"] = "hallucinated text not in transcript"
    good_payload = _all_criteria_response()

    responses = [
        FakeResponse([FakeChoice(FakeMessage(tool_calls=[FakeToolCall("submit_compliance_review", bad_payload)]))]),
        FakeResponse([FakeChoice(FakeMessage(tool_calls=[FakeToolCall("submit_compliance_review", good_payload)]))]),
    ]
    fake_client = MagicMock()
    fake_client.chat.completions.create.side_effect = responses
    monkeypatch.setattr(compliance.openai, "OpenAI", lambda **kwargs: fake_client)

    scores, findings = compliance.generate_compliance_scoring(segments, max_retries=1)

    assert len(scores) == len(compliance.CRITERION_IDS)
    assert fake_client.chat.completions.create.call_count == 2
    second_call_messages = fake_client.chat.completions.create.call_args_list[1].kwargs["messages"]
    assert "Correction needed" in second_call_messages[1]["content"]


def test_generate_compliance_scoring_keeps_partial_result_after_exhausting_retries(monkeypatch):
    monkeypatch.setenv("NVIDIA_API_KEY", "test-key")
    segments = [{"start": 5.0, "end": 6.0, "text": "Hello there friend"}]

    bad_payload = _all_criteria_response()
    bad_payload["criterion_scores"][0]["evidenceQuote"] = "hallucinated text not in transcript"

    fake_response = FakeResponse(
        [FakeChoice(FakeMessage(tool_calls=[FakeToolCall("submit_compliance_review", bad_payload)]))]
    )
    fake_client = MagicMock()
    fake_client.chat.completions.create.return_value = fake_response
    monkeypatch.setattr(compliance.openai, "OpenAI", lambda **kwargs: fake_client)
    monkeypatch.setattr(compliance.time, "sleep", lambda seconds: None)

    # Should NOT raise — drops the one bad item and returns the rest.
    scores, findings = compliance.generate_compliance_scoring(segments, max_retries=1)

    assert len(scores) == len(compliance.CRITERION_IDS) - 1
    assert fake_client.chat.completions.create.call_count == 2


# --- Real end-to-end test against a hand-authored transcript (no sample_audio needed —
# this operates on transcript text, not audio) ---


def test_generate_compliance_scoring_end_to_end_real_api():
    if not os.environ.get("NVIDIA_API_KEY"):
        pytest.skip("NVIDIA_API_KEY is not set; can't call the real NVIDIA API.")

    scores, findings = compliance.generate_compliance_scoring(FINANCIAL_CALL_SEGMENTS)

    transcript_texts = [seg["text"] for seg in FINANCIAL_CALL_SEGMENTS]

    assert len(scores) > 0
    for score in scores:
        assert score["criterionId"] in compliance.CRITERION_IDS
        assert score["label"] in compliance.SCORE_LABELS
        assert 0.0 <= score["confidence"] <= 1.0
        quote = score["evidenceQuote"]
        assert any(" ".join(quote.split()) in " ".join(t.split()) for t in transcript_texts), (
            f"evidenceQuote not found verbatim in transcript: {quote!r}"
        )

    for finding in findings:
        assert finding["type"] in compliance.FINDING_TYPES
        assert finding["severity"] in compliance.SEVERITIES
        quote = finding["quote"]
        assert any(" ".join(quote.split()) in " ".join(t.split()) for t in transcript_texts), (
            f"finding quote not found verbatim in transcript: {quote!r}"
        )
