use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::{Transcript, TranscriptError};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum SubtitleFormat {
    Srt,
    Vtt,
}

impl SubtitleFormat {
    pub const fn extension(self) -> &'static str {
        match self { Self::Srt => "srt", Self::Vtt => "vtt" }
    }
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum SubtitleError {
    #[error("transcript is invalid: {0}")]
    InvalidTranscript(#[from] TranscriptError),
    #[error("transcript contains no speech segments")]
    EmptyTranscript,
    #[error("overlapping transcript segments require manual correction before subtitle export")]
    OverlappingSegments,
    #[error("subtitle text has unsupported control characters")]
    InvalidText,
}

fn timestamp(milliseconds: u64, separator: char) -> String {
    let hours = milliseconds / 3_600_000;
    let minutes = (milliseconds / 60_000) % 60;
    let seconds = (milliseconds / 1_000) % 60;
    let remainder = milliseconds % 1_000;
    format!("{hours:02}:{minutes:02}:{seconds:02}{separator}{remainder:03}")
}

/// Deterministic UTF-8 export: no filesystem, network or runtime dependencies.
///
/// The original source and transcript remain immutable.
pub fn render_subtitles(transcript: &Transcript, format: SubtitleFormat) -> Result<String, SubtitleError> {
    transcript.validate()?;
    if transcript.segments.is_empty() { return Err(SubtitleError::EmptyTranscript); }
    let mut result = match format {
        SubtitleFormat::Srt => String::new(),
        SubtitleFormat::Vtt => String::from("WEBVTT\n\n"),
    };
    let mut previous_end = 0_u64;
    for (index, segment) in transcript.segments.iter().enumerate() {
        if segment.start_ms < previous_end { return Err(SubtitleError::OverlappingSegments); }
        let text = segment.text.trim();
        if text.chars().any(|character| character.is_control()
            && character != '\n' && character != '\r' && character != '\t') {
            return Err(SubtitleError::InvalidText);
        }
        previous_end = segment.end_ms;
        if format == SubtitleFormat::Srt { result.push_str(&format!("{}\n", index + 1)); }
        let separator = if format == SubtitleFormat::Srt { ',' } else { '.' };
        result.push_str(&format!(
            "{} --> {}\n{}\n\n",
            timestamp(segment.start_ms, separator),
            timestamp(segment.end_ms, separator),
            text.replace("\r\n", "\n").replace('\r', "\n")
        ));
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::TranscriptSegment;

    fn transcript() -> Transcript {
        Transcript {
            schema_version: 1,
            asset_id: "asset-1".into(),
            model: "base".into(),
            language: "es".into(),
            segments: vec![
                TranscriptSegment { start_ms: 0, end_ms: 1_250, text: "¡Hola, qué tal!".into() },
                TranscriptSegment { start_ms: 3_600_001, end_ms: 3_602_010, text: "Otra línea".into() },
            ],
        }
    }

    #[test]
    fn exports_srt_with_unicode_and_long_hours() {
        let srt = render_subtitles(&transcript(), SubtitleFormat::Srt).unwrap();
        assert_eq!(srt, concat!(
            "1\n00:00:00,000 --> 00:00:01,250\n¡Hola, qué tal!\n\n",
            "2\n01:00:00,001 --> 01:00:02,010\nOtra línea\n\n"
        ));
    }

    #[test]
    fn exports_webvtt_with_dot_milliseconds() {
        let vtt = render_subtitles(&transcript(), SubtitleFormat::Vtt).unwrap();
        assert_eq!(vtt, concat!(
            "WEBVTT\n\n",
            "00:00:00.000 --> 00:00:01.250\n¡Hola, qué tal!\n\n",
            "01:00:00.001 --> 01:00:02.010\nOtra línea\n\n"
        ));
    }

    #[test]
    fn rejects_overlap_without_altering_source() {
        let mut original = transcript();
        original.segments[1].start_ms = 1_000;
        assert_eq!(render_subtitles(&original, SubtitleFormat::Vtt), Err(SubtitleError::OverlappingSegments));
        assert_eq!(original.segments[1].start_ms, 1_000);
    }

    #[test]
    fn rejects_empty_and_invalid_version() {
        let mut original = transcript();
        original.segments.clear();
        assert_eq!(render_subtitles(&original, SubtitleFormat::Srt), Err(SubtitleError::EmptyTranscript));
        original.schema_version = 2;
        assert!(matches!(render_subtitles(&original, SubtitleFormat::Srt), Err(SubtitleError::InvalidTranscript(_))));
    }

    #[test]
    fn validates_line_breaks_and_rejects_control_characters() {
        let mut original = transcript();
        original.segments[0].text = "Primero\r\nSegundo".into();
        let vtt = render_subtitles(&original, SubtitleFormat::Vtt).unwrap();
        assert!(vtt.contains("Primero\nSegundo"));
        original.segments[0].text = "bad\u{0000}".into();
        assert_eq!(render_subtitles(&original, SubtitleFormat::Vtt), Err(SubtitleError::InvalidText));
    }
}
