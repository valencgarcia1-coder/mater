"""FR5 groundwork: numbered parking-space polygons and occupancy overlap.

A space's mask is precomputed once (spaces are static per camera config,
they don't move frame to frame) so checking every detection against every
space each frame is just cheap cropped-rectangle mask ANDs, not a full-frame
fill per space per frame.
"""

from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np

from detector.config import SpaceRegion

OCCUPIED_OVERLAP_THRESHOLD = 0.4  # FR5 default: >=40% of the space's area covered


@dataclass
class _CachedSpace:
    label: str
    polygon: np.ndarray  # int32, shape (N, 2)
    mask: np.ndarray  # uint8, full-frame size
    area: int
    bbox: tuple[int, int, int, int]  # x1, y1, x2, y2


def build_space_masks(spaces: list[SpaceRegion], frame_shape: tuple[int, int]) -> list[_CachedSpace]:
    h, w = frame_shape
    cached = []
    for space in spaces:
        polygon = np.array(space.polygon, dtype=np.int32)
        mask = np.zeros((h, w), dtype=np.uint8)
        cv2.fillPoly(mask, [polygon], 1)
        area = int(mask.sum())
        x1, y1 = polygon[:, 0].min(), polygon[:, 1].min()
        x2, y2 = polygon[:, 0].max(), polygon[:, 1].max()
        cached.append(_CachedSpace(label=space.label, polygon=polygon, mask=mask, area=area, bbox=(x1, y1, x2, y2)))
    return cached


def is_occupied(space: _CachedSpace, box: tuple[float, float, float, float]) -> bool:
    if space.area == 0:
        return False
    sx1, sy1, sx2, sy2 = space.bbox
    bx1, by1, bx2, by2 = (int(v) for v in box)

    rx1, ry1 = max(sx1, bx1), max(sy1, by1)
    rx2, ry2 = min(sx2, bx2), min(sy2, by2)
    if rx2 <= rx1 or ry2 <= ry1:
        return False

    region_mask = space.mask[ry1:ry2, rx1:rx2]
    overlap = int(region_mask.sum())
    return (overlap / space.area) >= OCCUPIED_OVERLAP_THRESHOLD


occupied_color = (0, 0, 255)  # BGR red — thin gray/muted colors got lost against real pavement
empty_color = (0, 255, 255)  # BGR yellow — high contrast against asphalt and vehicle colors alike


def draw_spaces(frame: np.ndarray, spaces: list[_CachedSpace], boxes: list[tuple]) -> np.ndarray:
    for space in spaces:
        occupied = any(is_occupied(space, box) for box in boxes)
        color = occupied_color if occupied else empty_color

        overlay = frame.copy()
        cv2.fillPoly(overlay, [space.polygon], color)
        cv2.addWeighted(overlay, 0.18, frame, 0.82, 0, dst=frame)  # faint fill so empty spaces read at a glance
        cv2.polylines(frame, [space.polygon], isClosed=True, color=color, thickness=3)

        text = f"#{space.label}"
        origin = (int(space.bbox[0]) + 6, int(space.bbox[1]) + 22)
        (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
        cv2.rectangle(frame, (origin[0] - 4, origin[1] - th - 6), (origin[0] + tw + 4, origin[1] + 4), (0, 0, 0), -1)
        cv2.putText(frame, text, origin, cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2, cv2.LINE_AA)
    return frame
