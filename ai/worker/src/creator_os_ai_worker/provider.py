"""Replaceable local speech-to-text provider and faster-whisper adapter."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from .transcript import SCHEMA_VERSION, Segment, Transcript, TranscriptValidationError

SUPPORTED_MODELS = ("tiny", "base", "small")
SUPPORTED_LANGUAGES = ("auto", "es", "en")


class TranscriptionError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class TranscriptionOptions:
    model: str = "base"
    language: str = "es"
    allow_download: bool = False

    def validate(self) -> None:
        if self.model not in SUPPORTED_MODELS:
            raise TranscriptionError("invalid_model", "Use tiny, base, or small")
        if self.language not in SUPPORTED_LANGUAGES:
            raise TranscriptionError("invalid_language", "Use es, en, or auto")


class SpeechProvider(Protocol):
    def transcribe(
        self, media_path: Path, asset_id: str, options: TranscriptionOptions
    ) -> Transcript: ...


class FasterWhisperProvider:
    """CPU-first provider. Imports heavy package only when requested."""

    def transcribe(
        self, media_path: Path, asset_id: str, options: TranscriptionOptions
    ) -> Transcript:
        options.validate()
        if not media_path.is_file():
            raise TranscriptionError("media_missing", "Selected media file is missing")
        try:
            from faster_whisper import WhisperModel
        except ImportError as exc:
            raise TranscriptionError(
                "provider_unavailable",
                "Install the optional local transcription dependency: pip install -e 'ai/worker[transcription]'",
            ) from exc

        try:
            # Never download weights unless the user explicitly opts in.
            model = WhisperModel(
                options.model,
                device="cpu",
                compute_type="int8",
                cpu_threads=4,
                local_files_only=not options.allow_download,
            )
        except Exception as exc:
            if not options.allow_download:
                raise TranscriptionError(
                    "model_not_cached",
                    "Model not cached. Choose 'Download model on first use' to install weights.",
                ) from exc
            raise TranscriptionError("model_load_failed", str(exc)) from exc
        try:
            segments, info = model.transcribe(
                str(media_path),
                beam_size=5,
                language=None if options.language == "auto" else options.language,
                vad_filter=True,
                condition_on_previous_text=False,
                word_timestamps=False,
            )
            timed: list[Segment] = []
            for part in segments:  # Generator: inference happens here.
                text = str(part.text).strip()
                if not text:
                    continue
                start = max(0, round(float(part.start) * 1000))
                end = max(start + 1, round(float(part.end) * 1000))
                timed.append(Segment(start, end, text))
            language = str(info.language or options.language)
            transcript = Transcript(
                schema_version=SCHEMA_VERSION,
                asset_id=asset_id,
                model=options.model,
                language=language,
                segments=tuple(timed),
            )
            transcript.validate()
            return transcript
        except TranscriptValidationError as exc:
            raise TranscriptionError("invalid_transcript", str(exc)) from exc
        except Exception as exc:
            raise TranscriptionError("transcription_failed", str(exc)) from exc
