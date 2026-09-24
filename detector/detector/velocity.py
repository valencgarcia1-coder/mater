"""Stationary detection via displacement over a time window, not frame-to-
frame position equality (which false-negatives on ordinary detection
jitter — a box's exact pixel position wobbles frame to frame even for a
car that hasn't moved at all).

Maintains a short position history per track_id and reports speed in
pixels/sec computed from the oldest-to-newest sample within a trailing
window. Used to gate which vehicles count toward a space's "confirmed
parked" state — a car still slowly repositioning (backing in, a
three-point turn) can momentarily overlap a space's polygon enough to read
as occupied without actually being parked yet; the space-occupancy-duration
check alone doesn't catch this because it only asks "is something here",
never "is that something still moving."

Real-world units (e.g. mph, via a calibrated image-to-ground-plane
homography) would be a better signal than raw pixels/sec, since the same
physical speed looks like more pixels/sec near the camera than far away in
a perspective shot. That needs a camera calibration step that doesn't exist
yet — this is the uncalibrated interim version.
"""

from __future__ import annotations

import time
from collections import deque

WINDOW_SECONDS = 3.0
STATIONARY_SPEED_PX_PER_SEC = 15.0


class VelocityTracker:
    def __init__(self) -> None:
        self._history: dict[int, deque[tuple[float, float, float]]] = {}

    def update(self, track_id: int, point: tuple[float, float], now: float | None = None) -> float:
        """Records this frame's position for track_id and returns its
        current speed in pixels/sec over the trailing window."""
        now = now if now is not None else time.time()
        hist = self._history.setdefault(track_id, deque())
        hist.append((now, point[0], point[1]))
        while hist and now - hist[0][0] > WINDOW_SECONDS:
            hist.popleft()

        if len(hist) < 2:
            return 0.0  # not enough history yet — a brand-new track isn't penalized as "moving"

        t0, x0, y0 = hist[0]
        t1, x1, y1 = hist[-1]
        dt = t1 - t0
        if dt <= 0:
            return 0.0
        dist = ((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5
        return dist / dt

    def is_stationary(self, track_id: int, point: tuple[float, float], now: float | None = None) -> bool:
        return self.update(track_id, point, now=now) < STATIONARY_SPEED_PX_PER_SEC

    def forget(self, active_track_ids: set[int]) -> None:
        """Drop history for tracks no longer visible, so this doesn't grow
        unbounded over a long-running session."""
        stale = [tid for tid in self._history if tid not in active_track_ids]
        for tid in stale:
            del self._history[tid]
