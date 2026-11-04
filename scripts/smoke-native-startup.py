#!/usr/bin/env python3
"""Smoke-test an actual Creator OS Linux Tauri executable in a virtual X11 display.

Invoke under xvfb-run; do not use this as evidence of feature-level native acceptance.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import signal
import subprocess
import tempfile
import time


def command(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, capture_output=True, text=True, timeout=8, check=False)


def find_window() -> str | None:
    result = command("xdotool", "search", "--onlyvisible", "--name", "^Creator OS$")
    if result.returncode != 0:
        return None
    for window_id in result.stdout.splitlines():
        title = command("xdotool", "getwindowname", window_id)
        if title.returncode == 0 and title.stdout.strip() == "Creator OS":
            return window_id
    return None


def geometry_for(window_id: str) -> tuple[int, int]:
    result = command("xdotool", "getwindowgeometry", "--shell", window_id)
    if result.returncode != 0:
        raise RuntimeError("Cannot read native window geometry: " + result.stderr.strip())
    values = dict(line.strip().split("=", 1) for line in result.stdout.splitlines() if "=" in line)
    return int(values["WIDTH"]), int(values["HEIGHT"])


def run(executable: Path, output: Path, timeout: int) -> None:
    output.mkdir(parents=True, exist_ok=True)
    if "DISPLAY" not in os.environ:
        raise RuntimeError("DISPLAY is missing: run this script with xvfb-run")
    executable = executable.resolve()
    if not executable.is_file() or not os.access(executable, os.X_OK):
        raise RuntimeError(f"Native executable is not runnable: {executable}")

    with tempfile.TemporaryDirectory(prefix="creator-os-native-smoke-") as sandbox:
        home = Path(sandbox)
        environment = os.environ.copy()
        environment.update({
            "HOME": str(home),
            "XDG_CONFIG_HOME": str(home / "config"),
            "XDG_DATA_HOME": str(home / "data"),
            "XDG_CACHE_HOME": str(home / "cache"),
            "WEBKIT_DISABLE_COMPOSITING_MODE": "1",
            "LIBGL_ALWAYS_SOFTWARE": "1",
        })
        for directory in ("config", "data", "cache"):
            (home / directory).mkdir()
        log_path = output / "native-stdout-stderr.log"
        report_path = output / "result.json"
        screenshot = output / "native-window.png"
        report: dict[str, object] = {
            "test": "Linux Tauri release ELF X11 startup",
            "result": "failed",
            "window_title": "Creator OS",
            "timeout_seconds": timeout,
        }
        with log_path.open("w", encoding="utf-8") as log:
            process = subprocess.Popen(
                [str(executable)], cwd=executable.parent, env=environment,
                stdout=log, stderr=subprocess.STDOUT, start_new_session=True,
            )
            try:
                deadline = time.monotonic() + timeout
                window_id = None
                while time.monotonic() < deadline:
                    if process.poll() is not None:
                        raise RuntimeError(f"Native application exited before showing its window (code {process.returncode})")
                    window_id = find_window()
                    if window_id:
                        break
                    time.sleep(0.5)
                if not window_id:
                    raise RuntimeError(f"Native window not visible after {timeout}s")
                width, height = geometry_for(window_id)
                report["window_geometry"] = {"width": width, "height": height}
                if width < 960 or height < 640:
                    raise RuntimeError(f"Native window too small: {width}x{height}")
                time.sleep(2)
                if process.poll() is not None:
                    raise RuntimeError(f"Application crashed shortly after window creation (code {process.returncode})")
                if find_window() != window_id:
                    raise RuntimeError("Native window disappeared during stability check")
                capture = command("import", "-window", window_id, str(screenshot))
                if capture.returncode != 0:
                    raise RuntimeError("Native X11 screenshot failed: " + capture.stderr.strip())
                if not screenshot.is_file() or screenshot.stat().st_size < 1024:
                    raise RuntimeError("Native screenshot missing or unexpectedly small")
                if screenshot.read_bytes()[:8] != bytes.fromhex("89504e470d0a1a0a"):
                    raise RuntimeError("Native screenshot is not a PNG")
                report["result"] = "passed"
                report["screenshot_bytes"] = screenshot.stat().st_size
                print(f"Native Tauri startup smoke passed: Creator OS window {width}x{height}")
            except Exception as error:
                report["error"] = str(error)
                raise
            finally:
                report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
                if process.poll() is None:
                    os.killpg(process.pid, signal.SIGTERM)
                    try:
                        process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        os.killpg(process.pid, signal.SIGKILL)
                        process.wait(timeout=5)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("executable", type=Path)
    parser.add_argument("--output", type=Path, default=Path("native-smoke"))
    parser.add_argument("--timeout", type=int, default=45)
    arguments = parser.parse_args()
    if not 1 <= arguments.timeout <= 120:
        parser.error("--timeout must be between 1 and 120")
    run(arguments.executable, arguments.output, arguments.timeout)


if __name__ == "__main__":
    main()
