"""FR5 groundwork: numbered parking-space polygons and occupancy.

A space's mask is precomputed once (spaces are static per camera config,
they don't move frame to frame) so checking a vehicle against every space
each frame is a cheap array index, not a full-frame fill per space per
frame.

Occupancy is decided by proximity, not strict containment (see
closest_space_label below): a stationary vehicle is attributed to whichever
configured space it's nearest to, not just whichever polygon its point
happens to fall strictly inside. A parking lot camera routinely can't see a
space's full area — a nearer row of cars blocks part of the view INTO a
space that's further back — and hand-drawn polygons are never pixel-perfect
against where a car actually parks. Requiring literal containment fails in
both cases; proximity survives them, because a car parked slightly over a
line or a few pixels outside a slightly-imprecise boundary is still
obviously closer to its own space than to any other one.

This is deliberately capped by MAX_ASSIGNMENT_DISTANCE: a vehicle stopped in
a driving aisle, nowhere near any marked space, still has SOME nearest
space by pure geometry, but that doesn't mean it's parked there. Only
vehicles already confirmed stationary reach this check at all (see
pipeline.py) — proximity answers "which space," not "is this vehicle even
parked."
"""

from __future__ import annotations

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


MAX_ASSIGNMENT_DISTANCE = 40.0  # pixels — see module docstring; roughly a third of a typical space's width/height


def _distance_to_space(space: _CachedSpace, point: tuple[float, float]) -> float:
    """Signed distance from a point to a space's polygon boundary, OpenCV's
    convention: positive when inside (magnitude = depth inside), negative
    when outside (magnitude = distance to the nearest edge), zero on the
    boundary itself."""
    return float(cv2.pointPolygonTest(space.polygon, (float(point[0]), float(point[1])), True))


def _nearest_space(spaces: list[_CachedSpace], point: tuple[float, float]) -> tuple[str | None, float]:
    best_label: str | None = None
    best_distance = -float("inf")
    for space in spaces:
        d = _distance_to_space(space, point)
        if d > best_distance:
            best_distance = d
            best_label = space.label
    return best_label, best_distance


def closest_space_label(spaces: list[_CachedSpace], points: dict[str, tuple[float, float]]) -> str | None:
    """Which space a stationary vehicle actually occupies, by proximity —
    see the module docstring for why this replaced strict point-in-polygon
    containment.

    "ground" is checked FIRST and ALONE, not pooled together with
    front/back into one combined vote. It's a single stable point (box
    bottom-center); front/back are the leftmost/rightmost pixel of the
    vehicle's entire mask, which shifts by several pixels frame to frame as
    the segmentation boundary's own noise moves — for a vehicle sitting
    near the line between two spaces, that noise was enough to flip which
    neighboring space's polygon a front/back point happened to poke into on
    any given frame. Pooling all three into one global max meant that
    flicker could occasionally outscore ground's own, actually-consistent
    answer, so a single physical car would alternately register as two
    different spaces frame to frame — and since OccupancyDebouncer requires
    ONE label to hold steady before confirming, a flip-flopping label never
    confirms either one, which is exactly the "car sitting there but never
    reads occupied" bug this fixes.

    front/back only get consulted when ground doesn't resolve to any space
    within tolerance at all — the real fallback case this was designed for
    (the vehicle's base occluded, see vehicle_reference_points), not a
    routine second opinion on every frame.

    Returns None if even the closest match is farther than
    MAX_ASSIGNMENT_DISTANCE — without that cap, a vehicle stopped anywhere
    in frame (a driving aisle, nowhere near a marked space) would still get
    force-assigned to whichever space happens to be nearest, however far
    away that actually is.
    """
    ground_label, ground_distance = _nearest_space(spaces, points["ground"])
    if ground_distance >= -MAX_ASSIGNMENT_DISTANCE:
        return ground_label

    best_label: str | None = None
    best_distance = -float("inf")
    for key in ("front", "back"):
        label, distance = _nearest_space(spaces, points[key])
        if distance > best_distance:
            best_distance = distance
            best_label = label
    if best_distance < -MAX_ASSIGNMENT_DISTANCE:
        return None
    return best_label


def vehicle_reference_points(
    box: tuple[float, float, float, float], mask: np.ndarray | None = None
) -> dict[str, tuple[float, float]]:
    """Three points describing where a vehicle actually is, not just its
    detection box: "ground" (bottom-center — the primary occupancy point,
    see closest_space_label), plus "top", "front", and "back", read off the
    vehicle's own segmentation mask when one exists.

    front/back exist for one reason: the ground point needs the vehicle's
    BASE visible to be accurate, and a nearer vehicle occluding the base
    truncates the detection box's bottom edge, making "ground" land
    somewhere wrong (often a lane, not the space the car is actually in).
    front/back only need the vehicle's SIDE visible, which survives that
    kind of occlusion — see closest_space_label, which checks all three.

    "top" is deliberately NOT used for occupancy at all: at this camera's
    oblique angle, a roof point's image-space location can correspond to a
    completely different ground position than the space beneath the
    vehicle. It exists purely as a visual "a vehicle is here" marker.
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
# closest_space_label already rules out neighbor-mask/box spillover by
# construction (each vehicle resolves to a single best-matching space —
# being clearly inside one space always outscores being merely near a
# different one). Two failure modes remain even with a proximity test:
#
#   1. A spurious detection (a shadow, a reflection, a decal the model
#      mistakes for a vehicle) can still place a "ground point" inside a
#      space that's genuinely empty. Geometry alone can't tell a real
#      vehicle's footprint from a false one.
#   2. A single frame where a real vehicle's ground point briefly lands
#      inside a space (a car cutting through, not parking) reads exactly
#      like a car settling in, because occupancy is decided fresh every
#      frame with no memory of how long it's held.
#
# SpaceAppearanceModel addresses (1) by corroborating a detector-positive
# reading against the space's own pixels — a phantom detection doesn't
# actually change what the pavement looks like. OccupancyDebouncer
# addresses (2) by requiring a positive reading to hold for a short window
# before it's trusted enough to hand to ParkingTimers (which already
# tolerates brief gaps in the *other* direction via GRACE_PERIOD_SECONDS).

APPEARANCE_DIFF_THRESHOLD = 18.0  # mean abs grayscale diff (0-255) read as "changed"
APPEARANCE_LEARNING_RATE = 0.02  # background adaptation rate while confidently empty


class SpaceAppearanceModel:
    """Per-space background-patch corroboration for the geometry-based
    occupancy check. While a space reads empty (per the detector) and its
    own patch is stable, this keeps a running average of what "empty" looks
    like there. A detector-positive reading is only trusted if the space's
    actual pixels have also visibly changed from that background — a real,
    independent signal a phantom detection (shadow, reflection, a decal)
    can't produce, since nothing about the pavement actually changed.

    Deliberately one-directional: this only ever VETOES a detector-positive
    reading, never invents an occupied space on its own. An appearance
    change alone (a shadow, a pedestrian, a car passing in front of the
    space on its way elsewhere) is too easy to false-positive on to trust
    unsupervised — requiring it to *agree* with the detector is a safe
    tightening, not a replacement for it.
    """

    # A vehicle that's been parked for hours gets a brand-new track ID on
    # every restart, and VelocityTracker needs ~3s of that fresh track's own
    # history before it calls the vehicle stationary (see velocity.py's
    # WINDOW_SECONDS) — so detector_occupied can read False for a space
    # that's very much occupied, purely because tracking just restarted, not
    # because the space is empty. Refusing to seed any background during
    # this cold-start window avoids learning that still-parked car as "this
    # is what empty looks like" a few seconds later than it would otherwise.
    STARTUP_GRACE_SECONDS = 6.0

    def __init__(
        self,
        diff_threshold: float = APPEARANCE_DIFF_THRESHOLD,
        learning_rate: float = APPEARANCE_LEARNING_RATE,
    ) -> None:
        self._diff_threshold = diff_threshold
        self._learning_rate = learning_rate
        self._background: dict[str, np.ndarray] = {}
        self._started_at = time.time()

    def looks_changed(self, space: _CachedSpace, frame: np.ndarray, detector_occupied: bool, now: float | None = None) -> bool:
        now = now if now is not None else time.time()
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
            # via the live editor). Only seed it from a frame the detector
            # already reads as EMPTY, and only once past the startup grace
            # window above — a real vehicle is routinely already parked
            # before this process ever starts, and seeding "empty" from a
            # frame that already has a motionless car in it would
            # permanently mistake that car for the background: it never
            # moves, so every future frame would look "unchanged" and this
            # model would veto that space's real occupancy forever. Until a
            # genuinely empty moment gives us something real to compare
            # against, just pass the detector's own reading through.
            if detector_occupied or (now - self._started_at) < self.STARTUP_GRACE_SECONDS:
                return detector_occupied
            self._background[space.label] = patch
            return False

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


def compute_occupancy(
    spaces: list[_CachedSpace],
    vehicle_points: list[dict[str, tuple[float, float]]],
    frame: np.ndarray | None = None,
    appearance_model: SpaceAppearanceModel | None = None,
) -> dict[str, bool]:
    occupied_labels = {
        label for label in (closest_space_label(spaces, points) for points in vehicle_points) if label is not None
    }

    occupancy: dict[str, bool] = {}
    for space in spaces:
        detector_occupied = space.label in occupied_labels

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
