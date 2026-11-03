use serde::{Deserialize, Serialize};
use thiserror::Error;

pub const TIMELINE_SCHEMA_VERSION: u32 = 1;
const HISTORY_LIMIT: usize = 50;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TrackKind {
    Video,
    Audio,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    pub id: String,
    pub name: String,
    pub kind: TrackKind,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Clip {
    pub id: String,
    pub asset_id: String,
    pub track_id: String,
    pub kind: TrackKind,
    pub start_frame: u64,
    pub source_in_frame: u64,
    pub duration_frames: u64,
    // None is permitted for still images and assets with unknown duration.
    pub source_length_frames: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineSnapshot {
    pub tracks: Vec<Track>,
    pub clips: Vec<Clip>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Timeline {
    pub schema_version: u32,
    pub revision: u64,
    pub tracks: Vec<Track>,
    pub clips: Vec<Clip>,
    #[serde(default)]
    undo_stack: Vec<TimelineSnapshot>,
    #[serde(default)]
    redo_stack: Vec<TimelineSnapshot>,
}

impl Default for Timeline {
    fn default() -> Self {
        Self {
            schema_version: TIMELINE_SCHEMA_VERSION,
            revision: 0,
            tracks: vec![
                Track { id: "video-1".into(), name: "Video 1".into(), kind: TrackKind::Video },
                Track { id: "audio-1".into(), name: "Audio 1".into(), kind: TrackKind::Audio },
            ],
            clips: Vec::new(),
            undo_stack: Vec::new(),
            redo_stack: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum TimelineOperation {
    AddTrack { track: Track },
    AddClip { clip: Clip },
    MoveClip { clip_id: String, track_id: String, start_frame: u64 },
    SplitClip { clip_id: String, right_clip_id: String, at_frame: u64 },
    TrimClip {
        clip_id: String,
        start_frame: u64,
        source_in_frame: u64,
        duration_frames: u64,
    },
    DeleteClip { clip_id: String },
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum TimelineError {
    #[error("timeline version is unsupported")]
    UnsupportedVersion,
    #[error("timeline has duplicate ids")]
    DuplicateId,
    #[error("track or clip does not exist")]
    NotFound,
    #[error("clip kind must match track kind")]
    IncompatibleTrack,
    #[error("duration must be positive and offsets must be valid")]
    InvalidRange,
    #[error("clips cannot overlap on a track")]
    Overlap,
    #[error("timeline edit is stale; reload latest revision")]
    StaleRevision,
    #[error("nothing to undo or redo")]
    EmptyHistory,
}

impl Timeline {
    pub fn snapshot(&self) -> TimelineSnapshot {
        TimelineSnapshot { tracks: self.tracks.clone(), clips: self.clips.clone() }
    }

    pub fn validate(&self) -> Result<(), TimelineError> {
        if self.schema_version != TIMELINE_SCHEMA_VERSION { return Err(TimelineError::UnsupportedVersion); }
        let mut track_ids = std::collections::HashSet::new();
        for track in &self.tracks {
            if track.id.trim().is_empty() || track.name.trim().is_empty() || !track_ids.insert(&track.id) {
                return Err(TimelineError::DuplicateId);
            }
        }
        let mut clip_ids = std::collections::HashSet::new();
        for clip in &self.clips {
            if clip.id.trim().is_empty() || clip.asset_id.trim().is_empty() || !clip_ids.insert(&clip.id) {
                return Err(TimelineError::DuplicateId);
            }
            self.validate_clip(clip)?;
        }
        for (index, first) in self.clips.iter().enumerate() {
            for second in self.clips.iter().skip(index + 1) {
                if first.track_id == second.track_id
                    && first.start_frame < second.start_frame + second.duration_frames
                    && second.start_frame < first.start_frame + first.duration_frames
                {
                    return Err(TimelineError::Overlap);
                }
            }
        }
        Ok(())
    }

    fn validate_clip(&self, clip: &Clip) -> Result<(), TimelineError> {
        let track = self.tracks.iter().find(|item| item.id == clip.track_id).ok_or(TimelineError::NotFound)?;
        if track.kind != clip.kind { return Err(TimelineError::IncompatibleTrack); }
        if clip.duration_frames == 0
            || clip.start_frame.checked_add(clip.duration_frames).is_none()
            || clip.source_in_frame.checked_add(clip.duration_frames).is_none()
        {
            return Err(TimelineError::InvalidRange);
        }
        if let Some(max) = clip.source_length_frames {
            if clip.source_in_frame + clip.duration_frames > max { return Err(TimelineError::InvalidRange); }
        }
        Ok(())
    }

    pub fn apply(&mut self, expected_revision: u64, operation: TimelineOperation) -> Result<(), TimelineError> {
        self.check_revision(expected_revision)?;
        self.validate()?;
        let before = self.snapshot();
        let mut next = self.clone();
        next.apply_unchecked(operation)?;
        next.validate()?;
        // A successful no-op does not pollute undo history.
        if next.snapshot() == before { return Ok(()); }
        next.push_undo(before);
        next.redo_stack.clear();
        next.revision = self.revision.checked_add(1).ok_or(TimelineError::InvalidRange)?;
        *self = next;
        Ok(())
    }

    pub fn undo(&mut self, expected_revision: u64) -> Result<(), TimelineError> {
        self.check_revision(expected_revision)?;
        let mut next = self.clone();
        let before = next.undo_stack.pop().ok_or(TimelineError::EmptyHistory)?;
        let current = next.snapshot();
        next.redo_stack.push(current);
        next.tracks = before.tracks;
        next.clips = before.clips;
        next.validate()?;
        next.revision = self.revision.checked_add(1).ok_or(TimelineError::InvalidRange)?;
        *self = next;
        Ok(())
    }

    pub fn redo(&mut self, expected_revision: u64) -> Result<(), TimelineError> {
        self.check_revision(expected_revision)?;
        let mut next = self.clone();
        let after = next.redo_stack.pop().ok_or(TimelineError::EmptyHistory)?;
        let current = next.snapshot();
        next.push_undo(current);
        next.tracks = after.tracks;
        next.clips = after.clips;
        next.validate()?;
        next.revision = self.revision.checked_add(1).ok_or(TimelineError::InvalidRange)?;
        *self = next;
        Ok(())
    }

    fn check_revision(&self, expected: u64) -> Result<(), TimelineError> {
        if expected != self.revision { Err(TimelineError::StaleRevision) } else { Ok(()) }
    }

    fn push_undo(&mut self, snapshot: TimelineSnapshot) {
        self.undo_stack.push(snapshot);
        if self.undo_stack.len() > HISTORY_LIMIT { self.undo_stack.remove(0); }
    }

    fn apply_unchecked(&mut self, operation: TimelineOperation) -> Result<(), TimelineError> {
        match operation {
            TimelineOperation::AddTrack { track } => {
                if self.tracks.iter().any(|candidate| candidate.id == track.id) { return Err(TimelineError::DuplicateId); }
                self.tracks.push(track);
            }
            TimelineOperation::AddClip { clip } => {
                if self.clips.iter().any(|candidate| candidate.id == clip.id) { return Err(TimelineError::DuplicateId); }
                self.clips.push(clip);
            }
            TimelineOperation::MoveClip { clip_id, track_id, start_frame } => {
                let clip = self.clips.iter_mut().find(|candidate| candidate.id == clip_id).ok_or(TimelineError::NotFound)?;
                clip.track_id = track_id;
                clip.start_frame = start_frame;
            }
            TimelineOperation::SplitClip { clip_id, right_clip_id, at_frame } => {
                if self.clips.iter().any(|candidate| candidate.id == right_clip_id) { return Err(TimelineError::DuplicateId); }
                let left = self.clips.iter_mut().find(|candidate| candidate.id == clip_id).ok_or(TimelineError::NotFound)?;
                let end = left.start_frame.checked_add(left.duration_frames).ok_or(TimelineError::InvalidRange)?;
                if at_frame <= left.start_frame || at_frame >= end { return Err(TimelineError::InvalidRange); }
                let offset = at_frame - left.start_frame;
                let mut right = left.clone();
                right.id = right_clip_id;
                right.start_frame = at_frame;
                right.source_in_frame += offset;
                right.duration_frames -= offset;
                left.duration_frames = offset;
                self.clips.push(right);
            }
            TimelineOperation::TrimClip { clip_id, start_frame, source_in_frame, duration_frames } => {
                let clip = self.clips.iter_mut().find(|candidate| candidate.id == clip_id).ok_or(TimelineError::NotFound)?;
                clip.start_frame = start_frame;
                clip.source_in_frame = source_in_frame;
                clip.duration_frames = duration_frames;
            }
            TimelineOperation::DeleteClip { clip_id } => {
                let index = self.clips.iter().position(|candidate| candidate.id == clip_id).ok_or(TimelineError::NotFound)?;
                self.clips.remove(index);
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn clip(id: &str, start: u64) -> Clip {
        Clip { id: id.into(), asset_id: "asset-1".into(), track_id: "video-1".into(),
            kind: TrackKind::Video, start_frame: start, source_in_frame: 0,
            duration_frames: 60, source_length_frames: Some(180) }
    }

    #[test]
    fn add_move_split_trim_delete_and_undo_redo() {
        let mut t = Timeline::default();
        t.apply(0, TimelineOperation::AddClip { clip: clip("a", 0) }).unwrap();
        t.apply(1, TimelineOperation::MoveClip { clip_id: "a".into(), track_id: "video-1".into(), start_frame: 30 }).unwrap();
        t.apply(2, TimelineOperation::SplitClip { clip_id: "a".into(), right_clip_id: "b".into(), at_frame: 50 }).unwrap();
        assert_eq!(t.clips[0].duration_frames, 20);
        assert_eq!(t.clips[1].source_in_frame, 20);
        t.apply(3, TimelineOperation::TrimClip { clip_id: "b".into(), start_frame: 55, source_in_frame: 25, duration_frames: 30 }).unwrap();
        t.apply(4, TimelineOperation::DeleteClip { clip_id: "a".into() }).unwrap();
        assert_eq!(t.clips.len(), 1);
        t.undo(5).unwrap();
        assert_eq!(t.clips.len(), 2);
        t.undo(6).unwrap();
        assert_eq!(t.clips[1].duration_frames, 40);
        t.redo(7).unwrap();
        assert_eq!(t.clips[1].duration_frames, 30);
        assert!(matches!(t.redo(8), Err(TimelineError::EmptyHistory)));
    }

    #[test]
    fn invalid_edits_are_atomic() {
        let mut t = Timeline::default();
        t.apply(0, TimelineOperation::AddClip { clip: clip("a", 0) }).unwrap();
        let before = t.clone();
        assert_eq!(t.apply(1, TimelineOperation::AddClip { clip: clip("b", 20) }), Err(TimelineError::Overlap));
        assert_eq!(t, before);
        assert_eq!(t.apply(0, TimelineOperation::DeleteClip { clip_id: "a".into() }), Err(TimelineError::StaleRevision));
        assert_eq!(t, before);
    }

    #[test]
    fn rejects_invalid_source_bounds_track_and_split() {
        let mut t = Timeline::default();
        assert_eq!(t.apply(0, TimelineOperation::SplitClip { clip_id: "missing".into(), right_clip_id: "b".into(), at_frame: 15 }), Err(TimelineError::NotFound));
        let mut bad = clip("x", 0);
        bad.source_in_frame = 160;
        assert_eq!(t.apply(0, TimelineOperation::AddClip { clip: bad }), Err(TimelineError::InvalidRange));
        let mut bad = clip("x", 0);
        bad.track_id = "audio-1".into();
        assert_eq!(t.apply(0, TimelineOperation::AddClip { clip: bad }), Err(TimelineError::IncompatibleTrack));
        t.apply(0, TimelineOperation::AddClip { clip: clip("x", 0) }).unwrap();
        assert_eq!(t.apply(1, TimelineOperation::SplitClip { clip_id: "x".into(), right_clip_id: "y".into(), at_frame: 60 }), Err(TimelineError::InvalidRange));
    }

    #[test]
    fn operations_roundtrip_serialization_and_history_persists() {
        let operation = TimelineOperation::MoveClip { clip_id: "c".into(), track_id: "video-1".into(), start_frame: 180 };
        let json = serde_json::to_string(&operation).unwrap();
        assert_eq!(serde_json::from_str::<TimelineOperation>(&json).unwrap(), operation);
        let mut t = Timeline::default();
        t.apply(0, TimelineOperation::AddClip { clip: clip("a", 0) }).unwrap();
        let encoded = serde_json::to_string(&t).unwrap();
        let mut decoded: Timeline = serde_json::from_str(&encoded).unwrap();
        decoded.undo(1).unwrap();
        assert!(decoded.clips.is_empty());
        decoded.redo(2).unwrap();
        assert_eq!(decoded.clips.len(), 1);
    }

    #[test]
    fn undo_history_is_bounded() {
        let mut t = Timeline::default();
        for i in 0..60 {
            t.apply(i, TimelineOperation::AddClip { clip: clip(&format!("clip-{i}"), i * 65) }).unwrap();
        }
        for i in 0..HISTORY_LIMIT { t.undo(60 + i as u64).unwrap(); }
        assert_eq!(t.undo(110), Err(TimelineError::EmptyHistory));
    }
}
