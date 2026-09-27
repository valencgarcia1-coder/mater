"""Camera config schema for the detector.

M1 only used `fps`, `confidence`, `model`, and `masks`. `lines` and `spaces`
live in the same per-camera config object the PRD describes; `spaces` is
now populated and rendered (M2's occupancy-ROI groundwork), `lines` still
isn't consumed yet.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

import yaml

log = logging.getLogger(__name__)

# COCO class ids for the vehicle classes we care about.
VEHICLE_CLASSES = {2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}


@dataclass
class MaskRegion:
    x1: int
    y1: int
    x2: int
    y2: int


@dataclass
class SpaceRegion:
    label: str
    polygon: list[list[int]]  # [[x, y], ...] in image coordinates, 3+ points
    zone: str = "standard"  # looked up in parking_timers.ZONE_RULES for this space's timing rule


@dataclass
class CameraConfig:
    source: str
    fps: int = 5
    confidence: float = 0.4  # threshold to START a new track / count as a confirmed detection
    detection_floor: float = 0.1  # passed to YOLO itself — kept low on purpose, see note below
    model: str = "yolov8n.pt"
    imgsz: int = 640
    iou: float = 0.7
    agnostic_nms: bool = False
    masks: list[MaskRegion] = field(default_factory=list)
    lines: list[dict] = field(default_factory=list)
    spaces: list[SpaceRegion] = field(default_factory=list)

    @classmethod
    def from_yaml(cls, path: str) -> "CameraConfig":
        with open(path) as f:
            raw = yaml.safe_load(f) or {}
        masks = [MaskRegion(**m) for m in raw.get("masks", [])]
        spaces = [SpaceRegion(**s) for s in raw.get("spaces", [])]
        return cls(
            source=raw["source"],
            fps=raw.get("fps", 5),
            confidence=raw.get("confidence", 0.4),
            detection_floor=raw.get("detection_floor", 0.1),
            model=raw.get("model", "yolov8n.pt"),
            imgsz=raw.get("imgsz", 640),
            iou=raw.get("iou", 0.7),
            agnostic_nms=raw.get("agnostic_nms", False),
            masks=masks,
            lines=raw.get("lines", []),
            spaces=spaces,
        )


def parse_space(raw: object) -> SpaceRegion:
    """Validates one space from untrusted input (the API, or a hand-edited
    spaces.yaml). The editor's JS blocks a <3-point polygon client-side, but
    nothing stopped a direct API call or a bad YAML edit from reaching
    build_space_masks, where cv2.fillPoly asserts and takes the whole live
    feed into a restart loop that survives restarts (the bad data was already
    saved to spaces.yaml). Raises ValueError with a specific message."""
    if not isinstance(raw, dict) or "label" not in raw or "polygon" not in raw:
        raise ValueError("each space needs a label and a polygon")
    polygon = raw["polygon"]
    if not isinstance(polygon, list) or len(polygon) < 3:
        raise ValueError(f"space {raw['label']}: polygon needs at least 3 points")
    points = []
    for pt in polygon:
        ok = isinstance(pt, (list, tuple)) and len(pt) == 2 and all(
            isinstance(v, (int, float)) and not isinstance(v, bool) for v in pt
        )
        if not ok:
            raise ValueError(f"space {raw['label']}: every polygon point must be [x, y] numbers")
        points.append([int(round(pt[0])), int(round(pt[1]))])
    zone = raw.get("zone", "standard")
    if not isinstance(zone, str):
        raise ValueError(f"space {raw['label']}: zone must be a string")
    return SpaceRegion(label=str(raw["label"]), polygon=points, zone=zone)


def parse_spaces(raw_spaces: object) -> list[SpaceRegion]:
    if not isinstance(raw_spaces, list):
        raise ValueError("spaces must be a list")
    spaces = [parse_space(s) for s in raw_spaces]
    labels = [s.label for s in spaces]
    if len(set(labels)) != len(labels):
        raise ValueError("space labels must be unique")
    return spaces


def load_spaces_file(path: str) -> list[SpaceRegion]:
    try:
        with open(path) as f:
            raw = yaml.safe_load(f) or {}
    except FileNotFoundError:
        return []
    # Skip (and say so) rather than crash on a bad entry: a startup crash
    # here would need someone to hand-edit the file before the feed could
    # come back at all.
    spaces, seen = [], set()
    for entry in raw.get("spaces", []):
        try:
            space = parse_space(entry)
        except ValueError as e:
            log.warning("skipping invalid space in %s: %s", path, e)
            continue
        if space.label in seen:
            log.warning("skipping duplicate space label %s in %s", space.label, path)
            continue
        seen.add(space.label)
        spaces.append(space)
    return spaces


def save_spaces_file(path: str, spaces: list[SpaceRegion]) -> None:
    payload = {"spaces": [{"label": s.label, "polygon": s.polygon, "zone": s.zone} for s in spaces]}
    with open(path, "w") as f:
        yaml.safe_dump(payload, f, sort_keys=False)
