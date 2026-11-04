#!/usr/bin/env python3
"""Real Linux Tauri media E2E: FFprobe import + VP8/VP9 WebKit playback.

Uses the actual Tauri invoke bridge and release executable, never mocked commands.
A native GTK file chooser is intentionally not exercised in this milestone.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import runpy
import signal
import subprocess
import tempfile
import time
from uuid import UUID

shared = runpy.run_path(str(Path(__file__).with_name("test-native-projects.py")))
WebDriver = shared["WebDriver"]
wait_for = shared["wait_for"]
ready = shared["ready"]

PROJECT_NAME = "Creator OS Native Media E2E"
MEDIA_FILES = (("ci-scene-vp8.webm", "vp8"), ("ci-scene-vp9.webm", "vp9"))


def generate_fixtures(directory: Path, log: Path) -> list[Path]:
    directory.mkdir(parents=True, exist_ok=True)
    fixtures: list[Path] = []
    with log.open("w", encoding="utf-8") as output:
        for name, codec in MEDIA_FILES:
            path = directory / name
            generator = "testsrc2=size=320x180:rate=24" if codec == "vp8" else "color=c=blue:size=320x180:rate=24"
            cmd = [
                "ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error",
                "-f", "lavfi", "-i", generator, "-t", "8", "-an",
                "-c:v", "libvpx" if codec == "vp8" else "libvpx-vp9",
                "-deadline", "realtime", "-cpu-used", "8",
                "-b:v", "180k", "-y", str(path),
            ]
            finished = subprocess.run(cmd, stdout=output, stderr=subprocess.STDOUT, timeout=45, check=False)
            if finished.returncode != 0 or not path.is_file() or path.stat().st_size < 200:
                raise RuntimeError(f"Fixture generation failed for {codec} (exit {finished.returncode})")
            fixtures.append(path)
    return fixtures


def checksum(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as data:
        for block in iter(lambda: data.read(128 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def launch_driver(env: dict[str, str], log_path: Path):
    log = log_path.open("w", encoding="utf-8")
    try:
        process = subprocess.Popen(
            ["tauri-driver"], env=env, stdout=log,
            stderr=subprocess.STDOUT, start_new_session=True,
        )
    finally:
        log.close()
    driver = WebDriver("http://127.0.0.1:4444")
    wait_for("tauri-driver status", lambda: driver.request("GET", "/status"), timeout=25)
    return process, driver


def stop_driver(process, driver) -> None:
    try:
        driver.close()
    finally:
        if process.poll() is None:
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=6)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait(timeout=6)


def invoke(driver, command: str, args: dict):
    # WebDriver async script waits for the real Tauri promise to settle.
    result = driver.request("POST", driver.path("/execute/async"), {
        "script": (
            "var done=arguments[arguments.length-1];"
            "var command=arguments[0], options=arguments[1];"
            "if (!window.__TAURI_INTERNALS__ || typeof window.__TAURI_INTERNALS__.invoke !== 'function') {"
            "done({ok:false,failure:{code:'bridge_unavailable',message:'Tauri invoke bridge missing'}});return;}"
            "window.__TAURI_INTERNALS__.invoke(command,options)"
            ".then(v=>done({ok:true,value:v}),e=>done({ok:false,failure:{code:e?.code??null,message:e?.message??String(e)}}));"
        ),
        "args": [command, args],
    }, timeout=65)
    if not isinstance(result, dict) or "ok" not in result:
        raise RuntimeError(f"Unexpected native command result for {command}: {type(result).__name__}")
    return result


def required_success(result: dict, command: str):
    if result["ok"] is not True:
        raise RuntimeError(f"Native {command} failed: {result.get('failure')}")
    return result["value"]


def expect_error(result: dict, expected_code: str) -> None:
    if result["ok"] is not False:
        raise RuntimeError(f"Expected typed {expected_code} error, command succeeded")
    code = (result.get("failure") or {}).get("code")
    if code != expected_code:
        raise RuntimeError(f"Expected typed {expected_code}, received {code}: {result.get('failure')}")


def create_project(driver) -> str:
    ready(driver)
    driver.type_into("#project-name", PROJECT_NAME)
    driver.click(".new-project-form button[type='submit']")
    wait_for("native project editor", lambda: driver.evaluate(
        "return !!document.querySelector('.workspace-header h1')"
        " && document.querySelector('.workspace-header h1').textContent.includes(arguments[0]);",
        PROJECT_NAME,
    ))
    return "created"


def reopen_project(driver) -> None:
    driver.click(".nav-group button.nav-item:first-of-type")
    wait_for("native recent project", lambda: driver.evaluate(
        "return [...document.querySelectorAll('button.recent-item')]"
        ".some(b=>b.textContent.includes(arguments[0]));", PROJECT_NAME,
    ))
    driver.click("button.recent-item")
    wait_for("native media workspace", lambda: driver.evaluate(
        "return document.querySelector('.workspace-header h1')"
        "?.textContent.includes(arguments[0]) === true;", PROJECT_NAME,
    ))
    wait_for("both real media entries in UI", lambda: driver.evaluate(
        "return [...document.querySelectorAll('button.media-row strong')]"
        ".filter(n=>arguments[0].includes(n.textContent)).length === 2;",
        [name for name, _ in MEDIA_FILES],
    ))


def select_media(driver, name: str) -> None:
    success = driver.evaluate(
        "var row=[...document.querySelectorAll('button.media-row')]"
        ".find(x=>x.textContent.includes(arguments[0]));"
        "if(!row)return false;row.click();return true;", name,
    )
    if not success:
        raise RuntimeError(f"Native media row was not rendered: {name}")


def verify_playback(driver, asset_id: str, label: str) -> dict:
    def is_loaded():
        return driver.evaluate(
            "var v=document.querySelector('video');"
            "if(!v)return false;"
            "var p=v.currentSrc?new URL(v.currentSrc).pathname:'';"
            "return v.readyState>=2 && !v.error && Number.isFinite(v.duration)"
            " && v.duration>7 && p.includes(arguments[0]);", asset_id,
        )

    wait_for(f"{label} native WebKit metadata and gateway src", is_loaded, timeout=45)
    before = driver.evaluate("return document.querySelector('video')?.currentTime ?? null;")
    driver.click("button[aria-label='Play']")
    wait_for(f"{label} clock advances during real playback", lambda: driver.evaluate(
        "var v=document.querySelector('video');"
        "return !!v && !v.paused && !v.error && v.currentTime>arguments[0]+0.35"
        " && v.readyState>=2;", float(before),
    ), timeout=25)
    state = driver.evaluate(
        "var v=document.querySelector('video');"
        "return {currentTime:v.currentTime,duration:v.duration,paused:v.paused,"
        "sourcePath:new URL(v.currentSrc).pathname,readyState:v.readyState};",
    )
    if not state["sourcePath"].endswith("/" + asset_id):
        raise RuntimeError(f"{label} media gateway serves the wrong asset")
    driver.click("button[aria-label='Pause']")
    wait_for(f"{label} paused", lambda: driver.evaluate(
        "return document.querySelector('video')?.paused === true;",
    ))
    return {"duration": round(state["duration"], 2), "clock_after_play": round(state["currentTime"], 2), "decoded_ready_state": state["readyState"]}


def run(executable: Path, output: Path, timeout: int) -> None:
    executable = executable.resolve()
    output.mkdir(parents=True, exist_ok=True)
    if not os.environ.get("DISPLAY") or not executable.is_file() or not os.access(executable, os.X_OK):
        raise RuntimeError("Requires a runnable native Tauri ELF inside Xvfb")
    report: dict[str, object] = {"test": "Tauri FFprobe + two-codec WebKit media E2E", "result": "failed", "steps": []}
    process = None
    driver = None
    with tempfile.TemporaryDirectory(prefix="creator-os-native-media-") as temp:
        root = Path(temp)
        data = root / "data"
        env = os.environ.copy()
        env.update({
            "HOME": str(root),
            "XDG_DATA_HOME": str(data),
            "XDG_CONFIG_HOME": str(root / "config"),
            "XDG_CACHE_HOME": str(root / "cache"),
            "WEBKIT_DISABLE_COMPOSITING_MODE": "1",
            "LIBGL_ALWAYS_SOFTWARE": "1",
        })
        for directory in (data, root / "config", root / "cache"):
            directory.mkdir()
        try:
            sources = generate_fixtures(root / "sources", output / "ffmpeg-fixtures.log")
            initial_hashes = {path.name: checksum(path) for path in sources}
            (root / "sources" / "broken.webm").write_bytes(b"not a real video")
            report["fixture_bytes"] = {path.name: path.stat().st_size for path in sources}
            report["steps"].append("isolated FFmpeg VP8/VP9 sources generated")

            # First run deliberately lacks FFprobe, to verify the typed native failure.
            broken_env = dict(env)
            broken_env["CREATOR_OS_FFPROBE_PATH"] = str(root / "missing-ffprobe")
            process, driver = launch_driver(broken_env, output / "tauri-driver-no-ffprobe.log")
            driver.create(executable)
            driver.request("POST", driver.path("/timeouts"), {"script": 60000})
            create_project(driver)
            manifest = wait_for("native project.json", lambda: next(data.rglob("project.json"), None), timeout=15)
            project = json.loads(manifest.read_text(encoding="utf-8"))
            if project.get("name") != PROJECT_NAME:
                raise RuntimeError("project.json name mismatch")
            project_id = str(UUID(project["id"]))
            expect_error(invoke(driver, "import_media", {
                "projectId": project_id, "sourcePath": str(sources[0]),
            }), "ffprobe_unavailable")
            report["steps"].append("typed ffprobe_unavailable through real Rust command")
            stop_driver(process, driver)
            process, driver = None, None
            time.sleep(1)

            # Second run uses the runner's real FFprobe and the same persisted project.
            process, driver = launch_driver(env, output / "tauri-driver-media.log")
            driver.create(executable)
            driver.request("POST", driver.path("/timeouts"), {"script": 60000})
            ready(driver)
            driver.click("button.recent-item")
            wait_for("existing project after native restart", lambda: driver.evaluate(
                "return document.querySelector('.workspace-header h1')"
                "?.textContent.includes(arguments[0]) === true;", PROJECT_NAME,
            ))
            expect_error(invoke(driver, "import_media", {
                "projectId": project_id, "sourcePath": str(root / "sources" / "broken.webm"),
            }), "media_probe_failed")
            report["steps"].append("typed media_probe_failed for invalid source")

            imported = []
            for path, (_, codec) in zip(sources, MEDIA_FILES):
                asset = required_success(invoke(driver, "import_media", {
                    "projectId": project_id, "sourcePath": str(path),
                }), "import_media")
                if str(UUID(asset["id"])) != asset["id"] or asset["kind"] != "video":
                    raise RuntimeError(f"Invalid native imported asset for {codec}")
                if asset["videoCodec"] != codec or asset["width"] != 320 or asset["height"] != 180:
                    raise RuntimeError(f"Unexpected FFprobe metadata for {codec}: {asset}")
                if asset["durationSeconds"] is None or not (7 <= asset["durationSeconds"] <= 9):
                    raise RuntimeError(f"Unexpected duration from native FFprobe for {codec}")
                if asset["fileSizeBytes"] != path.stat().st_size or asset["sourcePath"] != str(path.resolve()):
                    raise RuntimeError(f"Native catalog did not preserve source reference for {codec}")
                imported.append(asset)
            assets = required_success(invoke(driver, "list_project_media", {
                "projectId": project_id,
            }), "list_project_media")
            if {a["id"] for a in assets} != {a["id"] for a in imported} or len(assets) != 2:
                raise RuntimeError("Native media catalog does not contain the two registered assets")
            catalog = json.loads((manifest.parent / "media" / "index.json").read_text(encoding="utf-8"))
            if len(catalog.get("assets", [])) != 2:
                raise RuntimeError("Persisted media index is incorrect")
            report["steps"].append("two real FFprobe assets registered in on-disk catalog")

            reopen_project(driver)
            for index, (name, codec) in enumerate(MEDIA_FILES):
                select_media(driver, name)
                asset = next(a for a in imported if a["videoCodec"] == codec)
                report[codec] = verify_playback(driver, asset["id"], codec)
                if index == 0:
                    driver.screenshot(output / "01-vp8-light.png")
                    driver.click("button[aria-label='Activar modo oscuro']")
                    wait_for("dark theme in real WebKit", lambda: driver.evaluate(
                        "return document.documentElement.dataset.theme==='dark';",
                    ))
                else:
                    driver.screenshot(output / "02-vp9-dark.png")
            report["steps"].append("WebKitGTK VP8 and VP9 playback, both real gateway URLs")

            for source in sources:
                if checksum(source) != initial_hashes[source.name]:
                    raise RuntimeError(f"Original video changed after import/playback: {source.name}")
            media_dir = manifest.parent / "media"
            if sorted(p.name for p in media_dir.iterdir()) != ["index.json"]:
                raise RuntimeError("Import copied or created media files in project media directory")
            report["source_sha256_unchanged"] = True
            report["steps"].append("SHA-256 unchanged, references only, no copied originals")
            report["result"] = "passed"
            print("Native VP8/VP9 media E2E passed, with typed FFprobe error cases")
        except Exception as error:
            report["error"] = str(error)
            if driver and driver.session:
                try:
                    driver.screenshot(output / "failure.png")
                except Exception:
                    pass
            raise
        finally:
            (output / "result.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
            if process and driver:
                stop_driver(process, driver)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("executable", type=Path)
    parser.add_argument("--output", type=Path, default=Path("native-media"))
    parser.add_argument("--timeout", type=int, default=55)
    args = parser.parse_args()
    if not 10 <= args.timeout <= 120:
        parser.error("--timeout must be 10–120 seconds")
    run(args.executable, args.output, args.timeout)


if __name__ == "__main__":
    main()
