"""One-shot local subprocess entrypoint.

python -m creator_os_ai_worker.transcribe_cli --media <validated path>
  --asset-id <id> --output <temp JSON> [--model base] [--language es] [--allow-download]

The desktop owns paths and starts this command with an argv array (never a shell).
"""
from __future__ import annotations

import argparse
import json
import os
from collections.abc import Sequence
from pathlib import Path

from .provider import FasterWhisperProvider, TranscriptionError, TranscriptionOptions
from .transcript import TranscriptValidationError


def run(
    args: Sequence[str] | None = None,
    provider: FasterWhisperProvider | None = None,
) -> int:
    parser = argparse.ArgumentParser(description="Creator OS local transcription worker")
    parser.add_argument("--media", required=True)
    parser.add_argument("--asset-id", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--model", default="base")
    parser.add_argument("--language", default="es")
    parser.add_argument("--allow-download", action="store_true")
    parsed = parser.parse_args(args)
    output = Path(parsed.output)
    try:
        options = TranscriptionOptions(parsed.model, parsed.language, parsed.allow_download)
        options.validate()
        transcript = (provider or FasterWhisperProvider()).transcribe(
            Path(parsed.media), parsed.asset_id, options
        )
        if transcript.asset_id != parsed.asset_id:
            raise TranscriptionError("invalid_transcript", "Wrong asset ID returned by provider")
        # The desktop supplied a unique temp path. Never overwrite a completed transcript.
        with output.open("x", encoding="utf-8") as result:
            json.dump({"result": transcript.to_camel_dict()}, result, ensure_ascii=False)
            result.flush()
            os.fsync(result.fileno())
        return 0
    except (TranscriptionError, TranscriptValidationError, OSError) as exc:
        code = exc.code if isinstance(exc, TranscriptionError) else "transcription_failed"
        # Worker failures are written to a private temp output for typed desktop errors.
        payload = {"error": {"code": code, "message": str(exc)}}
        try:
            with output.open("x", encoding="utf-8") as result:
                json.dump(payload, result, ensure_ascii=False)
        except OSError:
            pass
        return 1


if __name__ == "__main__":
    raise SystemExit(run())
