"""M1: detect + track vehicles in a video source, write an annotated output.

FR2 from the PRD: detect car/truck/bus/motorcycle with pretrained YOLO,
track with ByteTrack so each vehicle keeps a stable track_id while in view,
drop detections below a configurable confidence.
"""

from __future__ import annotations

import logging

import cv2
import supervision as sv
from ultralytics import YOLO

from detector.config import VEHICLE_CLASSES, CameraConfig
from detector.video_source import frames

log = logging.getLogger(__name__)


def run(config: CameraConfig, output_path: str, duration_seconds: float | None = None) -> int:
    """Runs detection+tracking over `config.source` and writes an annotated
    video to `output_path`. Returns the number of frames written."""
    model = YOLO(config.model)
    tracker = sv.ByteTrack()
    box_annotator = sv.BoxAnnotator()
    label_annotator = sv.LabelAnnotator()

    writer: cv2.VideoWriter | None = None
    frame_count = 0

    for frame in frames(config, duration_seconds=duration_seconds):
        result = model(
            frame,
            classes=list(VEHICLE_CLASSES),
            conf=config.confidence,
            verbose=False,
        )[0]
        detections = sv.Detections.from_ultralytics(result)
        detections = tracker.update_with_detections(detections)

        labels = [
            f"#{track_id} {VEHICLE_CLASSES.get(class_id, 'vehicle')}"
            for track_id, class_id in zip(detections.tracker_id, detections.class_id)
        ]

        annotated = box_annotator.annotate(scene=frame.copy(), detections=detections)
        annotated = label_annotator.annotate(scene=annotated, detections=detections, labels=labels)

        if writer is None:
            h, w = annotated.shape[:2]
            fourcc = cv2.VideoWriter_fourcc(*"mp4v")
            writer = cv2.VideoWriter(output_path, fourcc, config.fps, (w, h))

        writer.write(annotated)
        frame_count += 1
        if frame_count % 25 == 0:
            log.info("processed %d frames, %d active tracks", frame_count, len(detections))

    if writer is not None:
        writer.release()
    return frame_count
