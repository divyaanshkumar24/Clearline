from src import evaluate as evaluate_module


def test_word_count():
    assert evaluate_module._word_count("hello there friend") == 3
    assert evaluate_module._word_count("") == 0


def test_normalize_for_wer():
    assert evaluate_module._normalize_for_wer("Hello, World!") == "hello world"
    assert evaluate_module._normalize_for_wer("  multiple   spaces  ") == "multiple spaces"


def test_find_sample_audio_files(tmp_path):
    (tmp_path / "call1.wav").write_bytes(b"fake")
    (tmp_path / "call2.mp3").write_bytes(b"fake")
    (tmp_path / "notes.txt").write_bytes(b"fake")

    files = evaluate_module._find_sample_audio_files(tmp_path)

    assert [f.name for f in files] == ["call1.wav", "call2.mp3"]


def test_find_sample_audio_files_missing_dir(tmp_path):
    assert evaluate_module._find_sample_audio_files(tmp_path / "missing") == []


def test_reference_path_for(tmp_path):
    (tmp_path / "call1_reference.txt").write_text("hello")

    assert evaluate_module._reference_path_for("call1", tmp_path) is not None
    assert evaluate_module._reference_path_for("call2", tmp_path) is None


def test_evaluate_sample_audio_computes_wer(tmp_path, monkeypatch):
    (tmp_path / "call1.wav").write_bytes(b"fake")
    (tmp_path / "call1_reference.txt").write_text("hello there how are you")

    fake_result = {
        "call_id": "call1",
        "segments": [
            {"start": 0.0, "end": 1.0, "text": "hello there", "speaker": "agent"},
            {"start": 1.0, "end": 2.0, "text": "how are you today", "speaker": "client"},
        ],
        "pivot_point": {"turn_index": None, "description": "no clear pivot detected"},
        "recommendation": {"what_went_wrong": "x", "root_cause": "y", "repair_suggestion": "be nicer"},
    }
    monkeypatch.setattr(evaluate_module, "run_pipeline", lambda audio_path, dual_channel=False: fake_result)

    rows = evaluate_module.evaluate_sample_audio(sample_audio_dir=tmp_path)

    assert len(rows) == 1
    row = rows[0]
    assert row["call_id"] == "call1"
    assert row["word_count"] == 6  # "hello there how are you today"
    assert row["speakers_detected"] == 2
    assert row["pivot_found"] is False
    assert row["has_reference"] is True
    assert row["wer"] is not None and row["wer"] > 0  # "today" is an extra word
    assert row["recommendation_summary"] == "be nicer"


def test_evaluate_sample_audio_no_reference(tmp_path, monkeypatch):
    (tmp_path / "call2.wav").write_bytes(b"fake")

    fake_result = {
        "call_id": "call2",
        "segments": [{"start": 0.0, "end": 1.0, "text": "hi", "speaker": "agent"}],
        "pivot_point": {"turn_index": None, "description": "no clear pivot detected"},
        "recommendation": {"what_went_wrong": "x", "root_cause": "y", "repair_suggestion": "z"},
    }
    monkeypatch.setattr(evaluate_module, "run_pipeline", lambda audio_path, dual_channel=False: fake_result)

    rows = evaluate_module.evaluate_sample_audio(sample_audio_dir=tmp_path)

    assert rows[0]["has_reference"] is False
    assert rows[0]["wer"] is None


def test_evaluate_sample_audio_catches_per_file_errors(tmp_path, monkeypatch):
    (tmp_path / "bad.wav").write_bytes(b"fake")

    def raise_error(audio_path, dual_channel=False):
        raise RuntimeError("boom")

    monkeypatch.setattr(evaluate_module, "run_pipeline", raise_error)

    rows = evaluate_module.evaluate_sample_audio(sample_audio_dir=tmp_path)

    assert rows[0]["call_id"] == "bad"
    assert rows[0]["error"] == "boom"


def test_render_markdown_table_flags_missing_reference():
    rows = [
        {
            "call_id": "call1",
            "word_count": 10,
            "speakers_detected": 2,
            "pivot_found": True,
            "has_reference": True,
            "wer": 0.05,
            "recommendation_summary": "Do the thing.",
        },
        {
            "call_id": "call2",
            "word_count": 20,
            "speakers_detected": 2,
            "pivot_found": False,
            "has_reference": False,
            "wer": None,
            "recommendation_summary": "Do the other thing.",
        },
    ]

    table = evaluate_module.render_markdown_table(rows)

    assert "| call1 | 10 | 2 | yes | 5.0% | Do the thing. |" in table
    assert "| call2 | 20 | 2 | no | — | Do the other thing. |" in table
    assert "**No reference transcript found for:** call2" in table


def test_render_markdown_table_handles_errors():
    rows = [{"call_id": "broken", "error": "something failed"}]

    table = evaluate_module.render_markdown_table(rows)

    assert "| broken | ERROR | ERROR | ERROR | ERROR | something failed |" in table
