"""Stationary detection via displacement over a time window, not frame-to-
frame position equality (which false-negatives on ordinary detection
jitter — a box's exact pixel position wobbles frame to frame even for a
car that hasn't moved at all).

Maintains a short position history per track_id and reports speed
(distance/sec) computed from the oldest-to-newest sample within a trailing
window. Used to gate which vehicles count toward a space's "confirmed
parked" state — a car still slowly repositioning (backing in, a
three-point turn) can momentarily overlap a space's polygon enough to read
as occupied without actually being parked yet; the space-occupancy-duration
check alone doesn't catch this because it only asks "is something here",
never "is that something still moving."

Deliberately unit-agnostic: the caller decides whether points are raw image
pixels or calibrated ground-plane meters (see calibration.py) and passes
the matching threshold. A single pixels/sec threshold is wrong across a
perspective-distorted frame — a car near the camera occupies far more
pixels (and shifts far more pixels per meter moved) than the same car near
the horizon — which is exactly why calibration.py exists; this class just
measures displacement/time in whatever space it's given.
"""

from __future__ import annotations

import time
from collections import deque

WINDOW_SECONDS = 3.0
STATIONARY_SPEED_PX_PER_SEC = 15.0  # uncalibrated fallback, in raw image pixels
STATIONARY_SPEED_M_PER_SEC = 0.3  # calibrated: ~a slow walking creep, in real meters


class VelocityTracker:
    def __init__(self, stationary_threshold: float = STATIONARY_SPEED_PX_PER_SEC) -> None:
        self._history: dict[int, deque[tuple[float, float, float]]] = {}
        self._stationary_threshold = stationary_threshold

    def update(self, track_id: int, point: tuple[float, float], now: float | None = None) -> float:
        """Records this frame's position for track_id and returns its
        current speed over the trailing window, in whatever unit `point`
        was given in (raw pixels, or calibrated meters)."""
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
        return self.update(track_id, point, now=now) < self._stationary_threshold

    def forget(self, active_track_ids: set[int]) -> None:
        """Drop history for tracks no longer visible, so this doesn't grow
        unbounded over a long-running session."""
        stale = [tid for tid in self._history if tid not in active_track_ids]
        for tid in stale:
            del self._history[tid]
