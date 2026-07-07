#!/usr/bin/env python3
from pathlib import Path
from PIL import Image


REPO_ROOT = Path(__file__).resolve().parents[1]
FRAME_DIR = REPO_ROOT / "docs" / ".demo-frames"
OUT = REPO_ROOT / "docs" / "assets" / "standard-kline-demo.gif"


def load_frames():
    frames = []
    for path in sorted(FRAME_DIR.glob("*.png")):
        image = Image.open(path).convert("RGB")
        image.thumbnail((960, 580), Image.Resampling.LANCZOS)
        frames.append(image.copy())
    return frames


def main():
    frames = load_frames()
    if not frames:
        raise SystemExit(f"no frames found in {FRAME_DIR}")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        OUT,
        save_all=True,
        append_images=frames[1:],
        duration=[950, 850, 850, 1200, 950][: len(frames)],
        loop=0,
        optimize=True,
    )
    print(OUT)


if __name__ == "__main__":
    main()
