"""Detect + track vehicles, optionally reading plates, frame by frame.

FR2: detect car/truck/bus/motorcycle with pretrained YOLO, track with
ByteTrack so each vehicle keeps a stable track_id while in view, drop
detections below a configurable confidence.

FR4: run plate detection + OCR on vehicle crops while the track is in
view; keep the highest-confidence read per track.

This is a class (not a single function) because both the CLI file-export
path and the live server need to iterate the same detect+track+annotate
step per frame and share the running best-plate-per-track state.
"""

from __future__ import annotations

import logging
from collections.abc import Iterator

import cv2
import numpy as np
import supervision as sv
from ultralytics import YOLO

from detector.config import VEHICLE_CLASSES, CameraConfig
from detector.plate import PlateRead, PlateReader
from detector.video_source import frames

log = logging.getLogger(__name__)


class DetectionPipeline:
    def __init__(self, config: CameraConfig, read_plates: bool = True) -> None:
        self.config = config
        self.model = YOLO(config.model)
        self.tracker = sv.ByteTrack()
        self.box_annotator = sv.BoxAnnotator()
        self.label_annotator = sv.LabelAnnotator()
        self.plate_reader = PlateReader() if read_plates else None
        self.best_plates: dict[int, PlateRead] = {}

    def process_frame(self, frame: np.ndarray) -> tuple[np.ndarray, sv.Detections]:
        result = self.model(
            frame,
            classes=list(VEHICLE_CLASSES),
            conf=self.config.confidence,
            verbose=False,
        )[0]
        detections = sv.Detections.from_ultralytics(result)
        detections = self.tracker.update_with_detections(detections)

        labels = []
        for track_id, class_id, box in zip(detections.tracker_id, detections.class_id, detections.xyxy):
            label = f"#{track_id} {VEHICLE_CLASSES.get(class_id, 'vehicle')}"
            if self.plate_reader is not None:
                label += self._update_and_format_plate(track_id, frame, box)
            labels.append(label)

        annotated = self.box_annotator.annotate(scene=frame.copy(), detections=detections)
        annotated = self.label_annotator.annotate(scene=annotated, detections=detections, labels=labels)
        return annotated, detections

    def _update_and_format_plate(self, track_id: int, frame: np.ndarray, box) -> str:
        read = self.plate_reader.read(frame, tuple(box))
        current_best = self.best_plates.get(track_id)
        if read is not None and (current_best is None or read.confidence > current_best.confidence):
            self.best_plates[track_id] = read
            current_best = read
        if current_best is None:
            return ""
        return f" {current_best.text} ({current_best.confidence:.2f})"

    def stream(self, duration_seconds: float | None = None) -> Iterator[tuple[np.ndarray, sv.Detections]]:
        for frame in frames(self.config, duration_seconds=duration_seconds):
            yield self.process_frame(frame)


def run(config: CameraConfig, output_path: str, duration_seconds: float | None = None, read_plates: bool = True) -> int:
    """Runs the pipeline over `config.source` and writes an annotated video
    to `output_path`. Returns the number of frames written."""
    pipeline = DetectionPipeline(config, read_plates=read_plates)
    writer: cv2.VideoWriter | None = None
    frame_count = 0

    for annotated, detections in pipeline.stream(duration_seconds=duration_seconds):
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
