#!/usr/bin/env python3
"""Real Tauri WebKitGTK export integration: typed UI -> Rust -> FFmpeg -> MP4.

Runner-only stdlib WebDriver/FFprobe, no API mocks and no original-media edits.
Synthetic WebM fixtures and exported MP4 are isolated under temporary HOME/XDG.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import runpy
import subprocess
import tempfile
from uuid import UUID

helpers = runpy.run_path(str(Path(__file__).with_name("test-native-media.py")))
WebDriver = helpers["WebDriver"]
wait_for = helpers["wait_for"]
ready = helpers["ready"]
launch_driver = helpers["launch_driver"]
stop_driver = helpers["stop_driver"]
invoke = helpers["invoke"]
required_success = helpers["required_success"]
expect_error = helpers["expect_error"]
checksum = helpers["checksum"]

PROJECT_NAME = "Creator OS Native MP4 Export E2E"
SOURCE_NAMES = (("render-source-vp8.webm", "vp8"), ("render-source-vp9.webm", "vp9"))


def generate_short_sources(sources: Path, log: Path, duration_seconds: int = 2) -> list[Path]:
    sources.mkdir(parents=True)
    paths: list[Path] = []
    with log.open("w", encoding="utf-8") as output:
        for index, (name, codec) in enumerate(SOURCE_NAMES):
            path = sources / name
            color = "red" if index == 0 else "blue"
            args = [
                "ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
                "-f", "lavfi", "-i", f"color=c={color}:s=320x180:r=30",
                "-t", str(duration_seconds), "-an",
                "-c:v", "libvpx" if codec == "vp8" else "libvpx-vp9",
                "-deadline", "realtime", "-cpu-used", "8",
                str(path),
            ]
            finished = subprocess.run(args, stdout=output, stderr=subprocess.STDOUT, timeout=40, check=False)
            if finished.returncode != 0 or not path.is_file() or path.stat().st_size < 250:
                raise RuntimeError(f"Cannot generate local {codec} fixture: exit {finished.returncode}")
            paths.append(path)
    return paths


def probe_mp4(path: Path) -> dict:
    completed = subprocess.run([
        "ffprobe", "-v", "error", "-show_entries",
        "format=duration:stream=codec_name,codec_type,width,height,pix_fmt,avg_frame_rate",
        "-of", "json", str(path),
    ], capture_output=True, text=True, timeout=20, check=False)
    if completed.returncode != 0:
        raise RuntimeError(f"FFprobe rejected native MP4 output: {completed.stderr[:350]}")
    return json.loads(completed.stdout)


def timeline(driver, project_id):
    return required_success(invoke(driver, "get_timeline", {"projectId": project_id}), "get_timeline")


def wait_timeline(driver, project_id, revision: int, count: int):
    def predicate():
        result = timeline(driver, project_id)
        return result if result["revision"] > revision and len(result["clips"]) == count else None
    return wait_for(f"native timeline revision > {revision} ({count} clips)", predicate, timeout=20)


def wait_ui_revision(driver, revision: int):
    wait_for(f"React timeline revision {revision}", lambda: driver.evaluate(
        "return document.querySelector('[data-testid=timeline-revision]')"
        "?.textContent.includes(arguments[0]) === true;",
        f"Revisión {revision}.",
    ), timeout=15)


def native_export_state(driver):
    return driver.evaluate(
        "var panel=document.querySelector('.export-panel');"
        "return {jobId:panel?.querySelector('.export-progress')?.dataset.exportJobId??null,status:panel?.querySelector('.export-progress-caption strong')?.textContent??null,"
        "progress:panel?.querySelector('progress')?.value??null,"
        "error:panel?.querySelector('.export-error')?.textContent??null,"
        "output:panel?.querySelector('.export-output-path')?.textContent??null};",
    )


def run(executable: Path, output: Path) -> None:
    executable = executable.resolve()
    output.mkdir(parents=True, exist_ok=True)
    if not os.environ.get("DISPLAY") or not executable.is_file() or not os.access(executable, os.X_OK):
        raise RuntimeError("Real Tauri ELF + Xvfb required")
    report: dict[str, object] = {
        "suite": "Real Tauri native FFmpeg MP4 export E2E",
        "result": "failed",
        "scope": "one continuous video track / silent source audio; not cancellation or gapless",
        "steps": [],
    }
    process = None
    driver = None
    with tempfile.TemporaryDirectory(prefix="creator-os-native-export-") as sandbox:
        root = Path(sandbox)
        env = os.environ.copy()
        env.update({
            "HOME": str(root),
            "XDG_DATA_HOME": str(root / "data"),
            "XDG_CONFIG_HOME": str(root / "config"),
            "XDG_CACHE_HOME": str(root / "cache"),
            "WEBKIT_DISABLE_COMPOSITING_MODE": "1",
            "LIBGL_ALWAYS_SOFTWARE": "1",
        })
        for name in ("data", "config", "cache"):
            (root / name).mkdir()
        try:
            sources = generate_short_sources(root / "sources", output / "ffmpeg-fixtures.log")
            hashes = {source.name: checksum(source) for source in sources}
            report["fixture_bytes"] = {source.name: source.stat().st_size for source in sources}
            process, driver = launch_driver(env, output / "tauri-driver.log")
            driver.create(executable)
            driver.request("POST", driver.path("/timeouts"), {"script": 60000})
            ready(driver)
            driver.type_into("#project-name", PROJECT_NAME)
            driver.click(".new-project-form button[type='submit']")
            manifest = wait_for("native project.json", lambda: next((root / "data").rglob("project.json"), None), timeout=18)
            project = json.loads(manifest.read_text(encoding="utf-8"))
            project_id = str(UUID(project["id"]))
            wait_for("export project editor", lambda: driver.evaluate(
                "return document.querySelector('.workspace-header h1')"
                "?.textContent.includes(arguments[0]) === true;", PROJECT_NAME,
            ))
            expect_error(invoke(driver, "start_export", {"projectId": project_id}), "empty_timeline")
            report["steps"].append("empty timeline returns the typed Rust error")

            imported = []
            for path, (_, codec) in zip(sources, SOURCE_NAMES):
                asset = required_success(invoke(driver, "import_media", {
                    "projectId": project_id, "sourcePath": str(path),
                }), "import_media")
                if asset.get("videoCodec") != codec or asset.get("durationSeconds") is None:
                    raise RuntimeError(f"Unexpected native FFprobe metadata for {codec}")
                imported.append(asset)
            # Reload project using the application's real recent-project navigation
            # to refresh the media library (typed command import bypasses only GTK chooser).
            driver.click(".nav-group button.nav-item:first-of-type")
            wait_for("export project in recents", lambda: driver.evaluate(
                "return [...document.querySelectorAll('button.recent-item')]"
                ".some(b=>b.textContent.includes(arguments[0]));", PROJECT_NAME,
            ))
            driver.click("button.recent-item")
            wait_for("two registered media rows", lambda: driver.evaluate(
                "return [...document.querySelectorAll('button.media-row strong')]"
                ".filter(x=>arguments[0].includes(x.textContent)).length === 2;",
                [name for name, _ in SOURCE_NAMES],
            ))
            current = timeline(driver, project_id)
            if current["clips"]:
                raise RuntimeError("Newly created project unexpectedly had clips")
            for asset in imported:
                found = driver.evaluate(
                    "var b=[...document.querySelectorAll('button.media-row')]"
                    ".find(x=>x.textContent.includes(arguments[0]));"
                    "if(!b)return false;b.click();return true;", asset["fileName"],
                )
                if not found:
                    raise RuntimeError("Cannot select native media row")
                wait_for("selected media add button enabled", lambda: driver.evaluate(
                    "return document.querySelector("
                    "'button[title=\\'Añadir el medio seleccionado a su pista\\']')?.disabled === false;",
                ), timeout=12)
                previous = current["revision"]
                driver.click("button[title='Añadir el medio seleccionado a su pista']")
                current = wait_timeline(driver, project_id, previous, len(current["clips"]) + 1)
                wait_ui_revision(driver, current["revision"])
            clips = sorted(current["clips"], key=lambda c: c["startFrame"])
            if len(clips) != 2 or [c["assetId"] for c in clips] != [a["id"] for a in imported]:
                raise RuntimeError("Wrong clips / source IDs in native export timeline")
            if clips[0]["startFrame"] != 0 or clips[1]["startFrame"] != clips[0]["durationFrames"]:
                raise RuntimeError("Native export timeline is not contiguous")
            fps = project["settings"]["fps"]
            expected_seconds = sum(c["durationFrames"] for c in clips) / fps
            if not (3.5 <= expected_seconds <= 4.2):
                raise RuntimeError(f"Unanticipated total exported duration {expected_seconds}")
            persisted = json.loads(manifest.read_text(encoding="utf-8"))["timeline"]
            if persisted["revision"] != current["revision"] or len(persisted["clips"]) != 2:
                raise RuntimeError("Native export timeline not persisted to project.json")
            driver.screenshot(output / "01-export-ready-light.png")
            report["steps"].append("2 contiguous VP8/VP9 clips added and persisted by real native UI")

            driver.click(".export-panel button.button-primary")
            wait_for("real export job UI", lambda: native_export_state(driver)["status"] is not None, timeout=15)
            # Export job IDs are not exposed by the UI, but the UI uses
            # get_export_status and start_export itself; we read the progress and
            # resulting final path from the native UI without mocking either.
            def completed():
                state = native_export_state(driver)
                if state["status"] in ("Exportación fallida", "Exportación cancelada") or state["error"]:
                    raise RuntimeError(f"Native FFmpeg export failed: {state}")
                return state if state["status"] == "Exportación terminada" else None
            final_state = wait_for("actual native H.264/AAC export", completed, timeout=155)
            exported = list((manifest.parent / "exports").glob("creator-export-*.mp4"))
            if len(exported) != 1:
                raise RuntimeError("Exactly one completed MP4 export is expected")
            mp4 = exported[0]
            if str(mp4) not in (final_state["output"] or ""):
                raise RuntimeError("Export UI final path is not the actual MP4")
            if mp4.stat().st_size < 1500:
                raise RuntimeError("Native MP4 output is unexpectedly empty")
            if list((manifest.parent / "exports").glob("*.partial.mp4")):
                raise RuntimeError("Native export left a partial file")
            probe = probe_mp4(mp4)
            streams = probe.get("streams", [])
            video = next((s for s in streams if s.get("codec_type") == "video"), None)
            audio = next((s for s in streams if s.get("codec_type") == "audio"), None)
            if video is None or audio is None:
                raise RuntimeError(f"Output missing H.264 or generated AAC stream: {streams}")
            settings = project["settings"]
            if video["codec_name"] != "h264" or video.get("pix_fmt") != "yuv420p":
                raise RuntimeError(f"MP4 video format was not H.264/yuv420p: {video}")
            if audio["codec_name"] != "aac":
                raise RuntimeError(f"MP4 audio codec was not AAC: {audio}")
            if (video.get("width"), video.get("height")) != (settings["width"], settings["height"]):
                raise RuntimeError(f"MP4 frame size did not match project settings: {video}")
            numer, denom = (int(x) for x in video["avg_frame_rate"].split("/"))
            if abs(numer / denom - fps) > 0.1:
                raise RuntimeError(f"MP4 FPS differs from project settings: {video}")
            duration = float(probe["format"]["duration"])
            if abs(duration - expected_seconds) > 0.28:
                raise RuntimeError(f"MP4 duration {duration} differs from timeline {expected_seconds}")
            if final_state["progress"] != 100:
                raise RuntimeError(f"UI did not report completed render progress: {final_state}")
            # The Rust backend uses the same UUID for its job and output filename.
            # Read the typed job independently via the REAL Tauri command bridge.
            job_id = str(UUID(mp4.stem.removeprefix("creator-export-")))
            job = required_success(invoke(driver, "get_export_status", {"jobId": job_id}), "get_export_status")
            if (job.get("id"), job.get("status"), job.get("progress"), job.get("outputPath")) != (
                job_id, "completed", 1.0, str(mp4)
            ):
                raise RuntimeError(f"Typed Rust export job disagrees with native UI/file: {job}")
            driver.screenshot(output / "02-export-complete-light.png")
            report["export"] = {
                "video_codec": video["codec_name"], "audio_codec": audio["codec_name"],
                "pixel_format": video["pix_fmt"], "dimensions": [video["width"], video["height"]],
                "fps": round(numer / denom, 3), "duration_seconds": round(duration, 3),
                "expected_seconds": round(expected_seconds, 3), "bytes": mp4.stat().st_size, "job_status": job["status"], "job_progress": job["progress"],
            }
            report["steps"].append("native FFmpeg output verified by independent FFprobe")

            for source in sources:
                if checksum(source) != hashes[source.name]:
                    raise RuntimeError(f"Original source was altered: {source.name}")
            if sorted(p.name for p in (manifest.parent / "media").iterdir()) != ["index.json"]:
                raise RuntimeError("Import created unwanted media copies")
            report["source_sha256_unchanged"] = True
            report["steps"].append("original source SHA-256 unchanged; no duplication")
            report["result"] = "passed"
            print("Native Tauri H.264/AAC export E2E passed")
        except Exception as error:
            report["error"] = str(error)
            if driver and driver.session:
                try:
                    driver.screenshot(output / "failure.png")
                except Exception:
                    pass
            raise
        finally:
            (output / "result.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            if driver and process:
                stop_driver(process, driver)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("executable", type=Path)
    parser.add_argument("--output", type=Path, default=Path("native-export"))
    args = parser.parse_args()
    run(args.executable, args.output)
