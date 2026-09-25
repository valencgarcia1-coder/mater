"""FR5 groundwork: numbered parking-space polygons and occupancy overlap.

A space's mask is precomputed once (spaces are static per camera config,
they don't move frame to frame) so checking every detection against every
space each frame is just cheap cropped-rectangle mask ANDs, not a full-frame
fill per space per frame.
"""

from __future__ import annotations

import time
from dataclasses import dataclass

import cv2
import numpy as np

from detector.config import SpaceRegion
from detector.parking_timers import SpaceState, SpaceStatus, format_duration

OCCUPIED_OVERLAP_THRESHOLD = 0.4  # FR5 default: >=40% of the space's area covered


@dataclass
class _CachedSpace:
    label: str
    zone: str
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
        cached.append(
            _CachedSpace(label=space.label, zone=space.zone, polygon=polygon, mask=mask, area=area, bbox=(x1, y1, x2, y2))
        )
    return cached


def is_occupied_by_box(space: _CachedSpace, box: tuple[float, float, float, float]) -> bool:
    """Fallback for when a vehicle's segmentation mask isn't available (a
    non-seg model). A rectangular box is looser than the actual vehicle, so
    it can spill into a neighboring space enough to false-positive there —
    prefer is_occupied_by_mask whenever a mask exists."""
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


def is_occupied_by_mask(space: _CachedSpace, vehicle_mask: np.ndarray) -> bool:
    """Pixel-accurate check: the vehicle's actual segmentation mask against
    the space's mask, cropped to the space's own bounding box for speed.
    Doesn't false-positive on a neighboring space the way a loose rectangular
    box can, since it follows the vehicle's real silhouette."""
    if space.area == 0:
        return False
    sx1, sy1, sx2, sy2 = space.bbox
    region_space = space.mask[sy1:sy2, sx1:sx2]
    region_vehicle = vehicle_mask[sy1:sy2, sx1:sx2]
    overlap = int(np.logical_and(region_space, region_vehicle).sum())
    return (overlap / space.area) >= OCCUPIED_OVERLAP_THRESHOLD


# Four states, four colors — a merely-parked car shouldn't read as alarming
# as one that's actually overstayed. Reserving red for TOW_ELIGIBLE (not
# "occupied" in general) is the point of the state machine: don't cry wolf
# on every parked car.
STATE_COLORS = {
    SpaceState.EMPTY: (0, 255, 255),  # yellow — available
    SpaceState.ARRIVING: (200, 200, 200),  # gray — occupied, not yet confirmed
    SpaceState.PARKED: (0, 200, 0),  # green — normal, no issue
    SpaceState.VIOLATION: (0, 140, 255),  # orange — past the threshold
    SpaceState.TOW_ELIGIBLE: (0, 0, 255),  # red — actionable
}


def _dashed_polyline(frame: np.ndarray, polygon: np.ndarray, color: tuple, thickness: int, dash_len: int = 12) -> None:
    """Vehicle tracks are always solid lines, so spaces get a dashed border —
    color alone isn't a reliable signal since the track palette also cycles
    through yellow/orange tones."""
    n = len(polygon)
    for i in range(n):
        p1, p2 = polygon[i], polygon[(i + 1) % n]
        seg_len = float(np.linalg.norm(p2 - p1))
        if seg_len == 0:
            continue
        steps = max(1, int(seg_len // dash_len))
        for s in range(0, steps, 2):  # draw every other segment for the dash gap
            t0, t1 = s / steps, min(1.0, (s + 1) / steps)
            start = (p1 + (p2 - p1) * t0).astype(int)
            end = (p1 + (p2 - p1) * t1).astype(int)
            cv2.line(frame, tuple(start), tuple(end), color, thickness, cv2.LINE_AA)


# --- Occlusion hardening -----------------------------------------------
#
# The overlap checks above only reason about a DETECTED VEHICLE's box/mask
# against a space's polygon. That geometry breaks in two directions when
# cars sit close together or pass in front of each other:
#
#   1. A car legitimately parked in space A can have its mask (or a looser
#      box, if no -seg model) spill across the shared boundary into space
#      B's polygon enough to cross OCCUPIED_OVERLAP_THRESHOLD there too —
#      B reads occupied despite nothing being in it.
#   2. A single frame where a vehicle happens to overlap a space (a car
#      briefly cutting through, a momentary segmentation glitch) reads
#      exactly the same as a car settling in to park, because occupancy is
#      decided fresh every frame with no memory of how long it's held.
#
# SpaceAppearanceModel addresses (1) by corroborating a detector-positive
# reading against the space's own pixels. OccupancyDebouncer addresses (2)
# by requiring a positive reading to hold for a short window before it's
# trusted enough to hand to ParkingTimers (which already tolerates brief
# gaps in the *other* direction via GRACE_PERIOD_SECONDS).

APPEARANCE_DIFF_THRESHOLD = 18.0  # mean abs grayscale diff (0-255) read as "changed"
APPEARANCE_LEARNING_RATE = 0.02  # background adaptation rate while confidently empty


class SpaceAppearanceModel:
    """Per-space background-patch corroboration for the geometry-based
    occupancy check. While a space reads empty (per the detector) and its
    own patch is stable, this keeps a running average of what "empty" looks
    like there. A detector-positive reading is only trusted if the space's
    actual pixels have also visibly changed from that background — a real,
    independent signal that doesn't care what a neighboring vehicle's mask
    or box happened to spill into.

    Deliberately one-directional: this only ever VETOES a detector-positive
    reading, never invents an occupied space on its own. An appearance
    change alone (a shadow, a pedestrian, a car passing in front of the
    space on its way elsewhere) is too easy to false-positive on to trust
    unsupervised — requiring it to *agree* with the detector is a safe
    tightening, not a replacement for it.
    """

    def __init__(
        self,
        diff_threshold: float = APPEARANCE_DIFF_THRESHOLD,
        learning_rate: float = APPEARANCE_LEARNING_RATE,
    ) -> None:
        self._diff_threshold = diff_threshold
        self._learning_rate = learning_rate
        self._background: dict[str, np.ndarray] = {}

    def looks_changed(self, space: _CachedSpace, frame: np.ndarray, detector_occupied: bool) -> bool:
        sx1, sy1, sx2, sy2 = space.bbox
        if sx2 <= sx1 or sy2 <= sy1:
            return detector_occupied  # degenerate space geometry; nothing to corroborate against

        patch = cv2.cvtColor(frame[sy1:sy2, sx1:sx2], cv2.COLOR_BGR2GRAY).astype(np.float32)
        mask = space.mask[sy1:sy2, sx1:sx2] > 0
        if not mask.any():
            return detector_occupied

        background = self._background.get(space.label)
        if background is None or background.shape != patch.shape:
            # No reference yet (first sight, or the space geometry changed
            # via the live editor) — nothing to compare against, so pass the
            # detector's own reading through rather than vetoing blind.
            self._background[space.label] = patch
            return detector_occupied

        changed = bool(np.abs(patch - background)[mask].mean() >= self._diff_threshold)

        if not detector_occupied and not changed:
            # Only drift the background while the space reads confidently
            # empty AND visually stable — a car that sits there a while must
            # never get slowly absorbed into "this is what empty looks like".
            self._background[space.label] = (1 - self._learning_rate) * background + self._learning_rate * patch

        return changed


@dataclass
class _OccupancyStreak:
    started_at: float
    last_true_at: float


class OccupancyDebouncer:
    """Requires a space's raw per-frame occupancy signal to hold for
    CONFIRM_HOLD_SECONDS before treating it as real enough to start that
    space's clock. Tolerates single missed frames (a momentary occlusion or
    detection dropout) up to FLICKER_GAP_SECONDS without resetting the
    streak — the same tolerance ParkingTimers.GRACE_PERIOD_SECONDS already
    gives the reverse transition (occupied -> empty).

    This only delays the *first* tick of a genuine parking event by about a
    second and a half; it does not touch the violation/tow thresholds after
    a space is confirmed parked.
    """

    CONFIRM_HOLD_SECONDS = 1.5
    FLICKER_GAP_SECONDS = 0.75

    def __init__(self, confirm_hold: float = CONFIRM_HOLD_SECONDS, flicker_gap: float = FLICKER_GAP_SECONDS) -> None:
        self._confirm_hold = confirm_hold
        self._flicker_gap = flicker_gap
        self._streaks: dict[str, _OccupancyStreak] = {}

    def update(self, raw_occupancy: dict[str, bool], now: float | None = None) -> dict[str, bool]:
        now = now if now is not None else time.time()
        confirmed: dict[str, bool] = {}
        for label, occupied in raw_occupancy.items():
            streak = self._streaks.get(label)
            if occupied:
                if streak is None or now - streak.last_true_at > self._flicker_gap:
                    streak = _OccupancyStreak(started_at=now, last_true_at=now)
                    self._streaks[label] = streak
                else:
                    streak.last_true_at = now
                confirmed[label] = (now - streak.started_at) >= self._confirm_hold
            else:
                # Keep the streak alive through a single missed frame (the
                # next true reading re-checks the gap above) — only drop it
                # once it's aged out, so long-empty spaces don't leak memory.
                if streak is not None and now - streak.last_true_at > self._flicker_gap:
                    del self._streaks[label]
                confirmed[label] = False
        return confirmed


def compute_occupancy(
    spaces: list[_CachedSpace],
    boxes: list[tuple],
    masks: list[np.ndarray] | None = None,
    frame: np.ndarray | None = None,
    appearance_model: SpaceAppearanceModel | None = None,
) -> dict[str, bool]:
    occupancy: dict[str, bool] = {}
    for space in spaces:
        if masks is not None:
            detector_occupied = any(is_occupied_by_mask(space, m) for m in masks)
        else:
            detector_occupied = any(is_occupied_by_box(space, box) for box in boxes)

        if frame is not None and appearance_model is not None:
            changed = appearance_model.looks_changed(space, frame, detector_occupied)
            occupancy[space.label] = detector_occupied and changed
        else:
            occupancy[space.label] = detector_occupied
    return occupancy


def zone_by_label(spaces: list[_CachedSpace]) -> dict[str, str]:
    return {space.label: space.zone for space in spaces}


def _rects_overlap(a: tuple[int, int, int, int], b: tuple[int, int, int, int]) -> bool:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    return ax1 < bx2 and ax2 > bx1 and ay1 < by2 and ay2 > by1


def draw_spaces(
    frame: np.ndarray,
    spaces: list[_CachedSpace],
    occupancy: dict[str, bool],
    status_by_label: dict[str, SpaceStatus] | None = None,
) -> np.ndarray:
    status_by_label = status_by_label or {}
    h, _w = frame.shape[:2]
    # Adjacent stalls' default label position (a fixed offset from each
    # space's own bbox) can collide when spaces sit close together on
    # screen, even though the spaces themselves don't overlap — the vehicle
    # label_annotator up in pipeline.py already solves this with
    # smart_position=True; space labels never got the same treatment, so a
    # crowded row spliced two/three states into one unreadable mess.
    # Tracking placed label rects here and nudging a collision straight
    # down (bounded, so we never search forever) gives spaces the same
    # guarantee: every label stays fully legible on its own.
    placed_label_rects: list[tuple[int, int, int, int]] = []
    for space in spaces:
        status = status_by_label.get(space.label)
        state = status.state if (status and occupancy[space.label]) else SpaceState.EMPTY
        color = STATE_COLORS[state]

        overlay = frame.copy()
        cv2.fillPoly(overlay, [space.polygon], color)
        cv2.addWeighted(overlay, 0.18, frame, 0.82, 0, dst=frame)  # faint fill so empty spaces read at a glance
        _dashed_polyline(frame, space.polygon, color, thickness=3)

        # "P" prefix (not "#") so a space is never mistaken for a vehicle
        # track label at a glance — both were rendering as bare "#N".
        text = f"P{space.label}"
        # "standard" is the overwhelming majority of spaces — naming it on
        # every label is clutter, but a fire lane/handicap/loading zone is
        # worth calling out, same reasoning as skipping "car" on vehicles.
        if space.zone != "standard":
            text += f" {space.zone.upper()}"
        if state != SpaceState.EMPTY:
            text += f" {state.upper()}"
        if status and status.elapsed is not None:
            text += f" [{format_duration(status.elapsed)}]"
        origin_x, origin_y = int(space.bbox[0]) + 6, int(space.bbox[1]) + 22
        (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)

        step = th + 10
        for _ in range(6):  # bounded nudge, not an unbounded search for free space
            rect = (origin_x - 4, origin_y - th - 6, origin_x + tw + 4, origin_y + 4)
            if not any(_rects_overlap(rect, placed) for placed in placed_label_rects):
                break
            origin_y += step
        origin_y = min(origin_y, h - 4)  # stay on-screen even after nudging past the frame edge
        rect = (origin_x - 4, origin_y - th - 6, origin_x + tw + 4, origin_y + 4)
        placed_label_rects.append(rect)

        cv2.rectangle(frame, (rect[0], rect[1]), (rect[2], rect[3]), (0, 0, 0), -1)
        cv2.putText(frame, text, (origin_x, origin_y), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2, cv2.LINE_AA)
    return frame
