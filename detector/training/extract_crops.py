"""One-time preprocessing: turn PKLot's YOLO-format detection labels (full
lot images + per-space bounding boxes) into individual per-space crop
images sorted into vacant/occupied folders -- the classic PKLot
classification layout, and the format the actual per-space CNN classifier
(train_classifier.py) trains on.

Doing this once and caching crops to disk (instead of cropping on the fly
in the training Dataset) means re-running training doesn't re-decode and
re-crop 12k+ full-resolution images every epoch.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image

CLASS_NAMES = {0: "vacant", 1: "occupied"}


def yolo_box_to_pixels(cx: float, cy: float, w: float, h: float, img_w: int, img_h: int) -> tuple[int, int, int, int]:
    x1 = (cx - w / 2) * img_w
    y1 = (cy - h / 2) * img_h
    x2 = (cx + w / 2) * img_w
    y2 = (cy + h / 2) * img_h
    return max(0, int(x1)), max(0, int(y1)), min(img_w, int(x2)), min(img_h, int(y2))


def extract_split(raw_dir: Path, out_dir: Path, split: str, image_subdir: str) -> tuple[int, int]:
    images_dir = raw_dir / "data" / "images" / image_subdir
    labels_dir = raw_dir / "data" / "labels" / image_subdir
    counts = {"vacant": 0, "occupied": 0}

    for label_path in sorted(labels_dir.glob("*.txt")):
        image_path = images_dir / (label_path.stem + ".jpg")
        if not image_path.exists():
            continue
        try:
            img = Image.open(image_path).convert("RGB")
        except Exception:
            continue
        img_w, img_h = img.size

        lines = label_path.read_text().strip().splitlines()
        for i, line in enumerate(lines):
            parts = line.split()
            if len(parts) != 5:
                continue
            class_id = int(parts[0])
            cx, cy, w, h = (float(v) for v in parts[1:])
            x1, y1, x2, y2 = yolo_box_to_pixels(cx, cy, w, h, img_w, img_h)
            if x2 <= x1 or y2 <= y1:
                continue
            class_name = CLASS_NAMES.get(class_id)
            if class_name is None:
                continue
            crop = img.crop((x1, y1, x2, y2))
            dest_dir = out_dir / split / class_name
            dest_dir.mkdir(parents=True, exist_ok=True)
            crop.save(dest_dir / f"{label_path.stem}_{i}.jpg", quality=90)
            counts[class_name] += 1

    return counts["vacant"], counts["occupied"]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw-dir", default="training/pklot_raw")
    parser.add_argument("--out-dir", default="training/pklot_crops")
    args = parser.parse_args()

    raw_dir = Path(args.raw_dir)
    out_dir = Path(args.out_dir)

    # PKLot's own folder is "valid"; we normalize to "val" for consistency
    # with torchvision's usual train/val/test naming.
    for split, image_subdir in [("train", "train"), ("val", "valid"), ("test", "test")]:
        vacant, occupied = extract_split(raw_dir, out_dir, split, image_subdir)
        print(f"{split}: {vacant} vacant, {occupied} occupied ({vacant + occupied} total)")


if __name__ == "__main__":
    main()
