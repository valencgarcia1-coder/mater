"""FR5 groundwork: numbered parking-space polygons and occupancy.

A space's mask is precomputed once (spaces are static per camera config,
they don't move frame to frame) so checking a vehicle against every space
each frame is a cheap array index, not a full-frame fill per space per
frame.

Occupancy is decided by strict containment: a stationary vehicle's ground
point either falls inside a space's polygon or it doesn't (see
is_occupied_by_point below). This is a deliberate simplification, reverted
from an earlier proximity-based version — a space is occupied when a car is
literally IN it, full stop, evaluated as its own baseline rather than
smoothed by geometric tolerance or pixel-appearance corroboration. Only
OccupancyDebouncer's brief hold-time remains, so a single dropped frame
doesn't reset an otherwise-continuous reading — see that class for why.

Optionally, a trained per-space image classifier (space_classifier.py) runs
alongside this geometric test; OccupancyFuser trusts a reading only when the
two agree.
"""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass

import cv2
import numpy as np

from detector.config import SpaceRegion
from detector.parking_timers import SpaceState, SpaceStatus, format_duration


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


def is_occupied_by_point(space: _CachedSpace, point: tuple[float, float]) -> bool:
    """Is a vehicle's ground point (bottom-center of its detection box)
    literally inside this space's polygon — the baseline definition of
    occupancy: a car is either standing on a space or it isn't."""
    h, w = space.mask.shape
    x, y = int(round(point[0])), int(round(point[1]))
    if not (0 <= x < w and 0 <= y < h):
        return False
    return bool(space.mask[y, x])


def vehicle_reference_points(
    box: tuple[float, float, float, float], mask: np.ndarray | None = None
) -> dict[str, tuple[float, float]]:
    """Four points describing where a vehicle actually is, not just its
    detection box: "ground" (bottom-center — the sole point compute_occupancy
    uses, see is_occupied_by_point) plus "top"/"front"/"back", read off the
    vehicle's own segmentation mask when one exists.

    top/front/back aren't used for occupancy at all right now — that logic
    was simplified back to ground-only containment. They're kept purely as
    the visual top/front/back dots (see draw_reference_points) confirming
    what the pipeline sees on each vehicle.
    """
    x1, y1, x2, y2 = box
    ground = (float((x1 + x2) / 2), float(y2))
    top = (float((x1 + x2) / 2), float(y1))
    front = (float(x1), float((y1 + y2) / 2))
    back = (float(x2), float((y1 + y2) / 2))

    if mask is not None:
        ix1, iy1, ix2, iy2 = int(x1), int(y1), int(x2), int(y2)
        crop = mask[iy1:iy2, ix1:ix2]
        ys, xs = np.nonzero(crop)
        if len(xs) > 0:
            top_i = int(np.argmin(ys))
            top = (float(ix1 + xs[top_i]), float(iy1 + ys[top_i]))
            left_i = int(np.argmin(xs))
            front = (float(ix1 + xs[left_i]), float(iy1 + ys[left_i]))
            right_i = int(np.argmax(xs))
            back = (float(ix1 + xs[right_i]), float(iy1 + ys[right_i]))

    return {"ground": ground, "top": top, "front": front, "back": back}


REFERENCE_POINT_COLORS = {
    "top": (255, 255, 255),  # white
    "front": (255, 255, 0),  # cyan
    "back": (255, 0, 255),  # magenta
}


def draw_reference_points(frame: np.ndarray, points: dict[str, tuple[float, float]]) -> None:
    """Small dots marking a vehicle's top/front/back — visual confirmation
    of what the occupancy fallback in compute_occupancy actually sees, not
    just a box. "ground" isn't drawn here; it's already implied by the
    vehicle's box/mask outline drawn elsewhere."""
    for key in ("top", "front", "back"):
        x, y = points[key]
        cv2.circle(frame, (int(round(x)), int(round(y))), 4, REFERENCE_POINT_COLORS[key], -1, cv2.LINE_AA)


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
# Strict containment can still misfire in one direction worth naming: a
# single frame where a real vehicle's ground point briefly lands inside a
# space (a car cutting through, not parking) reads exactly like a car
# settling in, because occupancy is decided fresh every frame with no
# memory of how long it's held. OccupancyDebouncer addresses this by
# requiring a positive reading to hold for a short window before it's
# trusted enough to hand to ParkingTimers (which already tolerates brief
# gaps in the *other* direction via GRACE_PERIOD_SECONDS).


@dataclass
class _OccupancyStreak:
    started_at: float
    last_true_at: float


class OccupancyDebouncer:
    """Requires a space's raw per-frame occupancy signal to hold for
    CONFIRM_HOLD_SECONDS before treating it as real enough to start that
    space's clock. Tolerates a single missed frame (a momentary detection
    dropout or a ground point that jitters just outside a polygon) without
    resetting the streak — the same tolerance ParkingTimers.GRACE_PERIOD_SECONDS
    already gives the reverse transition (occupied -> empty).

    The flicker tolerance is measured in observed *frames*, not a fixed
    wall-clock guess: this pipeline's real processing rate is CPU-bound
    (YOLO inference), not the camera's nominal configured fps, and a
    constant tuned for one assumed rate silently stops bridging anything
    the moment the real rate is slower than expected — a single missed
    frame at 2fps is already a ~0.5s gap, close enough to swallow a fixed
    guess whole. Tracking the actual inter-call interval keeps the
    tolerance meaningful regardless of hardware or stream load.

    This only delays the *first* tick of a genuine parking event by about a
    second and a half; it does not touch the violation/tow thresholds after
    a space is confirmed parked.
    """

    CONFIRM_HOLD_SECONDS = 1.5
    MIN_FLICKER_GAP_SECONDS = 0.75  # floor, in case the interval estimate hasn't settled yet
    FLICKER_GAP_FRAME_MULTIPLE = 3  # tolerate ~3 missed frames' worth of gap

    def __init__(self, confirm_hold: float = CONFIRM_HOLD_SECONDS, min_flicker_gap: float = MIN_FLICKER_GAP_SECONDS) -> None:
        self._confirm_hold = confirm_hold
        self._min_flicker_gap = min_flicker_gap
        self._streaks: dict[str, _OccupancyStreak] = {}
        self._last_call_at: float | None = None
        self._frame_interval_estimate = min_flicker_gap / self.FLICKER_GAP_FRAME_MULTIPLE

    def update(self, raw_occupancy: dict[str, bool], now: float | None = None) -> dict[str, bool]:
        now = now if now is not None else time.time()
        if self._last_call_at is not None and now > self._last_call_at:
            # Exponential moving average of the real per-call interval —
            # smooths over one-off slow frames without chasing every jitter.
            dt = now - self._last_call_at
            alpha = 0.2
            self._frame_interval_estimate = (1 - alpha) * self._frame_interval_estimate + alpha * dt
        self._last_call_at = now
        flicker_gap = max(self._min_flicker_gap, self.FLICKER_GAP_FRAME_MULTIPLE * self._frame_interval_estimate)

        confirmed: dict[str, bool] = {}
        for label, occupied in raw_occupancy.items():
            streak = self._streaks.get(label)
            if occupied:
                if streak is None or now - streak.last_true_at > flicker_gap:
                    streak = _OccupancyStreak(started_at=now, last_true_at=now)
                    self._streaks[label] = streak
                else:
                    streak.last_true_at = now
            elif streak is not None and now - streak.last_true_at > flicker_gap:
                # Only drop the streak once the gap since its last TRUE
                # reading has actually aged past tolerance — note this is
                # unaffected by how many False readings came in between, so
                # a single missed frame doesn't compound against a stale
                # last_true_at the way it would if we bumped it on misses.
                del self._streaks[label]
                streak = None
            # Confirmed status is a property of the STREAK, not of this
            # frame's raw reading in isolation. A ground-point test is far
            # more binary than the old area-overlap check was — a single
            # frame's box jitter can flip a point in/out of a polygon even
            # for a car that's been sitting still for minutes — so a streak
            # that has already survived the flicker tolerance must keep
            # reading as occupied through that same brief gap, not just
            # internally remember to not reset its clock. Without this, a
            # single missed frame reported "empty" for that frame despite
            # the streak surviving underneath, which is exactly the kind of
            # momentary blip this class exists to absorb.
            confirmed[label] = streak is not None and (now - streak.started_at) >= self._confirm_hold
        return confirmed


class OccupancyFuser:
    """Trusts a space's occupancy reading only when the geometric test and
    the image classifier agree. When they disagree, the last agreed value
    holds — neither system can flip a space on its own, so one system's
    single-frame mistake (a spurious detection, a classifier miss on a dark
    crop) doesn't reach the parking clock.

    The cost of that is real and worth knowing: if one system is *persistently*
    wrong about a space (say YOLO never detects a car the classifier sees
    clearly), the space stays at whatever it last agreed on rather than
    following the correct system. Every disagreement is logged (once, when it
    begins) to a JSONL file so those cases can be reviewed — they're the most
    informative examples of where each system fails.
    """

    def __init__(
        self,
        disagreements_path: str | None = "disagreements.jsonl",
        crops_dir: str | None = "disagreement_crops",
        cooldown_seconds: float = 10.0,
    ) -> None:
        self._path = disagreements_path
        self._crops_dir = crops_dir
        # A space flickering in and out of disagreement would otherwise write
        # a near-identical crop every frame; one per space per cooldown is
        # plenty of signal for later labeling.
        self._cooldown = cooldown_seconds
        self._last_logged_at: dict[str, float] = {}
        self._last: dict[str, bool] = {}
        self._disagreeing: set[str] = set()

    def fuse(
        self,
        geometric: dict[str, bool],
        classifier: dict[str, tuple[bool, float]],
        frame: np.ndarray | None = None,
        spaces: list[_CachedSpace] | None = None,
    ) -> dict[str, bool]:
        fused: dict[str, bool] = {}
        for label, geo in geometric.items():
            clf = classifier.get(label)
            if clf is None:
                fused[label] = geo
                continue
            clf_occupied, clf_confidence = clf
            if geo == clf_occupied:
                fused[label] = geo
                self._disagreeing.discard(label)
                continue
            fused[label] = self._last.get(label, False)
            if label not in self._disagreeing:
                self._disagreeing.add(label)
                self._log_disagreement(label, geo, clf_occupied, clf_confidence, frame, spaces)

        # Replacing (not updating) drops labels no longer configured, so an
        # edited/removed space can't leave stale state behind for a reused label.
        self._last = dict(fused)
        self._disagreeing &= set(fused)
        return fused

    def _log_disagreement(
        self,
        label: str,
        geometric: bool,
        classifier: bool,
        confidence: float,
        frame: np.ndarray | None,
        spaces: list[_CachedSpace] | None,
    ) -> None:
        if not self._path:
            return
        now = time.time()
        if now - self._last_logged_at.get(label, -float("inf")) < self._cooldown:
            return
        self._last_logged_at[label] = now

        record = {
            "detected_at": time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(now)),
            "space": label,
            "geometric": "occupied" if geometric else "vacant",
            "classifier": "occupied" if classifier else "vacant",
            "classifier_confidence": round(confidence, 3),
            "crop": self._save_crop(label, now, frame, spaces),
        }
        with open(self._path, "a") as f:
            f.write(json.dumps(record) + "\n")

    def _save_crop(
        self, label: str, ts: float, frame: np.ndarray | None, spaces: list[_CachedSpace] | None
    ) -> str | None:
        """The exact pixels the classifier judged (the space's bbox crop,
        unresized), saved so this disagreement can be hand-labeled later and
        used to fine-tune on Mater's own camera."""
        if not self._crops_dir or frame is None or spaces is None:
            return None
        space = next((s for s in spaces if s.label == label), None)
        if space is None:
            return None
        h, w = frame.shape[:2]
        x1, y1, x2, y2 = space.bbox
        x1, y1, x2, y2 = max(0, int(x1)), max(0, int(y1)), min(w, int(x2)), min(h, int(y2))
        if x2 <= x1 or y2 <= y1:
            return None
        os.makedirs(self._crops_dir, exist_ok=True)
        path = os.path.join(self._crops_dir, f"{label}_{int(ts * 1000)}.jpg")
        cv2.imwrite(path, frame[y1:y2, x1:x2])
        return path


def compute_occupancy(spaces: list[_CachedSpace], ground_points: list[tuple[float, float]]) -> dict[str, bool]:
    occupancy: dict[str, bool] = {}
    for space in spaces:
        occupancy[space.label] = any(is_occupied_by_point(space, pt) for pt in ground_points)
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
