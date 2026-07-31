import os
from pathlib import Path

import pytest
from dotenv import load_dotenv

from src.stage2_diarization.merge import merge_transcript_with_speakers
from src.stage2_diarization.roles import assign_roles

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


# --- Synthetic/mocked tests: merge + role assignment logic, no audio needed ---


def test_merge_assigns_speaker_by_max_overlap():
    asr_segments = [
        {"start": 0.0, "end": 2.0, "text": "Hi, thanks for calling."},
        {"start": 2.0, "end": 4.0, "text": "I need help with my order."},
        {"start": 4.5, "end": 6.0, "text": "Sure, let me check."},
    ]
    diarization_segments = [
        {"start": 0.0, "end": 2.1, "speaker": "SPEAKER_00"},
        {"start": 1.9, "end": 4.2, "speaker": "SPEAKER_01"},
        {"start": 4.4, "end": 6.1, "speaker": "SPEAKER_00"},
    ]

    merged = merge_transcript_with_speakers(asr_segments, diarization_segments)

    assert merged[0]["speaker"] == "SPEAKER_00"  # 2.0s overlap vs 0.1s
    assert merged[1]["speaker"] == "SPEAKER_01"  # 2.0s overlap vs 0.1s
    assert merged[2]["speaker"] == "SPEAKER_00"  # 1.5s overlap vs 0s
    assert merged[0]["text"] == "Hi, thanks for calling."
    assert merged[0]["start"] == 0.0 and merged[0]["end"] == 2.0


def test_merge_leaves_speaker_none_when_no_overlap():
    asr_segments = [{"start": 100.0, "end": 101.0, "text": "unmatched"}]
    diarization_segments = [{"start": 0.0, "end": 1.0, "speaker": "SPEAKER_00"}]

    merged = merge_transcript_with_speakers(asr_segments, diarization_segments)

    assert merged[0]["speaker"] is None


def test_assign_roles_labels_agent_by_keyword_score():
    merged_segments = [
        {"start": 0.0, "end": 2.0, "text": "Thank you for calling Clearline, my name is Sam.", "speaker": "SPEAKER_00"},
        {"start": 2.0, "end": 4.0, "text": "Hi Sam, I have a problem with my order.", "speaker": "SPEAKER_01"},
        {"start": 4.0, "end": 6.0, "text": "How can I help you with that today?", "speaker": "SPEAKER_00"},
        {"start": 6.0, "end": 8.0, "text": "It hasn't arrived and it's been two weeks.", "speaker": "SPEAKER_01"},
    ]

    labeled = assign_roles(merged_segments)

    assert labeled[0]["speaker"] == "agent"
    assert labeled[1]["speaker"] == "client"
    assert labeled[2]["speaker"] == "agent"
    assert labeled[3]["speaker"] == "client"
    # original list untouched
    assert merged_segments[0]["speaker"] == "SPEAKER_00"


def test_assign_roles_still_works_when_agent_speaks_second():
    # Same content, but SPEAKER_00/01 swapped relative to the previous test —
    # the heuristic should follow the phrases, not speaker-id order.
    merged_segments = [
        {"start": 0.0, "end": 2.0, "text": "Hi, I have a problem with my order.", "speaker": "SPEAKER_00"},
        {"start": 2.0, "end": 4.0, "text": "Thanks for calling, how can I help?", "speaker": "SPEAKER_01"},
        {"start": 4.0, "end": 6.0, "text": "It hasn't arrived in two weeks.", "speaker": "SPEAKER_00"},
    ]

    labeled = assign_roles(merged_segments)

    assert labeled[0]["speaker"] == "client"
    assert labeled[1]["speaker"] == "agent"
    assert labeled[2]["speaker"] == "client"


def test_assign_roles_passes_through_already_resolved_labels():
    merged_segments = [
        {"start": 0.0, "end": 1.0, "text": "hello", "speaker": "agent"},
        {"start": 1.0, "end": 2.0, "text": "hi", "speaker": "client"},
    ]

    labeled = assign_roles(merged_segments)

    assert labeled == merged_segments


def test_assign_roles_rejects_more_than_two_speakers():
    merged_segments = [
        {"start": 0.0, "end": 1.0, "text": "a", "speaker": "SPEAKER_00"},
        {"start": 1.0, "end": 2.0, "text": "b", "speaker": "SPEAKER_01"},
        {"start": 2.0, "end": 3.0, "text": "c", "speaker": "SPEAKER_02"},
    ]

    with pytest.raises(ValueError):
        assign_roles(merged_segments)


# --- End-to-end test using real audio + the real diarization pipeline ---


def test_label_speakers_end_to_end_on_sample_audio():
    sample_path = _find_sample_audio()
    if sample_path is None:
        pytest.skip(
            f"No audio file found in {SAMPLE_AUDIO_DIR}. "
            "Add a call recording (.wav/.mp3/etc) there and re-run this test."
        )

    if not os.environ.get("HF_TOKEN"):
        pytest.skip(
            "HF_TOKEN is not set (see .env.example), so the real pyannote diarization "
            "pipeline can't be loaded. Set it and accept the gated model terms at "
            "https://huggingface.co/pyannote/speaker-diarization-3.1 to run this test."
        )

    from src.stage1_asr.transcribe import transcribe_call
    from src.stage2_diarization.label import label_speakers

    asr_result = transcribe_call(str(sample_path), model_size="medium")
    result = label_speakers(asr_result, str(sample_path))

    assert result["call_id"] == sample_path.stem
    assert isinstance(result["segments"], list)
    assert len(result["segments"]) > 0

    for segment in result["segments"]:
        assert set(segment.keys()) == {"start", "end", "text", "speaker"}
        assert segment["start"] < segment["end"]
        assert segment["text"].strip() != ""
