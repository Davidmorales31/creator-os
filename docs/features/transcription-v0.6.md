# Creator OS — Local Transcription v0.6

The first transcription slice transforms **imported audio/video containing an audio stream** into timestamped text segments.

## Developer setup

Use the development branch `feat/local-transcription`. Install the Python worker into the interpreter used by the app:

```sh
python -m pip install -e "ai/worker[dev,transcription]"
```

Then start Creator OS via `pnpm --filter @creator-os/desktop tauri:dev`.

If Tauri uses a different Python interpreter, set `CREATOR_OS_PYTHON_PATH` to the Python executable where `creator-os-ai-worker` is installed. The command runs as `python -m creator_os_ai_worker.transcribe_cli` with Rust-validated arguments. No HTTP server or separate manually started process is needed.

Select an imported MP4/WAV/MP3 with an audio stream in the Editor. In the **Transcripción** panel choose a model (`tiny`, `base`, `small`), language (`es`, `en`, auto), then click **Transcribir medio**.

**Important:** A model may need to be downloaded from Hugging Face on its first invocation. The checkbox is **off by default**. Enable it only if you authorize the download. With model weights already cached, turn the checkbox off and transcribe offline.

Only **one transcription** is processed at a time. No progress percentage is shown until a completed transcript exists. Use **Cancelar** to terminate an active worker. Successful results are persisted in the application's local project data under `audio/transcripts/<job-id>.json`; the app can reload them after restart.

## Supported v0.6

- Project-bound assets only, without media uploads
- Spanish, English and automatic language detection
- Segments with integer millisecond start/end
- Immutable transcript revisions, copy plain text
- Explicit empty, dependency missing, uncached model, failed and cancelled states

## Not yet included

Word-by-word karaoke, diarization, synchronization to multi-track timeline, automatic captions, subtitles in MP4, SRT/VTT export and cloned voices.

## Tests

```sh
python -m pip install -e "ai/worker[dev]"
ruff check ai/worker
pytest ai/worker
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

The tests use a fake provider, **not a downloaded AI model**. CI cannot certify actual inference accuracy/throughput; validate one real local recording manually before final native merge. No unexpected cloud or API spending is introduced. First-time downloads and local CPU/RAM/disk usage are real costs.

## Next steps

Subtitle export, background job persistence, word-level timing, timeline sync and model packaging require separate issues/ADRs.
