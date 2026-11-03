import json
from pathlib import Path

import pytest

from creator_os_ai_worker.provider import TranscriptionError, TranscriptionOptions
from creator_os_ai_worker.transcribe_cli import run
from creator_os_ai_worker.transcript import Segment, Transcript, TranscriptValidationError


class FakeSpeechProvider:
    def transcribe(self, media_path: Path, asset_id: str, options: TranscriptionOptions) -> Transcript:
        assert media_path.name == "movie.mp4"
        assert options.language == "es"
        return Transcript(1, asset_id, options.model, "es", (
            Segment(0, 1100, "Hola mundo"),
            Segment(1210, 1900, "Qué tal"),
        ))


def test_cli_serializes_local_timed_segments_without_model_download(tmp_path: Path) -> None:
    media = tmp_path / "movie.mp4"
    media.write_bytes(b"test data")
    output = tmp_path / "output.json"
    status = run(
        ["--media", str(media), "--asset-id", "asset-1", "--output", str(output)],
        FakeSpeechProvider(),
    )
    assert status == 0
    data = json.loads(output.read_text(encoding="utf-8"))["result"]
    assert data["schemaVersion"] == 1
    assert data["segments"] == [
        {"startMs": 0, "endMs": 1100, "text": "Hola mundo"},
        {"startMs": 1210, "endMs": 1900, "text": "Qué tal"},
    ]


def test_invalid_option_writes_typed_error(tmp_path: Path) -> None:
    output = tmp_path / "error.json"
    status = run(
        ["--media", "movie.mp4", "--asset-id", "id", "--output", str(output),
         "--language", "not-valid"],
        FakeSpeechProvider(),
    )
    assert status == 1
    assert json.loads(output.read_text())["error"]["code"] == "invalid_language"


@pytest.mark.parametrize("segment", [
    Segment(-1, 100, "invalid"),
    Segment(100, 100, "invalid"),
    Segment(1, 100, " "),
    Segment(1, 100, "x" * 20_001),
])
def test_rejects_invalid_segments(segment: Segment) -> None:
    with pytest.raises(TranscriptValidationError):
        segment.validate()


def test_segments_are_chronological_and_versioned() -> None:
    bad = Transcript(1, "a", "base", "es", (Segment(100, 200, "one"), Segment(0, 90, "two")))
    with pytest.raises(TranscriptValidationError):
        bad.validate()
    with pytest.raises(TranscriptValidationError):
        Transcript(2, "a", "base", "es", ()).validate()


def test_model_download_defaults_to_denied() -> None:
    assert TranscriptionOptions().allow_download is False
    with pytest.raises(TranscriptionError) as error:
        TranscriptionOptions("unsupported", "es", False).validate()
    assert error.value.code == "invalid_model"
