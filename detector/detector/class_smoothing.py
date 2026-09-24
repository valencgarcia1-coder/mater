"""Smooths a track's displayed vehicle class over recent frames via majority
vote, instead of trusting whatever the current frame's classification says.

class = current_frame_class flips the label the instant one frame gets
misclassified — an odd angle, a shadow, partial occlusion — even though the
vehicle obviously didn't change. class = majority_vote(last N frames) only
changes the displayed class once enough recent frames agree, so a single
bad frame can't flip "car" to "truck" and back.

A full per-class probability distribution (car: 0.91, truck: 0.07, ...)
would smooth more precisely, but pulling per-box class scores beyond the
top-1 pick out of an Ultralytics detection model's raw output means poking
at internals `Detections.from_ultralytics` doesn't expose — real fragility
for a label on a box. Majority vote over the top-1 pick each frame gets the
same practical outcome (no flicker) without it.
"""

from __future__ import annotations

from collections import Counter, deque

WINDOW_FRAMES = 10


class ClassSmoother:
    def __init__(self, window_frames: int = WINDOW_FRAMES) -> None:
        self._history: dict[int, deque[int]] = {}
        self._window_frames = window_frames

    def smooth(self, track_id: int, class_id: int) -> int:
        """Records this frame's classification for track_id and returns the
        majority class over the trailing window."""
        hist = self._history.setdefault(track_id, deque(maxlen=self._window_frames))
        hist.append(class_id)
        return Counter(hist).most_common(1)[0][0]

    def forget(self, active_track_ids: set[int]) -> None:
        """Drop history for tracks no longer visible, so this doesn't grow
        unbounded over a long-running session."""
        stale = [tid for tid in self._history if tid not in active_track_ids]
        for tid in stale:
            del self._history[tid]
