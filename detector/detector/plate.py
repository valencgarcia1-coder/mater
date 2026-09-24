"""FR4: plate detection + OCR on a vehicle crop.

The pipeline calls `PlateReader.read()` per tracked vehicle per frame and
keeps the highest-confidence result per track_id — this module only reads
a single crop, it doesn't know about tracks.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np
from fast_alpr import ALPR

# The plate detector's CoreML backend logs a warning (caught internally, not
# fatal) for some small/edge crops regardless of size — see the try/except
# in PlateReader.read(). Quiet its logger rather than let it spam stderr.
logging.getLogger("open_image_models.detection.core.yolo_v9.inference").setLevel(logging.ERROR)


@dataclass
class PlateRead:
    text: str
    confidence: float


class PlateReader:
    def __init__(self) -> None:
        self._alpr = ALPR()

    def read(self, frame: np.ndarray, box: tuple[float, float, float, float]) -> PlateRead | None:
        h, w = frame.shape[:2]
        x1, y1, x2, y2 = box
        x1, y1 = max(0, int(x1)), max(0, int(y1))
        x2, y2 = min(w, int(x2)), min(h, int(y2))
        if x2 <= x1 or y2 <= y1:
            return None

        # Degenerate crops (very thin/small boxes, common at the frame edge)
        # can make the ALPR's internal plate detector produce a zero-element
        # dynamic shape, which its CoreML backend rejects — skip them rather
        # than let every such box spam a caught-but-logged inference error.
        if (x2 - x1) < 32 or (y2 - y1) < 32:
            return None

        crop = frame[y1:y2, x1:x2]
        try:
            results = self._alpr.predict(crop)
        except Exception:
            return None
        if not results:
            return None

        # The OCR model can report high confidence alongside empty text at
        # long range / low resolution (observed on the Brighton feed, which
        # the PRD explicitly says is unreadable at this distance) — a blank
        # read is never useful regardless of its reported confidence.
        readable = [r for r in results if r.ocr is not None and r.ocr.text.strip()]
        if not readable:
            return None

        best = max(readable, key=lambda r: _scalar_confidence(r.ocr.confidence))
        return PlateRead(text=best.ocr.text, confidence=_scalar_confidence(best.ocr.confidence))


def _scalar_confidence(confidence: float | list[float]) -> float:
    if isinstance(confidence, list):
        return sum(confidence) / len(confidence) if confidence else 0.0
    return confidence
