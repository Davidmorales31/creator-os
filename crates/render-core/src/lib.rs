use creator_os_media_core::{MediaAsset, MediaKind};
use creator_os_timeline_core::{Timeline, TimelineError, TrackKind};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderSettings {
    pub width: u32,
    pub height: u32,
    pub fps: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderSegment {
    pub asset_id: String,
    pub source_path: String,
    pub source_in_frame: u64,
    pub duration_frames: u64,
    pub has_audio: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderPlan {
    pub timeline_revision: u64,
    pub settings: RenderSettings,
    pub segments: Vec<RenderSegment>,
    pub total_frames: u64,
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum RenderError {
    #[error("timeline is invalid: {0}")]
    InvalidTimeline(#[from] TimelineError),
    #[error("project dimensions must be positive, even, <= 4096, with FPS between 1 and 120")]
    InvalidSettings,
    #[error("timeline has no video clips")]
    EmptyTimeline,
    #[error("first export supports exactly one populated video track and no separate audio clips")]
    UnsupportedTracks,
    #[error("first export supports only imported video assets (no still images or audio-only media)")]
    UnsupportedMedia,
    #[error("video clips must be continuous starting at frame zero")]
    GappedTimeline,
    #[error("the clip references media missing from the project's catalog")]
    MissingAsset,
    #[error("media has unknown or invalid source duration")]
    InvalidSourceDuration,
    #[error("source metadata or clip range is incompatible with project FPS")]
    InvalidSourceBounds,
    #[error("timeline is too long or contains invalid frame arithmetic")]
    InvalidLength,
}

impl RenderPlan {
    pub fn build(
        timeline: &Timeline,
        assets: &[MediaAsset],
        settings: RenderSettings,
    ) -> Result<Self, RenderError> {
        timeline.validate()?;
        if settings.width == 0 || settings.height == 0
            || settings.width > 4096 || settings.height > 4096
            || !settings.width.is_multiple_of(2) || !settings.height.is_multiple_of(2)
            || !(1..=120).contains(&settings.fps)
        {
            return Err(RenderError::InvalidSettings);
        }

        if timeline.clips.is_empty() { return Err(RenderError::EmptyTimeline); }
        let mut populated_tracks = timeline.clips.iter().map(|clip| clip.track_id.as_str())
            .collect::<std::collections::HashSet<_>>();
        if populated_tracks.len() != 1 {
            return Err(RenderError::UnsupportedTracks);
        }
        let track_id = populated_tracks.drain().next().ok_or(RenderError::EmptyTimeline)?;
        let track = timeline.tracks.iter().find(|track| track.id == track_id)
            .ok_or(RenderError::UnsupportedTracks)?;
        if track.kind != TrackKind::Video {
            return Err(RenderError::UnsupportedTracks);
        }

        let mut clips = timeline.clips.iter().collect::<Vec<_>>();
        clips.sort_by_key(|clip| clip.start_frame);
        let mut cursor = 0_u64;
        let mut segments = Vec::with_capacity(clips.len());
        for clip in clips {
            if clip.start_frame != cursor {
                return Err(RenderError::GappedTimeline);
            }
            let asset = assets.iter().find(|asset| asset.id == clip.asset_id)
                .ok_or(RenderError::MissingAsset)?;
            if asset.kind != MediaKind::Video {
                return Err(RenderError::UnsupportedMedia);
            }
            if asset.source_path.trim().is_empty() { return Err(RenderError::MissingAsset); }
            let duration = asset.duration_seconds.ok_or(RenderError::InvalidSourceDuration)?;
            if !duration.is_finite() || duration <= 0.0
                || duration * f64::from(settings.fps) > u64::MAX as f64
            {
                return Err(RenderError::InvalidSourceDuration);
            }
            let measured_frames = (duration * f64::from(settings.fps)).floor() as u64;
            let end = clip.source_in_frame.checked_add(clip.duration_frames)
                .ok_or(RenderError::InvalidLength)?;
            if end > measured_frames || clip.source_length_frames != Some(measured_frames) {
                return Err(RenderError::InvalidSourceBounds);
            }
            cursor = cursor.checked_add(clip.duration_frames).ok_or(RenderError::InvalidLength)?;
            segments.push(RenderSegment {
                asset_id: asset.id.clone(),
                source_path: asset.source_path.clone(),
                source_in_frame: clip.source_in_frame,
                duration_frames: clip.duration_frames,
                has_audio: asset.audio_codec.is_some(),
            });
        }
        // 24-hour cap keeps accidental monster renders bounded in the initial product.
        if cursor > u64::from(settings.fps) * 60 * 60 * 24 {
            return Err(RenderError::InvalidLength);
        }
        Ok(Self { timeline_revision: timeline.revision, settings, segments, total_frames: cursor })
    }

    pub fn duration_seconds(&self) -> f64 {
        self.total_frames as f64 / f64::from(self.settings.fps)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use creator_os_timeline_core::{Clip, TimelineOperation};

    fn asset(id: &str, audio: bool) -> MediaAsset {
        MediaAsset {
            id: id.into(), file_name: format!("{id}.mp4"), source_path: format!("/tmp/{id}.mp4"),
            kind: MediaKind::Video, file_size_bytes: 800,
            duration_seconds: Some(10.0), width: Some(1280), height: Some(720), fps: Some(30.0),
            video_codec: Some("h264".into()), audio_codec: audio.then_some("aac".into()),
            sample_rate: None, channels: None, imported_at: "now".into(),
        }
    }
    fn clip(id: &str, asset_id: &str, start_frame: u64, duration_frames: u64) -> Clip {
        Clip { id: id.into(), asset_id: asset_id.into(), track_id: "video-1".into(),
            kind: TrackKind::Video, start_frame, source_in_frame: 10,
            duration_frames, source_length_frames: Some(300) }
    }
    fn settings() -> RenderSettings { RenderSettings { width: 1920, height: 1080, fps: 30 } }
    #[test]
    fn deterministic_plan_preserves_source_offsets_order_and_audio() {
        let mut t = Timeline::default();
        t.apply(0, TimelineOperation::AddClip { clip: clip("a", "first", 0, 30) }).unwrap();
        t.apply(1, TimelineOperation::AddClip { clip: clip("b", "second", 30, 45) }).unwrap();
        let p = RenderPlan::build(&t, &[asset("second", false), asset("first", true)], settings()).unwrap();
        assert_eq!(p.segments.len(), 2);
        assert_eq!(p.segments[0].asset_id, "first");
        assert_eq!(p.segments[0].source_in_frame, 10);
        assert_eq!(p.segments[1].asset_id, "second");
        assert!(!p.segments[1].has_audio);
        assert_eq!(p.total_frames, 75);
        assert_eq!(p.duration_seconds(), 2.5);
    }
    #[test]
    fn gapped_timeline_does_not_silently_collapse_or_render_black() {
        let mut t = Timeline::default();
        t.apply(0, TimelineOperation::AddClip { clip: clip("a", "a", 1, 30) }).unwrap();
        assert_eq!(RenderPlan::build(&t, &[asset("a", true)], settings()), Err(RenderError::GappedTimeline));
    }
    #[test]
    fn rejects_audio_tracks_and_missing_assets() {
        let mut t = Timeline::default();
        t.apply(0, TimelineOperation::AddClip { clip: clip("a", "a", 0, 30) }).unwrap();
        assert_eq!(RenderPlan::build(&t, &[], settings()), Err(RenderError::MissingAsset));
        let mut audio = clip("b", "a", 0, 30);
        audio.kind = TrackKind::Audio;
        audio.track_id = "audio-1".into();
        t.apply(1, TimelineOperation::AddClip { clip: audio }).unwrap();
        assert_eq!(RenderPlan::build(&t, &[asset("a", true)], settings()), Err(RenderError::UnsupportedTracks));
    }
    #[test]
    fn rejects_mismatched_source_and_image() {
        let mut t = Timeline::default();
        t.apply(0, TimelineOperation::AddClip { clip: clip("a", "a", 0, 30) }).unwrap();
        let mut a = asset("a", true);
        a.duration_seconds = Some(0.1);
        assert_eq!(RenderPlan::build(&t, &[a.clone()], settings()), Err(RenderError::InvalidSourceBounds));
        a.kind = MediaKind::Image;
        assert_eq!(RenderPlan::build(&t, &[a], settings()), Err(RenderError::UnsupportedMedia));
    }
    #[test]
    fn rejects_invalid_output_settings_and_empty_timeline() {
        let t = Timeline::default();
        assert_eq!(RenderPlan::build(&t, &[], settings()), Err(RenderError::EmptyTimeline));
        let bad = RenderSettings { width: 1921, height: 1080, fps: 30 };
        assert_eq!(RenderPlan::build(&t, &[], bad), Err(RenderError::InvalidSettings));
    }
}
