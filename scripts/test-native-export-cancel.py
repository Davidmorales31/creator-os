#!/usr/bin/env python3
"""Cancel a REAL running FFmpeg export from the native Creator OS Tauri UI.

Reuses the v0.18 release/WebDriver/media harness, no mocked Tauri commands,
no synthetic job status, and no production dependencies. A runner-only wrapper
execs real FFmpeg with -re before every input for a reproducible running window.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import runpy
import shutil
import tempfile
import time
from uuid import UUID

helpers = runpy.run_path(str(Path(__file__).with_name("test-native-export.py")))
ready = helpers["ready"]
wait_for = helpers["wait_for"]
launch_driver = helpers["launch_driver"]
stop_driver = helpers["stop_driver"]
invoke = helpers["invoke"]
required_success = helpers["required_success"]
expect_error = helpers["expect_error"]
checksum = helpers["checksum"]
timeline = helpers["timeline"]
wait_timeline = helpers["wait_timeline"]
wait_ui_revision = helpers["wait_ui_revision"]
native_export_state = helpers["native_export_state"]
generate_short_sources = helpers["generate_short_sources"]
SOURCE_NAMES = helpers["SOURCE_NAMES"]

PROJECT_NAME = "Creator OS Native Export Cancellation E2E"
SOURCE_SECONDS = 9


def real_ffmpeg_throttle_wrapper(sandbox: Path) -> Path:
    """Only changes the test runner FFmpeg read rate; never fakes render output."""
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("FFmpeg executable missing on native Linux runner")
    wrapper = sandbox / "ffmpeg-ci-readrate"
    wrapper.write_text(
        "#!/usr/bin/env python3\n"
        "import os, sys\n"
        "args=[]\n"
        "for arg in sys.argv[1:]:\n"
        "    if arg == '-i': args.append('-re')\n"
        "    args.append(arg)\n"
        f"os.execv({ffmpeg!r}, [{ffmpeg!r}, *args])\n",
        encoding="utf-8",
    )
    wrapper.chmod(0o700)
    return wrapper


def active_ffmpeg_pids(job_id: str) -> list[int]:
    """Find only the exact FFmpeg child for this job via the unique temp MP4."""
    token = f".creator-export-{job_id}.partial.mp4".encode()
    pids: list[int] = []
    for proc in Path("/proc").iterdir():
        if not proc.name.isdigit():
            continue
        try:
            command = (proc / "cmdline").read_bytes()
        except (OSError, PermissionError):
            continue
        if not command or token not in command:
            continue
        exe = command.split(b"\0", 1)[0].lower()
        if b"ffmpeg" in exe:
            pids.append(int(proc.name))
    return pids


def typed_status(driver, job_id: str) -> dict:
    return required_success(
        invoke(driver, "get_export_status", {"jobId": job_id}),
        "get_export_status",
    )


def assert_cancelled(driver, job_id: str, export_dir: Path) -> dict:
    def complete():
        status = typed_status(driver, job_id)
        if status["status"] in ("completed", "failed"):
            raise RuntimeError(f"Job terminated without cancellation: {status}")
        return status if status["status"] == "cancelled" else None

    final = wait_for(f"real Rust cancellation of job {job_id}", complete, timeout=26)
    if final.get("outputPath") is not None or final.get("error") is not None:
        raise RuntimeError(f"Cancelled Rust job returned output/error: {final}")
    wait_for("native UI shows cancellation", lambda: (
        native_export_state(driver)["status"] == "Exportación cancelada"
        and native_export_state(driver)["jobId"] == job_id
    ), timeout=20)
    wait_for("real FFmpeg process terminated", lambda: not active_ffmpeg_pids(job_id), timeout=18)
    # Check ALL directory entries, including dotfiles. No partial, no finished MP4.
    unexpected = [entry.name for entry in export_dir.iterdir() if entry.suffix == ".mp4"]
    if unexpected:
        raise RuntimeError(f"Cancelled export left output or partial files: {unexpected}")
    return {
        "status": final["status"],
        "progress": final["progress"],
        "output_is_null": final["outputPath"] is None,
        "ffmpeg_processes_remaining": active_ffmpeg_pids(job_id),
        "remaining_mp4_files": unexpected,
    }


def start_from_real_ui(driver) -> str:
    driver.click(".export-panel button.button-primary")
    job_id = wait_for("new native export job ID", lambda: native_export_state(driver)["jobId"], timeout=18)
    # A callback may have observed an earlier job; the test only uses this function
    # after initial creation or explicitly waiting for a distinct ID in caller.
    str(UUID(job_id))
    return job_id


def wait_real_running(driver, job_id: str) -> list[int]:
    def running():
        job = typed_status(driver, job_id)
        if job["status"] in ("completed", "failed", "cancelled"):
            raise RuntimeError(f"FFmpeg did not remain running for cancellation: {job['status']}")
        if job["status"] != "running":
            return None
        pids = active_ffmpeg_pids(job_id)
        if not pids:
            return None
        state = native_export_state(driver)
        if state["jobId"] != job_id or state["status"] != "Renderizando":
            return None
        return pids
    return wait_for(f"actual running FFmpeg PID and native UI: {job_id}", running, timeout=25)


def run(executable: Path, output: Path) -> None:
    executable = executable.resolve()
    output.mkdir(parents=True, exist_ok=True)
    if not os.environ.get("DISPLAY") or not executable.is_file() or not os.access(executable, os.X_OK):
        raise RuntimeError("Native Tauri ELF under Xvfb required")
    if not Path("/proc").is_dir():
        raise RuntimeError("Linux /proc process observation required")

    report: dict[str, object] = {
        "suite": "Real native FFmpeg cancellation / job recovery E2E",
        "result": "failed",
        "scope": "Linux WebKitGTK; throttled *real* FFmpeg input, no synthetic job states",
        "steps": [],
    }
    process = None
    driver = None
    with tempfile.TemporaryDirectory(prefix="creator-os-export-cancel-") as sandbox:
        root = Path(sandbox)
        wrapper = real_ffmpeg_throttle_wrapper(root)
        env = os.environ.copy()
        env.update({
            "HOME": str(root),
            "XDG_DATA_HOME": str(root / "data"),
            "XDG_CONFIG_HOME": str(root / "config"),
            "XDG_CACHE_HOME": str(root / "cache"),
            "WEBKIT_DISABLE_COMPOSITING_MODE": "1",
            "LIBGL_ALWAYS_SOFTWARE": "1",
            "CREATOR_OS_FFMPEG_PATH": str(wrapper),
        })
        for subdir in ("data", "config", "cache"):
            (root / subdir).mkdir()
        try:
            sources = generate_short_sources(root / "sources", output / "ffmpeg-fixtures.log", SOURCE_SECONDS)
            original_hashes = {source.name: checksum(source) for source in sources}
            report["fixture_bytes"] = {source.name: source.stat().st_size for source in sources}
            process, driver = launch_driver(env, output / "tauri-driver.log")
            driver.create(executable)
            driver.request("POST", driver.path("/timeouts"), {"script": 60000})
            ready(driver)
            driver.type_into("#project-name", PROJECT_NAME)
            driver.click(".new-project-form button[type='submit']")
            manifest = wait_for("isolated native project.json", lambda: next((root / "data").rglob("project.json"), None), timeout=20)
            project = json.loads(manifest.read_text(encoding="utf-8"))
            project_id = str(UUID(project["id"]))
            wait_for("real export project editor", lambda: driver.evaluate(
                "return document.querySelector('.workspace-header h1')"
                "?.textContent.includes(arguments[0]) === true;", PROJECT_NAME,
            ))
            imported = []
            for file, (_, codec) in zip(sources, SOURCE_NAMES):
                asset = required_success(invoke(driver, "import_media", {
                    "projectId": project_id, "sourcePath": str(file),
                }), "import_media")
                if asset.get("videoCodec") != codec:
                    raise RuntimeError(f"Expected {codec}, received {asset.get('videoCodec')}")
                imported.append(asset)

            # Trigger the same UI reload path as the v0.18 export test; no GTK chooser.
            driver.click(".nav-group button.nav-item:first-of-type")
            wait_for("project in native recents", lambda: driver.evaluate(
                "return [...document.querySelectorAll('button.recent-item')]"
                ".some(b=>b.textContent.includes(arguments[0]));", PROJECT_NAME,
            ))
            driver.click("button.recent-item")
            wait_for("two imported native media assets", lambda: driver.evaluate(
                "return [...document.querySelectorAll('button.media-row strong')]"
                ".filter(x=>arguments[0].includes(x.textContent)).length === 2;",
                [name for name, _ in SOURCE_NAMES],
            ))
            current = timeline(driver, project_id)
            for asset in imported:
                clicked = driver.evaluate(
                    "var b=[...document.querySelectorAll('button.media-row')]"
                    ".find(x=>x.textContent.includes(arguments[0]));"
                    "if(!b)return false;b.click();return true;", asset["fileName"],
                )
                if not clicked:
                    raise RuntimeError("Cannot select source to add to timeline")
                wait_for("timeline add button enabled", lambda: driver.evaluate(
                    "return document.querySelector("
                    "'button[title=\\'Añadir el medio seleccionado a su pista\\']')?.disabled === false;",
                ))
                revision, count = current["revision"], len(current["clips"])
                driver.click("button[title='Añadir el medio seleccionado a su pista']")
                current = wait_timeline(driver, project_id, revision, count + 1)
                wait_ui_revision(driver, current["revision"])
            clips = sorted(current["clips"], key=lambda c: c["startFrame"])
            if len(clips) != 2 or clips[0]["startFrame"] != 0 or (
                clips[1]["startFrame"] != clips[0]["durationFrames"]
            ) or [c["assetId"] for c in clips] != [a["id"] for a in imported]:
                raise RuntimeError("Expected two contiguous real UI video clips")
            if json.loads(manifest.read_text(encoding="utf-8"))["timeline"]["revision"] != current["revision"]:
                raise RuntimeError("Native timeline revision not persisted")
            report["steps"].append("two sources imported and contiguous timeline created through native UI")

            export_dir = manifest.parent / "exports"
            driver.screenshot(output / "01-cancel-ready-light.png")
            job_id = start_from_real_ui(driver)
            pids = wait_real_running(driver, job_id)
            report["observed_running_ffmpeg_process_count"] = len(pids)
            # A second typed Rust start must reject the active export.
            expect_error(invoke(driver, "start_export", {"projectId": project_id}), "export_busy")
            if typed_status(driver, job_id)["status"] != "running":
                raise RuntimeError("First render completed before clicking native Cancelar")
            driver.screenshot(output / "02-cancel-running-light.png")
            report["steps"].append("real FFmpeg process running, second export blocked with export_busy")

            driver.click(".export-panel .export-cancel")
            first = assert_cancelled(driver, job_id, export_dir)
            report["first_cancel"] = first
            driver.screenshot(output / "03-cancelled-light.png")
            report["steps"].append("native Cancelar terminated the actual FFmpeg process and removed partial MP4")

            # A fresh export must start after Rust releases its active-job lock.
            driver.click(".export-panel button.button-primary")
            next_job_id = wait_for("new distinct export job after cancellation", lambda: (
                (state["jobId"] if state["jobId"] and state["jobId"] != job_id else None)
                if (state := native_export_state(driver)) else None
            ), timeout=18)
            str(UUID(next_job_id))
            next_pids = wait_real_running(driver, next_job_id)
            if not next_pids:
                raise RuntimeError("Second export did not spawn real FFmpeg")
            driver.click(".export-panel .export-cancel")
            second = assert_cancelled(driver, next_job_id, export_dir)
            report["second_cancel"] = second
            report["steps"].append("new export started after cancellation; second cancellation cleaned up")

            for source in sources:
                if checksum(source) != original_hashes[source.name]:
                    raise RuntimeError(f"Source was modified by cancelled export: {source.name}")
            if sorted(p.name for p in (manifest.parent / "media").iterdir()) != ["index.json"]:
                raise RuntimeError("Imported media were duplicated")
            report["source_sha256_unchanged"] = True
            report["result"] = "passed"
            driver.screenshot(output / "04-recovery-cancelled-light.png")
            print("Real native FFmpeg cancellation / recovery E2E passed")
        except Exception as error:
            report["error"] = str(error)
            if driver and driver.session:
                try:
                    driver.screenshot(output / "failure.png")
                except Exception:
                    pass
            raise
        finally:
            (output / "result.json").write_text(
                json.dumps(report, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            if driver and process:
                stop_driver(process, driver)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("executable", type=Path)
    parser.add_argument("--output", type=Path, default=Path("native-export-cancel"))
    args = parser.parse_args()
    run(args.executable, args.output)
