"""Maps image pixels to real-world ground-plane meters via a homography, so
a movement/stationary threshold means the same physical distance everywhere
in frame.

A car near the camera occupies far more pixels — and shifts far more
pixels per meter of real movement — than the same car near the horizon, so
a single pixels/sec threshold is systematically wrong across a
perspective-distorted frame: too strict near the camera (jitter alone can
exceed it), too lenient near the horizon (real movement barely registers).

Calibrated by picking 4 image points that trace a real-world rectangle
(e.g. one marked parking space's corners) and giving that rectangle's real
width and height in meters — see the /calibrate page. Without calibration,
points just pass through as raw pixels: the old, perspective-blind
behavior, not an error.
"""

from __future__ import annotations

import json

import cv2
import numpy as np


class Calibration:
    def __init__(self, path: str | None = "calibration.json") -> None:
        self._path = path
        self._homography: np.ndarray | None = None
        self._load()

    @property
    def is_calibrated(self) -> bool:
        return self._homography is not None

    def to_ground_plane(self, point: tuple[float, float]) -> tuple[float, float]:
        """Maps an image pixel to (x, y) meters on the calibrated ground
        plane. Returns the point unchanged if not calibrated."""
        if self._homography is None:
            return point
        src = np.array([[point]], dtype=np.float32)
        dst = cv2.perspectiveTransform(src, self._homography)
        return float(dst[0, 0, 0]), float(dst[0, 0, 1])

    def save(self, image_points: list[list[float]], width_m: float, height_m: float) -> None:
        if len(image_points) != 4:
            raise ValueError("calibration needs exactly 4 image points")
        payload = {"image_points": image_points, "width_m": width_m, "height_m": height_m}
        if self._path:
            with open(self._path, "w") as f:
                json.dump(payload, f)
        self._apply(payload)

    def as_dict(self) -> dict | None:
        if self._homography is None:
            return None
        return self._raw

    def _load(self) -> None:
        if not self._path:
            return
        try:
            with open(self._path) as f:
                raw = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return
        self._apply(raw)

    def _apply(self, raw: dict) -> None:
        # Image corners in click order (e.g. top-left, top-right,
        # bottom-right, bottom-left); ground-plane corners in the same
        # order at (0,0)-(w,0)-(w,h)-(0,h) so the two correspond point for
        # point — order consistency between the two arrays is what makes
        # the homography correct, not the specific order chosen.
        image_points = np.array(raw["image_points"], dtype=np.float32)
        w, h = float(raw["width_m"]), float(raw["height_m"])
        ground_points = np.array([[0, 0], [w, 0], [w, h], [0, h]], dtype=np.float32)
        self._homography = cv2.getPerspectiveTransform(image_points, ground_points)
        self._raw = raw
