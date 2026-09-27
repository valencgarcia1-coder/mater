"""Turns saved disagreement crops (detector/disagreement_crops/) into numbered
contact sheets for hand-labeling, skipping crops that already have a label.

Label by looking at a sheet and recording each cell's truth in
training/disagreement_labels.json as {"<crop filename>": "occupied"|"vacant"};
sheet_manifest.json maps each sheet's cell numbers to crop filenames.
"""

from __future__ import annotations

import json
from pathlib import Path

import cv2
import numpy as np

CELL = 128
COLS, ROWS = 5, 4
PER_SHEET = COLS * ROWS

ROOT = Path(__file__).resolve().parent.parent
CROPS_DIR = ROOT / "disagreement_crops"
LABELS_PATH = Path(__file__).resolve().parent / "disagreement_labels.json"
OUT_DIR = Path(__file__).resolve().parent / "label_sheets"


def main() -> None:
    labeled = set(json.loads(LABELS_PATH.read_text())) if LABELS_PATH.exists() else set()
    todo = sorted(p for p in CROPS_DIR.glob("*.jpg") if p.name not in labeled)
    OUT_DIR.mkdir(exist_ok=True)

    manifest = {}
    for sheet_idx in range(0, len(todo), PER_SHEET):
        batch = todo[sheet_idx : sheet_idx + PER_SHEET]
        sheet = np.zeros((ROWS * CELL, COLS * CELL, 3), dtype=np.uint8)
        cells = {}
        for i, path in enumerate(batch):
            img = cv2.imread(str(path))
            if img is None:
                continue
            r, c = divmod(i, COLS)
            sheet[r * CELL : (r + 1) * CELL, c * CELL : (c + 1) * CELL] = cv2.resize(img, (CELL, CELL))
            cv2.putText(sheet, str(i + 1), (c * CELL + 4, r * CELL + 22), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
            cells[str(i + 1)] = path.name
        name = f"sheet_{sheet_idx // PER_SHEET + 1:03d}.jpg"
        cv2.imwrite(str(OUT_DIR / name), sheet)
        manifest[name] = cells

    (OUT_DIR / "sheet_manifest.json").write_text(json.dumps(manifest, indent=1))
    print(f"{len(todo)} unlabeled crops -> {len(manifest)} sheets in {OUT_DIR}")


if __name__ == "__main__":
    main()
