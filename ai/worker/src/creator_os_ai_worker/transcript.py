"""Creator OS-owned, versioned transcript contract. No inference dependency."""
from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

SCHEMA_VERSION = 1
MAX_SEGMENTS = 100_000
MAX_TEXT_LENGTH = 20_000


class TranscriptValidationError(ValueError):
    pass


@dataclass(frozen=True)
class Segment:
    start_ms: int
    end_ms: int
    text: str

    def validate(self) -> None:
        if (
            type(self.start_ms) is not int
            or type(self.end_ms) is not int
            or self.start_ms < 0
            or self.end_ms <= self.start_ms
            or not self.text.strip()
            or len(self.text) > MAX_TEXT_LENGTH
        ):
            raise TranscriptValidationError("Invalid timed transcript segment")


@dataclass(frozen=True)
class Transcript:
    schema_version: int
    asset_id: str
    model: str
    language: str
    segments: tuple[Segment, ...]

    def validate(self) -> None:
        if self.schema_version != SCHEMA_VERSION:
            raise TranscriptValidationError("Unsupported transcript schema")
        if not self.asset_id or not self.model or not self.language:
            raise TranscriptValidationError("Missing required transcript metadata")
        if len(self.segments) > MAX_SEGMENTS:
            raise TranscriptValidationError("Transcript too large")
        last_start = -1
        for segment in self.segments:
            segment.validate()
            if segment.start_ms < last_start:
                raise TranscriptValidationError("Segments must be ordered")
            last_start = segment.start_ms

    def to_dict(self) -> dict[str, Any]:
        self.validate()
        return asdict(self) | {"segments": [asdict(s) for s in self.segments]}

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Transcript:
        try:
            transcript = cls(
                schema_version=data["schemaVersion"] if "schemaVersion" in data else data["schema_version"],
                asset_id=data["assetId"] if "assetId" in data else data["asset_id"],
                model=data["model"],
                language=data["language"],
                segments=tuple(
                    Segment(
                        start_ms=s["startMs"] if "startMs" in s else s["start_ms"],
                        end_ms=s["endMs"] if "endMs" in s else s["end_ms"],
                        text=s["text"],
                    )
                    for s in data["segments"]
                ),
            )
        except (KeyError, TypeError) as exc:
            raise TranscriptValidationError("Malformed transcript payload") from exc
        transcript.validate()
        return transcript

    def to_camel_dict(self) -> dict[str, Any]:
        self.validate()
        return {
            "schemaVersion": self.schema_version,
            "assetId": self.asset_id,
            "model": self.model,
            "language": self.language,
            "segments": [
                {"startMs": s.start_ms, "endMs": s.end_ms, "text": s.text}
                for s in self.segments
            ],
        }
