#!/usr/bin/env python3
"""Validate native branding assets and Tauri config without external dependencies.

This is a preflight; it does not prove installer compatibility or runtime WebView.
"""
from __future__ import annotations

import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TAURI = ROOT / "apps" / "desktop" / "src-tauri"
ICON = TAURI / "icons"
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def png_size(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    assert len(data) >= 24 and data[:8] == PNG_SIGNATURE, f"Invalid PNG: {path}"
    assert data[12:16] == b"IHDR", f"Missing PNG IHDR: {path}"
    return struct.unpack(">II", data[16:24])


def main() -> None:
    expected = {
        "32x32.png": (32, 32),
        "128x128.png": (128, 128),
        "128x128@2x.png": (256, 256),
        "icon.png": (512, 512),
    }
    for filename, dimensions in expected.items():
        actual = png_size(ICON / filename)
        assert actual == dimensions, f"{filename}: got {actual}, expected {dimensions}"
    ico = (ICON / "icon.ico").read_bytes()
    assert len(ico) > 100 and ico[:4] == b"\x00\x00\x01\x00", "Invalid Windows ICO"
    icns = (ICON / "icon.icns").read_bytes()
    assert len(icns) > 100 and icns[:4] == b"icns", "Invalid macOS ICNS"
    cfg = json.loads((TAURI / "tauri.conf.json").read_text(encoding="utf-8"))
    assert cfg["productName"] == "Creator OS"
    assert cfg["identifier"] == "com.creatoros.app"
    assert cfg["build"]["frontendDist"] == "../dist"
    assert cfg["bundle"]["active"] is True
    print("Creator OS icon and Tauri metadata preflight: PASS")


if __name__ == "__main__":
    main()
