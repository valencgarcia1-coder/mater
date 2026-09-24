"""Camera config schema for the detector.

M1 only uses `fps`, `confidence`, `model`, and `masks`. `lines` and `spaces`
are defined here now because they live in the same per-camera config object
the PRD describes, but they're populated and consumed starting in M2.
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
class CameraConfig:
    source: str
    fps: int = 5
    confidence: float = 0.4
    model: str = "yolov8n.pt"
    masks: list[MaskRegion] = field(default_factory=list)
    lines: list[dict] = field(default_factory=list)
    spaces: list[dict] = field(default_factory=list)

    @classmethod
    def from_yaml(cls, path: str) -> "CameraConfig":
        with open(path) as f:
            raw = yaml.safe_load(f) or {}
        masks = [MaskRegion(**m) for m in raw.get("masks", [])]
        return cls(
            source=raw["source"],
            fps=raw.get("fps", 5),
            confidence=raw.get("confidence", 0.4),
            model=raw.get("model", "yolov8n.pt"),
            masks=masks,
            lines=raw.get("lines", []),
            spaces=raw.get("spaces", []),
        )
