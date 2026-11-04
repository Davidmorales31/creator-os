#!/usr/bin/env python3
"""Native timeline/montage E2E on real Tauri/WebKitGTK: VP8 -> VP9.

Reuses v0.15 real FFmpeg fixtures, typed Tauri commands and isolated WebDriver
environment. Does not simulate media events, decode, or the Tauri bridge.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import runpy
import tempfile
import time

media_helpers = runpy.run_path(str(Path(__file__).with_name("test-native-media.py")))
WebDriver = media_helpers["WebDriver"]
wait_for = media_helpers["wait_for"]
ready = media_helpers["ready"]
generate_fixtures = media_helpers["generate_fixtures"]
checksum = media_helpers["checksum"]
launch_driver = media_helpers["launch_driver"]
stop_driver = media_helpers["stop_driver"]
invoke = media_helpers["invoke"]
required_success = media_helpers["required_success"]
reopen_project = media_helpers["reopen_project"]
select_media = media_helpers["select_media"]
MEDIA_FILES = media_helpers["MEDIA_FILES"]
PROJECT_NAME = media_helpers["PROJECT_NAME"]


def timeline(driver, project_id: str) -> dict:
    return required_success(invoke(driver, "get_timeline", {"projectId": project_id}), "get_timeline")


def wait_revision(driver, project_id: str, revision: int, count: int | None = None):
    def check():
        current = timeline(driver, project_id)
        if current["revision"] <= revision:
            return None
        if count is not None and len(current["clips"]) != count:
            return None
        return current

    try:
        return wait_for(f"timeline revision > {revision}, clips={count}", check, timeout=18)
    except RuntimeError as error:
        try:
            state = driver.evaluate(
                "return {alert:document.querySelector('.error-banner')?.textContent,"
                "help:document.querySelector('.timeline-help')?.textContent,"
                "selection:document.querySelector('.timeline-selection')?.textContent};"
            )
        except Exception:
            state = "unable to read native DOM"
        raise RuntimeError(f"{error}; UI state: {state}") from error


def wait_ui_revision(driver, revision: int) -> None:
    wait_for(f"React timeline revision {revision}", lambda: driver.evaluate(
        "return document.querySelector('.timeline-help')"
        "?.textContent.includes(arguments[0]) === true;",
        f"Revisión {revision}.",
    ), timeout=15)


def press(driver, title: str) -> None:
    driver.click(f"button[title='{title}']")


def native_keyboard_shortcut(driver, *keys: str) -> None:
    # Real W3C WebDriver input events (not synthetic JavaScript KeyboardEvents).
    # The timeline itself must hold focus for the shortcut to be scoped correctly.
    focused = driver.evaluate(
        "var section=document.querySelector('.timeline-live');"
        "section?.focus();return document.activeElement===section;"
    )
    if not focused:
        raise RuntimeError("Native timeline did not accept keyboard focus")
    actions = [{"type": "keyDown", "value": key} for key in keys]
    actions.extend({"type": "keyUp", "value": key} for key in reversed(keys))
    driver.request("POST", driver.path("/actions"), {
        "actions": [{"type": "key", "id": "timeline-shortcuts", "actions": actions}],
    })
    driver.request("DELETE", driver.path("/actions"))


def assert_integrity(paths: list[Path], hashes: dict[str, str], manifest: Path) -> None:
    for source in paths:
        if checksum(source) != hashes[source.name]:
            raise RuntimeError(f"Source video was mutated: {source.name}")
    if sorted(p.name for p in (manifest.parent / "media").iterdir()) != ["index.json"]:
        raise RuntimeError("Project imported/cached source videos unexpectedly")


def video_state(driver):
    return driver.evaluate(
        "var v=document.querySelector('.player-panel video');"
        "if(!v)return null;"
        "return {paused:v.paused,time:v.currentTime,readyState:v.readyState,"
        "assetPath:v.currentSrc ? new URL(v.currentSrc).pathname : '',"
        "ended:v.ended,error:!!v.error};",
    )


def verify_montage_source(driver, asset_id: str, sequence: str) -> bool:
    return bool(driver.evaluate(
        "var v=document.querySelector('.player-panel video');"
        "var note=document.querySelector('.timeline-preview-note');"
        "return !!v && !v.error && v.readyState>=2 && !v.paused"
        " && (new URL(v.currentSrc).pathname).endsWith('/'+arguments[0])"
        " && note?.textContent.includes(arguments[1]);",
        asset_id, sequence,
    ))


def run(executable: Path, output: Path) -> None:
    executable = executable.resolve()
    output.mkdir(parents=True, exist_ok=True)
    if not os.environ.get("DISPLAY") or not executable.is_file() or not os.access(executable, os.X_OK):
        raise RuntimeError("Expected actual executable in Xvfb")
    report: dict[str, object] = {
        "suite": "Tauri real WebKitGTK timeline + VP8 to VP9 montage E2E",
        "result": "failed",
        "scope": "two video clips, UI edits and native clock; not gapless/frame-perfect",
        "steps": [],
    }
    driver = None
    process = None
    with tempfile.TemporaryDirectory(prefix="creator-os-native-montage-") as sandbox:
        root = Path(sandbox)
        env = os.environ.copy()
        env.update({
            "HOME": str(root),
            "XDG_CONFIG_HOME": str(root / "config"),
            "XDG_DATA_HOME": str(root / "data"),
            "XDG_CACHE_HOME": str(root / "cache"),
            "WEBKIT_DISABLE_COMPOSITING_MODE": "1",
            "LIBGL_ALWAYS_SOFTWARE": "1",
        })
        for key in ("config", "data", "cache"):
            (root / key).mkdir()
        try:
            sources = generate_fixtures(root / "sources", output / "ffmpeg-fixtures.log")
            original_hashes = {path.name: checksum(path) for path in sources}
            process, driver = launch_driver(env, output / "tauri-driver.log")
            driver.create(executable)
            driver.request("POST", driver.path("/timeouts"), {"script": 60000})
            ready(driver)
            driver.type_into("#project-name", PROJECT_NAME)
            driver.click(".new-project-form button[type='submit']")
            manifest = wait_for("real project.json", lambda: next((root / "data").rglob("project.json"), None), timeout=18)
            project = json.loads(manifest.read_text(encoding="utf-8"))
            project_id = project["id"]
            wait_for("project editor", lambda: driver.evaluate(
                "return document.querySelector('.workspace-header h1')"
                "?.textContent.includes(arguments[0])===true;", PROJECT_NAME,
            ))
            report["steps"].append("native project created and isolated")

            imported = []
            for path, (_, codec) in zip(sources, MEDIA_FILES):
                asset = required_success(invoke(driver, "import_media", {
                    "projectId": project_id, "sourcePath": str(path),
                }), "import_media")
                if asset.get("videoCodec") != codec:
                    raise RuntimeError(f"Wrong FFprobe codec for {path.name}")
                imported.append(asset)
            reopen_project(driver)
            current = timeline(driver, project_id)
            if current["clips"] or len([t for t in current["tracks"] if t["kind"] == "video"]) != 1:
                raise RuntimeError("Expected empty timeline with one default video track")

            for asset in imported:
                source = asset["fileName"]
                select_media(driver, source)
                revision = current["revision"]
                wait_for("timeline add button available", lambda: driver.evaluate(
                    "return document.querySelector("
                    "'button[title=\\'Añadir el medio seleccionado a su pista\\']')?.disabled === false;",
                ), timeout=15)
                press(driver, "Añadir el medio seleccionado a su pista")
                current = wait_revision(driver, project_id, revision, count=len(current["clips"]) + 1)
                wait_ui_revision(driver, current["revision"])
            clips = sorted(current["clips"], key=lambda c: c["startFrame"])
            if [c["assetId"] for c in clips] != [a["id"] for a in imported]:
                raise RuntimeError("UI added clips in wrong source order")
            if clips[0]["startFrame"] != 0 or clips[1]["startFrame"] != clips[0]["durationFrames"]:
                raise RuntimeError("Two-clip timeline must be contiguous from frame zero")
            if len({c["trackId"] for c in clips}) != 1:
                raise RuntimeError("UI distributed montage clips among multiple video tracks")
            if json.loads(manifest.read_text(encoding="utf-8"))["timeline"]["revision"] != current["revision"]:
                raise RuntimeError("Timeline revision not persisted into project.json")
            report["steps"].append("two contiguous video clips added through real UI; project.json persisted")

            # UI trim end on final clip. Undo and redo to prove stable persistence and source ranges.
            select = driver.evaluate(
                "var b=[...document.querySelectorAll('button.timeline-clip')].find(x=>x.title===arguments[0]);"
                "if(!b)return false;b.click();return true;", MEDIA_FILES[1][0],
            )
            if not select:
                raise RuntimeError("Could not select VP9 timeline clip")
            wait_for("selected VP9 clip in React timeline", lambda: driver.evaluate(
                "return document.querySelector('.timeline-selection')"
                "?.textContent.includes(arguments[0]) === true;",
                MEDIA_FILES[1][0],
            ))
            wait_ui_revision(driver, current["revision"])
            before_trim = current
            driver.click(".timeline-operations button:nth-of-type(5)")
            current = wait_revision(driver, project_id, before_trim["revision"], count=2)
            wait_ui_revision(driver, current["revision"])
            if current["clips"][1]["durationFrames"] != clips[1]["durationFrames"] - project["settings"]["fps"]:
                raise RuntimeError("VP9 tail trim did not remove one second")
            trimmed_revision = current["revision"]
            press(driver, "Deshacer último cambio")
            current = wait_revision(driver, project_id, trimmed_revision, count=2)
            wait_ui_revision(driver, current["revision"])
            if current["clips"][1]["durationFrames"] != clips[1]["durationFrames"]:
                raise RuntimeError("Undo failed to restore final clip")
            undo_revision = current["revision"]
            press(driver, "Rehacer último cambio")
            current = wait_revision(driver, project_id, undo_revision, count=2)
            wait_ui_revision(driver, current["revision"])
            if current["clips"][1]["durationFrames"] != clips[1]["durationFrames"] - project["settings"]["fps"]:
                raise RuntimeError("Redo failed to restore trim")
            report["steps"].append("native trim / undo / redo persisted in project manifest")

            driver.screenshot(output / "01-timeline-light.png")
            driver.click("button[aria-label='Reproducir montaje']")
            wait_for("VP8 montage playback and native clock", lambda: verify_montage_source(
                driver, imported[0]["id"], "Reproduciendo clip 1 de 2",
            ), timeout=28)
            first_state = video_state(driver)
            if not first_state or first_state["error"]:
                raise RuntimeError("First montage source is invalid")
            report["first_clip"] = {"readyState": first_state["readyState"], "clock": round(first_state["time"], 3)}
            report["steps"].append("VP8 montage started using native WebKit clock")

            wait_for("automatic VP8 to VP9 handoff", lambda: verify_montage_source(
                driver, imported[1]["id"], "Reproduciendo clip 2 de 2",
            ), timeout=25)
            second_before = video_state(driver)
            wait_for("VP9 playback advances after handoff", lambda: driver.evaluate(
                "var v=document.querySelector('.player-panel video');"
                "return !!v && !v.paused && !v.error && v.currentTime>arguments[0]+0.3;",
                second_before["time"],
            ), timeout=15)
            report["second_clip"] = {
                "readyState": second_before["readyState"],
                "clock_after_handoff": round(video_state(driver)["time"], 3),
            }
            report["steps"].append("automatic different-file handoff + native VP9 clock")
            driver.click("button[aria-label='Activar modo oscuro']")
            wait_for("dark theme", lambda: driver.evaluate(
                "return document.documentElement.dataset.theme === 'dark';",
            ))
            driver.screenshot(output / "02-vp9-montage-dark.png")

            driver.click("button[aria-label='Detener montaje']")
            wait_for("montage controls reset and native video paused", lambda: driver.evaluate(
                "return !!document.querySelector('button[aria-label=\\'Reproducir montaje\\']')"
                " && document.querySelector('.player-panel video')?.paused === true;",
            ), timeout=12)
            time.sleep(1.1)
            if video_state(driver)["paused"] is not True:
                raise RuntimeError("Native media resumed after montage stop")
            report["steps"].append("stop keeps native video paused; no stale continuation")

            # Move final clip one second right: montage planner must reject the gap,
            # then undo the move so the source project is left in a valid state.
            select = driver.evaluate(
                "var b=[...document.querySelectorAll('button.timeline-clip')].find(x=>x.title===arguments[0]);"
                "if(!b)return false;b.click();return true;", MEDIA_FILES[1][0],
            )
            if not select:
                raise RuntimeError("Could not reselect last clip for gap test")
            revision = current["revision"]
            press(driver, "Mover un segundo a la derecha")
            current = wait_revision(driver, project_id, revision, count=2)
            wait_ui_revision(driver, current["revision"])
            driver.click("button[aria-label='Reproducir montaje']")
            wait_for("explicit timeline gap notice", lambda: driver.evaluate(
                "return document.querySelector('.timeline-preview-notice')"
                "?.textContent.includes('espacio vacío') === true;",
            ))
            if driver.evaluate("return !!document.querySelector('button[aria-label=\\'Detener montaje\\']');"):
                raise RuntimeError("Invalid montage started despite timeline gap")
            revision = current["revision"]
            press(driver, "Deshacer último cambio")
            current = wait_revision(driver, project_id, revision, count=2)
            report["steps"].append("invalid-gap montage rejected; undo restored contiguous project")
            wait_ui_revision(driver, current["revision"])

            # Native key actions hit the actual React-focused timeline. Rust remains
            # responsible for revisions, persistence, undo and redo.
            revision = current["revision"]
            native_keyboard_shortcut(driver, chr(0xE009), "z")
            current = wait_revision(driver, project_id, revision, count=2)
            wait_ui_revision(driver, current["revision"])
            if current["clips"][1]["durationFrames"] != clips[1]["durationFrames"]:
                raise RuntimeError("Ctrl+Z did not undo the native VP9 trim")
            revision = current["revision"]
            native_keyboard_shortcut(driver, chr(0xE009), chr(0xE008), "z")
            current = wait_revision(driver, project_id, revision, count=2)
            wait_ui_revision(driver, current["revision"])
            if current["clips"][1]["durationFrames"] != clips[1]["durationFrames"] - project["settings"]["fps"]:
                raise RuntimeError("Ctrl+Shift+Z did not redo native VP9 trim")

            selected = driver.evaluate(
                "var b=[...document.querySelectorAll('button.timeline-clip')]"
                ".find(x=>x.title===arguments[0]);"
                "if(!b)return false;b.click();return true;",
                MEDIA_FILES[1][0],
            )
            if not selected:
                raise RuntimeError("Could not select native clip for shortcuts")
            wait_for("VP9 selected for keyboard operation", lambda: driver.evaluate(
                "return document.querySelector('.timeline-selection')"
                "?.textContent.includes(arguments[0])===true;", MEDIA_FILES[1][0],
            ))
            revision = current["revision"]
            native_keyboard_shortcut(driver, "s")
            current = wait_revision(driver, project_id, revision, count=3)
            wait_ui_revision(driver, current["revision"])
            revision = current["revision"]
            native_keyboard_shortcut(driver, chr(0xE009), "z")
            current = wait_revision(driver, project_id, revision, count=2)
            wait_ui_revision(driver, current["revision"])

            # Deleting the selected clip must be reversible, even using keyboard.
            selected = driver.evaluate(
                "var b=[...document.querySelectorAll('button.timeline-clip')]"
                ".find(x=>x.title===arguments[0]);"
                "if(!b)return false;b.click();return true;",
                MEDIA_FILES[1][0],
            )
            if not selected:
                raise RuntimeError("Cannot reselect VP9 clip for keyboard delete")
            revision = current["revision"]
            native_keyboard_shortcut(driver, chr(0xE017))
            current = wait_revision(driver, project_id, revision, count=1)
            wait_ui_revision(driver, current["revision"])
            revision = current["revision"]
            native_keyboard_shortcut(driver, chr(0xE009), "z")
            current = wait_revision(driver, project_id, revision, count=2)
            wait_ui_revision(driver, current["revision"])
            report["steps"].append("real WebDriver Ctrl+Z/Shift+Z, S, Delete and undo preserve Rust timeline")
            driver.screenshot(output / "03-keyboard-edits-dark.png")
            assert_integrity(sources, original_hashes, manifest)
            report["source_sha256_unchanged"] = True
            report["project_revision"] = current["revision"]
            report["result"] = "passed"
            print("Native timeline + VP8 -> VP9 montage E2E passed")
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


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("executable", type=Path)
    parser.add_argument("--output", type=Path, default=Path("native-montage"))
    args = parser.parse_args()
    run(args.executable, args.output)


if __name__ == "__main__":
    main()
