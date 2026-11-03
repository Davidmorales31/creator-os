use serde::{Deserialize, Serialize};
use thiserror::Error;

pub const TRANSCRIPT_SCHEMA_VERSION: u32 = 1;
pub const MAX_SEGMENTS: usize = 100_000;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptSegment {
    pub start_ms: u64,
    pub end_ms: u64,
    pub text: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Transcript {
    pub schema_version: u32,
    pub asset_id: String,
    pub model: String,
    pub language: String,
    pub segments: Vec<TranscriptSegment>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptRecord {
    pub id: String,
    pub created_at: String,
    #[serde(flatten)]
    pub transcript: Transcript,
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum TranscriptError {
    #[error("unsupported transcript schema")]
    UnsupportedVersion,
    #[error("transcript has missing metadata")]
    MissingMetadata,
    #[error("transcript contains invalid or out-of-order segments")]
    InvalidSegment,
    #[error("transcript exceeds segment count limit")]
    TooManySegments,
}

impl Transcript {
    pub fn validate(&self) -> Result<(), TranscriptError> {
        if self.schema_version != TRANSCRIPT_SCHEMA_VERSION {
            return Err(TranscriptError::UnsupportedVersion);
        }
        if self.asset_id.is_empty() || self.model.is_empty() || self.language.is_empty() {
            return Err(TranscriptError::MissingMetadata);
        }
        if self.segments.len() > MAX_SEGMENTS {
            return Err(TranscriptError::TooManySegments);
        }
        let mut last_start = 0;
        for segment in &self.segments {
            if segment.start_ms < last_start
                || segment.end_ms <= segment.start_ms
                || segment.text.trim().is_empty()
                || segment.text.len() > 20_000
            {
                return Err(TranscriptError::InvalidSegment);
            }
            last_start = segment.start_ms;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn example() -> Transcript {
        Transcript {
            schema_version: 1,
            asset_id: "asset-1".into(),
            model: "base".into(),
            language: "es".into(),
            segments: vec![
                TranscriptSegment {
                    start_ms: 0,
                    end_ms: 900,
                    text: "Hola".into(),
                },
                TranscriptSegment {
                    start_ms: 1100,
                    end_ms: 1900,
                    text: "mundo".into(),
                },
            ],
        }
    }

    #[test]
    fn roundtrips_versioned_camel_case_contract() {
        let transcript = example();
        transcript.validate().unwrap();
        let encoded = serde_json::to_string(&transcript).unwrap();
        assert!(encoded.contains("\"schemaVersion\":1"));
        assert_eq!(
            serde_json::from_str::<Transcript>(&encoded).unwrap(),
            transcript
        );
    }

    #[test]
    fn rejects_bad_timestamps_and_order() {
        let mut transcript = example();
        transcript.segments[1].start_ms = 0;
        transcript.segments[1].end_ms = 0;
        assert_eq!(transcript.validate(), Err(TranscriptError::InvalidSegment));
        transcript.segments[1].end_ms = 20;
        assert!(transcript.validate().is_ok());
        transcript.segments[1].start_ms = 1;
        transcript.segments[0].start_ms = 5;
        assert_eq!(transcript.validate(), Err(TranscriptError::InvalidSegment));
    }

    #[test]
    fn rejects_future_version() {
        let mut transcript = example();
        transcript.schema_version = 2;
        assert_eq!(
            transcript.validate(),
            Err(TranscriptError::UnsupportedVersion)
        );
    }
}
