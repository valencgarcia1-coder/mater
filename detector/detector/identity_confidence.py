"""Detection/class/identity confidence, tracked as separate concerns rather
than folded into one number — "I see a vehicle" and "I know exactly which
vehicle this is" are different claims, and conflating them hides exactly
the failure mode this note calls out: identity mix-ups when vehicles
cluster and overlap.

Two of the four values are genuinely available without fabricating
anything:
- detection_confidence: already computed by YOLO every frame
  (detections.confidence) — nothing new needed here.
- class_confidence: the fraction of the trailing smoothing window that
  agrees with the current majority class (see class_smoothing.py) — a
  real, derived number.

tracking_confidence and position_confidence are NOT implemented as
separate opaque floats. Supervision's ByteTrack doesn't expose a per-frame
match-quality score through its public Detections output — an honest one
would mean reimplementing or reaching into its internal Kalman/association
state. A plausible-looking fabricated number would be worse than no number
at all for something feeding a tow decision.

Instead, this module computes the concrete, geometric version of the same
concern: "cars overlap -> trackers can switch identities." compute_crowded_
flags() flags a detection whose box meaningfully overlaps a DIFFERENT
detection's box this frame — real, checkable evidence of an elevated
identity-switch risk, used to visually mark the vehicle rather than hide
the uncertainty behind a made-up score.

Worth naming: this doesn't affect the tow-decision state machine at all.
That's anchored to space occupancy (spaces.py / parking_timers.py), not
vehicle identity — specifically because track identity isn't fully
reliable, a decision made earlier in this project for exactly this reason.
A vehicle-identity mix-up in a crowded row is a real cosmetic-tracking
concern; it isn't a business-logic one here.
"""

from __future__ import annotations

CROWDED_IOU_THRESHOLD = 0.1


def _iou(box_a: tuple[float, float, float, float], box_b: tuple[float, float, float, float]) -> float:
    ax1, ay1, ax2, ay2 = box_a
    bx1, by1, bx2, by2 = box_b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    if ix2 <= ix1 or iy2 <= iy1:
        return 0.0
    intersection = (ix2 - ix1) * (iy2 - iy1)
    area_a = (ax2 - ax1) * (ay2 - ay1)
    area_b = (bx2 - bx1) * (by2 - by1)
    union = area_a + area_b - intersection
    return intersection / union if union > 0 else 0.0


def compute_crowded_flags(boxes: list[tuple[float, float, float, float]]) -> list[bool]:
    """True for any box that meaningfully overlaps a DIFFERENT box this
    frame. O(n^2) over current detections, which is fine — a lot count in
    the tens, not thousands."""
    n = len(boxes)
    flags = [False] * n
    for i in range(n):
        for j in range(i + 1, n):
            if _iou(boxes[i], boxes[j]) >= CROWDED_IOU_THRESHOLD:
                flags[i] = True
                flags[j] = True
    return flags
