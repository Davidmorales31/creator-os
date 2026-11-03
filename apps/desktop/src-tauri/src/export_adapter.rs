use std::{ffi::OsString, path::Path};

use creator_os_render_core::RenderPlan;

/// Adapter boundary: all FFmpeg-specific flags and filter syntax live here.
pub fn build_ffmpeg_args(plan: &RenderPlan, output: &Path) -> Vec<OsString> {
    let fps = plan.settings.fps;
    let mut args = vec![
        "-hide_banner".into(), "-nostdin".into(), "-loglevel".into(), "error".into(),
        "-n".into(), "-stats_period".into(), "0.2".into(),
        "-progress".into(), "pipe:1".into(),
    ];
    for segment in &plan.segments {
        let start = segment.source_in_frame as f64 / f64::from(fps);
        let duration = segment.duration_frames as f64 / f64::from(fps);
        args.extend([
            "-ss".into(), format!("{start:.6}").into(),
            "-t".into(), format!("{:.6}", duration + 0.25).into(),
            "-i".into(), OsString::from(&segment.source_path),
        ]);
    }

    let mut filters = Vec::new();
    let mut concat_inputs = String::new();
    for (index, segment) in plan.segments.iter().enumerate() {
        let duration = segment.duration_frames as f64 / f64::from(fps);
        filters.push(format!(
            "[{index}:v:0]fps={fps},scale={}:{}:force_original_aspect_ratio=decrease,\
             pad={}:{}:(ow-iw)/2:(oh-ih)/2,setsar=1,\
             trim=end_frame={},setpts=PTS-STARTPTS,format=yuv420p[v{index}]",
            plan.settings.width, plan.settings.height,
            plan.settings.width, plan.settings.height,
            segment.duration_frames,
        ).replace(' ', ""));
        if segment.has_audio {
            filters.push(format!(
                "[{index}:a:0]atrim=duration={duration:.6},asetpts=PTS-STARTPTS,\
                 aresample=48000,aformat=channel_layouts=stereo[a{index}]",
            ).replace(' ', ""));
        } else {
            filters.push(format!(
                "anullsrc=r=48000:cl=stereo,atrim=duration={duration:.6},\
                 asetpts=PTS-STARTPTS[a{index}]",
            ).replace(' ', ""));
        }
        concat_inputs.push_str(&format!("[v{index}][a{index}]"));
    }
    filters.push(format!(
        "{concat_inputs}concat=n={}:v=1:a=1[vout][aout]",
        plan.segments.len(),
    ));

    args.extend([
        "-filter_complex".into(), filters.join(";").into(),
        "-map".into(), "[vout]".into(),
        "-map".into(), "[aout]".into(),
        "-c:v".into(), "libx264".into(),
        "-preset".into(), "veryfast".into(),
        "-crf".into(), "23".into(),
        "-pix_fmt".into(), "yuv420p".into(),
        "-r".into(), fps.to_string().into(),
        "-c:a".into(), "aac".into(),
        "-b:a".into(), "160k".into(),
        "-ar".into(), "48000".into(),
        "-ac".into(), "2".into(),
        "-threads".into(), "2".into(),
        "-movflags".into(), "+faststart".into(),
        "-f".into(), "mp4".into(),
        OsString::from(output.as_os_str()),
    ]);
    args
}

#[cfg(test)]
mod tests {
    use super::*;
    use creator_os_render_core::{RenderPlan, RenderSegment, RenderSettings};

    fn plan(has_audio: bool) -> RenderPlan {
        RenderPlan {
            timeline_revision: 2,
            settings: RenderSettings { width: 320, height: 180, fps: 30 },
            total_frames: 30,
            segments: vec![RenderSegment {
                asset_id: "asset".into(),
                source_path: "/tmp/media dir/vid;not-shell.mp4".into(),
                source_in_frame: 15,
                duration_frames: 30,
                has_audio,
            }],
        }
    }

    #[test]
    fn args_keep_source_path_as_one_os_argument_and_trim_to_frames() {
        let args = build_ffmpeg_args(&plan(true), Path::new("/tmp/out.partial.mp4"));
        assert!(args.iter().any(|a| a == "/tmp/media dir/vid;not-shell.mp4"));
        assert!(args.iter().any(|a| a == "-nostdin"));
        assert!(args.iter().any(|a| a == "-n"));
        let graph = args.iter().position(|a| a == "-filter_complex").unwrap();
        let graph = args[graph + 1].to_string_lossy();
        assert!(graph.contains("trim=end_frame=30"));
        assert!(graph.contains("[0:a:0]atrim="));
        assert!(graph.contains("concat=n=1:v=1:a=1"));
    }

    #[test]
    fn silent_video_generates_explicit_silent_audio() {
        let args = build_ffmpeg_args(&plan(false), Path::new("out.mp4"));
        let graph = args[args.iter().position(|a| a == "-filter_complex").unwrap() + 1].to_string_lossy();
        assert!(graph.contains("anullsrc=r=48000:cl=stereo"));
        assert!(!graph.contains("[0:a:0]"));
    }

    #[test]
    fn smoke_two_source_clips_when_ffmpeg_available() {
        let ffmpeg = std::env::var("CREATOR_OS_FFMPEG_PATH").unwrap_or_else(|_| "ffmpeg".into());
        if std::process::Command::new(&ffmpeg).arg("-version").output().is_err() {
            eprintln!("FFmpeg not installed: smoke test skipped; CI must install FFmpeg");
            return;
        }
        let dir = std::env::temp_dir().join(format!("creator-os-export-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let first = dir.join("video a.mp4");
        let second = dir.join("video-b.mp4");
        for (file, color) in [(&first, "red"), (&second, "blue")] {
            let status = std::process::Command::new(&ffmpeg)
                .args(["-hide_banner", "-loglevel", "error", "-y",
                    "-f", "lavfi", "-i", &format!("color=c={color}:s=320x180:r=30"),
                    "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
                    "-t", "1.5", "-c:v", "mpeg4", "-c:a", "aac", "-shortest",
                ]).arg(file).status().unwrap();
            assert!(status.success(), "fixture failed");
        }
        let plan = RenderPlan {
            timeline_revision: 1, total_frames: 60,
            settings: RenderSettings { width: 320, height: 180, fps: 30 },
            segments: [(&first, 0, 30, true), (&second, 0, 30, true)]
                .into_iter().enumerate().map(|(i, (p, offset, duration, audio))| RenderSegment {
                    asset_id: i.to_string(), source_path: p.to_string_lossy().into_owned(),
                    source_in_frame: offset, duration_frames: duration, has_audio: audio,
                }).collect(),
        };
        let output = dir.join("export.mp4");
        let status = std::process::Command::new(&ffmpeg)
            .args(build_ffmpeg_args(&plan, &output))
            .stdout(std::process::Stdio::null()).status().unwrap();
        assert!(status.success(), "FFmpeg export failed");
        assert!(std::fs::metadata(&output).unwrap().len() > 1000);
        let info = std::process::Command::new("ffprobe")
            .args(["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1"])
            .arg(&output).output().unwrap();
        assert!(info.status.success());
        let seconds: f64 = String::from_utf8(info.stdout).unwrap().trim().parse().unwrap();
        assert!((seconds - 2.0).abs() < 0.2, "unexpected duration {seconds}");
        std::fs::remove_dir_all(dir).unwrap();
    }
}
