# ADR-0008 — Pure segment subtitle export (SRT / WebVTT)

- Status: Accepted
- Date: 2026-11-03
- Issue: #19
- Depends on: ADR-0007 / PR #18

## Decision

The Creator OS `transcript-core` domain owns deterministic serialization of validated timestamped segments to SRT and WebVTT. It takes no dependency on FFmpeg, Tauri, React, Python, filesystem or network. Segment timestamps are integer milliseconds. SRT uses `HH:MM:SS,mmm`, WebVTT uses `HH:MM:SS.mmm` with `WEBVTT` header.

Overlapping or empty segments are explicitly rejected rather than silently changed. Unicode including Spanish accents is preserved; CRLF text is normalized to LF for portable text. This does not perform word alignment or speaker diarization.

Tauri `export_subtitles` receives only registered project, asset and transcript UUIDs plus a typed `SubtitleFormat` enum. It reuses the validated ownership contract from `list_transcripts`. The desktop generates a unique final filename within the project-local `subtitles/` directory, writes UTF-8 to a private temporary file, fsyncs and renames. Existing transcripts, timeline, source media and exports are unchanged.

The Editor exposes two real actions on the selected transcript: Exportar .srt and Exportar .vtt. It shows the locally stored destination, errors and disabled states.

## Explicit boundaries

- Files are **sidecar subtitles**; no burned-in captions, player overlay, timeline subtitle track, MP4 muxing or SRT/VTT imports in this issue.
- Segment-level precision follows Whisper transcript boundaries; it cannot improve alignment without subsequent word-level processing.
- Native manual checks on Windows/macOS/Linux remain required before shipping. Browser screenshot checks use an explicit mocked Tauri adapter.
- No online models, new Python dependencies or model downloads are needed to format already saved transcripts.

## Budget and constraints

Cloud/API $0. CPU/RAM tiny for text formatting; requires local disk for an additional UTF-8 subtitle file. A failed atomic write cleans its temp file. No licensing additions.
