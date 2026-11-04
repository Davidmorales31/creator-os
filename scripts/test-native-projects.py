#!/usr/bin/env python3
"""Native Tauri/WebKitGTK project E2E. No mocked Tauri bridge or external test service.

Run under Xvfb + a window manager; tauri-driver and WebKitWebDriver must be in PATH.
This verifies a small real-app workflow, not full native feature acceptance.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
from pathlib import Path
import signal
import subprocess
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import UUID

ELEMENT_KEY = "element-6066-11e4-a52e-4f735466cecf"
PROJECT_NAME = "Creator OS Native E2E Project"


class WebDriver:
    def __init__(self, url: str) -> None:
        self.url = url.rstrip("/")
        self.session: str | None = None

    def request(self, method: str, path: str, body: dict | None = None, timeout: int = 20):
        data = None if body is None else json.dumps(body).encode("utf-8")
        request = Request(
            self.url + path, data=data, method=method,
            headers={"Content-Type": "application/json"},
        )
        try:
            with urlopen(request, timeout=timeout) as response:
                payload = json.loads(response.read())
        except HTTPError as error:
            details = error.read().decode("utf-8", "replace")[:700]
            raise RuntimeError(f"WebDriver HTTP {error.code} {method} {path}: {details}") from error
        except URLError as error:
            raise RuntimeError(f"WebDriver connection failed {method} {path}: {error}") from error
        value = payload.get("value", payload)
        if isinstance(value, dict) and value.get("error"):
            raise RuntimeError(f"WebDriver {value['error']}: {value.get('message', '')}")
        return value

    def create(self, executable: Path) -> None:
        if self.session is not None:
            raise RuntimeError("A WebDriver session is still active")
        payload = self.request(
            "POST", "/session",
            {"capabilities": {"alwaysMatch": {
                "browserName": "wry",
                "tauri:options": {"application": str(executable)},
            }, "firstMatch": [{}]}},
            timeout=55,
        )
        session = payload.get("sessionId") if isinstance(payload, dict) else None
        if not session:
            raise RuntimeError(f"tauri-driver returned no session ID: {payload!r}")
        self.session = str(session)

    def path(self, suffix: str) -> str:
        if self.session is None:
            raise RuntimeError("No active WebDriver session")
        return f"/session/{self.session}{suffix}"

    def evaluate(self, script: str, *args):
        return self.request("POST", self.path("/execute/sync"), {"script": script, "args": list(args)})

    def element(self, selector: str) -> str:
        value = self.request("POST", self.path("/element"), {"using": "css selector", "value": selector})
        return str(value[ELEMENT_KEY])

    def click(self, selector: str) -> None:
        self.request("POST", self.path(f"/element/{self.element(selector)}/click"), {})

    def type_into(self, selector: str, value: str) -> None:
        element = self.element(selector)
        self.request("POST", self.path(f"/element/{element}/value"), {"text": value, "value": list(value)})

    def screenshot(self, path: Path) -> None:
        encoded = self.request("GET", self.path("/screenshot"))
        image = base64.b64decode(encoded, validate=True)
        if image[:8] != bytes.fromhex("89504e470d0a1a0a") or len(image) < 1024:
            raise RuntimeError("WebKit screenshot invalid or blank")
        path.write_bytes(image)

    def close(self) -> None:
        if self.session:
            try:
                self.request("DELETE", self.path(""), timeout=20)
            finally:
                self.session = None


def wait_for(description: str, predicate, timeout: float = 35):
    deadline = time.monotonic() + timeout
    last_error = None
    while time.monotonic() < deadline:
        try:
            result = predicate()
            if result:
                return result
        except (RuntimeError, KeyError) as error:
            last_error = str(error)
        time.sleep(0.4)
    raise RuntimeError(f"Timed out waiting for {description}" + (f": {last_error}" if last_error else ""))


def ready(driver: WebDriver) -> None:
    wait_for("native Creator OS welcome UI", lambda: driver.evaluate(
        "return !!document.querySelector('.page-intro h1')"
        " && document.querySelector('.page-intro h1').textContent.includes('Bienvenido a Creator OS');"
    ))


def editor_ready(driver: WebDriver) -> bool:
    return bool(driver.evaluate(
        "return document.querySelector('.workspace-header h1')"
        "?.textContent.includes(arguments[0]) ?? false;", PROJECT_NAME
    ))


def find_manifest(data: Path) -> Path | None:
    if not data.exists():
        return None
    matches = list(data.rglob("project.json"))
    if len(matches) > 1:
        raise RuntimeError(f"Expected one isolated project manifest, found {len(matches)}")
    return matches[0] if matches else None


def run(executable: Path, output: Path, timeout: int) -> None:
    executable = executable.resolve()
    output.mkdir(parents=True, exist_ok=True)
    if not executable.is_file() or not os.access(executable, os.X_OK):
        raise RuntimeError(f"Desktop executable missing: {executable}")
    if not os.environ.get("DISPLAY"):
        raise RuntimeError("Run native WebDriver E2E inside Xvfb")

    report: dict[str, object] = {"test": "Tauri real WebDriver project E2E", "result": "failed", "steps": []}
    with tempfile.TemporaryDirectory(prefix="creator-os-e2e-") as sandbox:
        root = Path(sandbox)
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
        driver = WebDriver("http://127.0.0.1:4444")
        with (output / "tauri-driver.log").open("w", encoding="utf-8") as log:
            process = subprocess.Popen(["tauri-driver"], env=env, stdout=log,
                                       stderr=subprocess.STDOUT, start_new_session=True)
            try:
                wait_for("tauri-driver HTTP status", lambda: driver.request("GET", "/status"), timeout=25)
                driver.create(executable)
                ready(driver)
                report["steps"].append("real WebKit welcome screen")
                driver.screenshot(output / "01-welcome.png")

                driver.type_into("#project-name", PROJECT_NAME)
                driver.click(".new-project-form button[type='submit']")
                wait_for("project editor after typed Rust command", lambda: editor_ready(driver), timeout=timeout)
                report["steps"].append("real create_project command and editor")

                manifest = wait_for("project.json on isolated filesystem", lambda: find_manifest(data), timeout=15)
                project = json.loads(manifest.read_text(encoding="utf-8"))
                if project.get("name") != PROJECT_NAME:
                    raise RuntimeError("On-disk project name differs from native UI")
                project_id = str(UUID(project["id"]))
                report["project_id_valid"] = True
                report["steps"].append("real on-disk project.json with UUID")
                driver.screenshot(output / "02-editor.png")

                driver.click("button[aria-label='Activar modo oscuro']")
                wait_for("dark theme", lambda: driver.evaluate(
                    "return document.documentElement.dataset.theme === 'dark'"
                    " && !!document.querySelector('button[aria-label=\\'Activar modo claro\\']');"
                ))
                report["steps"].append("native dark theme toggle")
                driver.screenshot(output / "03-dark.png")

                driver.click(".nav-group button.nav-item:first-of-type")
                wait_for("recent project on Home", lambda: driver.evaluate(
                    "return [...document.querySelectorAll('button.recent-item')]"
                    ".some(b => b.textContent.includes(arguments[0]));", PROJECT_NAME
                ))
                driver.click("button.recent-item")
                wait_for("existing project reopened", lambda: editor_ready(driver))
                report["steps"].append("real open_project from recent list")

                driver.close()
                time.sleep(1)
                driver.create(executable)
                ready(driver)
                wait_for("persisted recent item after relaunch", lambda: driver.evaluate(
                    "return [...document.querySelectorAll('button.recent-item')]"
                    ".some(b => b.textContent.includes(arguments[0]));", PROJECT_NAME
                ))
                driver.click("button.recent-item")
                wait_for("editor after full native relaunch", lambda: editor_ready(driver))
                persisted = json.loads(manifest.read_text(encoding="utf-8"))
                if persisted.get("id") != project_id:
                    raise RuntimeError("Project UUID changed across native relaunch")
                report["steps"].append("native app relaunch and persistent project reopen")
                driver.screenshot(output / "04-reopened.png")

                report["result"] = "passed"
                print("Native Tauri WebDriver E2E passed: project creation, persistence and restart")
            except Exception as error:
                report["error"] = str(error)
                if driver.session:
                    try:
                        driver.screenshot(output / "failure.png")
                    except Exception:
                        pass
                raise
            finally:
                (output / "result.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
                try:
                    driver.close()
                except Exception:
                    pass
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
    parser.add_argument("--output", type=Path, default=Path("native-e2e"))
    parser.add_argument("--timeout", type=int, default=45)
    args = parser.parse_args()
    if not 5 <= args.timeout <= 120:
        parser.error("--timeout must be 5–120 seconds")
    run(args.executable, args.output, args.timeout)


if __name__ == "__main__":
    main()
