"""Builds one labeled contact sheet per eval frame: every space's crop, in a
grid, with its space number printed on it -- so ground-truth labeling can be
done by looking at a handful of images instead of ~120 individual crops.
"""

from __future__ import annotations

import sys
from pathlib import Path

import cv2
import numpy as np
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from detector.config import SpaceRegion
from detector.spaces import build_space_masks

CELL_SIZE = 160


def main() -> None:
    review_dir = Path(__file__).parent / "eval_review"
    with open(Path(__file__).resolve().parent.parent / "spaces.yaml") as f:
        raw = yaml.safe_load(f)
    spaces_cfg = [SpaceRegion(**s) for s in raw["spaces"]]

    frame_paths = sorted(review_dir.glob("*.jpg"))
    frame_paths = [p for p in frame_paths if not p.stem.startswith("sheet_")]

    for frame_path in frame_paths:
        frame = cv2.imread(str(frame_path))
        if frame is None:
            continue
        cached = build_space_masks(spaces_cfg, frame.shape[:2])

        cols = 4
        rows = (len(cached) + cols - 1) // cols
        sheet = np.zeros((rows * CELL_SIZE, cols * CELL_SIZE, 3), dtype=np.uint8)

        for i, space in enumerate(cached):
            x1, y1, x2, y2 = space.bbox
            crop = frame[y1:y2, x1:x2]
            if crop.size == 0:
                continue
            resized = cv2.resize(crop, (CELL_SIZE, CELL_SIZE))
            r, c = divmod(i, cols)
            sheet[r * CELL_SIZE : (r + 1) * CELL_SIZE, c * CELL_SIZE : (c + 1) * CELL_SIZE] = resized
            cv2.putText(
                sheet, f"P{space.label}", (c * CELL_SIZE + 6, r * CELL_SIZE + 24),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2, cv2.LINE_AA,
            )

        out_path = review_dir / f"sheet_{frame_path.stem}.jpg"
        cv2.imwrite(str(out_path), sheet)
        print(f"wrote {out_path}")


if __name__ == "__main__":
    main()
