#!/usr/bin/env python3
"""Generate Creator OS icons deterministically from the Totem Cut SVG master.

Usage: python scripts/generate_brand_icons.py
Requirements: pip install cairosvg pillow
"""
from pathlib import Path
import io
import cairosvg
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "assets" / "brand"
TAURI = ROOT / "apps" / "desktop" / "src-tauri" / "icons"
TAURI.mkdir(parents=True, exist_ok=True)
source = (BRAND / "totem-cut-app-icon.svg").read_bytes()
sizes = (16, 24, 32, 48, 64, 128, 256, 512, 1024)
for size in sizes:
    cairosvg.svg2png(bytestring=source, write_to=str(BRAND / f"app-icon-{size}.png"), output_width=size, output_height=size)
for size, filename in ((32, "32x32.png"), (128, "128x128.png"), (256, "128x128@2x.png"), (512, "icon.png")):
    Image.open(BRAND / f"app-icon-{size}.png").save(TAURI / filename)
Image.open(BRAND / "app-icon-256.png").save(TAURI / "icon.ico", format="ICO", sizes=[(s, s) for s in (16, 24, 32, 48, 64, 128, 256)])
Image.open(BRAND / "app-icon-1024.png").save(TAURI / "icon.icns", format="ICNS")
for name in ("32x32.png", "128x128.png", "128x128@2x.png", "icon.png", "icon.ico", "icon.icns"):
    assert (TAURI / name).stat().st_size > 0, name
print("Totem Cut generated: PNG 16–1024, Tauri PNG/ICO/ICNS")
