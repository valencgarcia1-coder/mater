"""Camera config schema for the detector.

M1 only used `fps`, `confidence`, `model`, and `masks`. `lines` and `spaces`
live in the same per-camera config object the PRD describes; `spaces` is
now populated and rendered (M2's occupancy-ROI groundwork), `lines` still
isn't consumed yet.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import yaml

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
