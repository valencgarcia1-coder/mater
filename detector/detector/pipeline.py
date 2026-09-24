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
import os
from collections.abc import Iterator

import cv2
import numpy as np
import supervision as sv
import torch
from ultralytics import YOLO

from detector.config import VEHICLE_CLASSES, CameraConfig, SpaceRegion
from detector.parking_timers import ParkingTimers
from detector.plate import PlateRead, PlateReader
from detector.spaces import build_space_masks, compute_occupancy, draw_spaces
from detector.video_source import frames

log = logging.getLogger(__name__)

# By default torch (and this machine's other libraries) will happily claim
# every core for CPU inference — fine in isolation, but this runs alongside
# a browser, this coding session, and whatever else is on the machine.
# Capping it trades a bit of throughput for not starving everything else.
torch.set_num_threads(max(1, min(4, os.cpu_count() or 4)))


class DetectionPipeline:
    def __init__(self, config: CameraConfig, read_plates: bool = True, timers_state_path: str = "parking_timers.json") -> None:
        self.config = config
        self.parking_timers = ParkingTimers(state_path=timers_state_path)
        self.model = YOLO(config.model)
        self.tracker = sv.ByteTrack(
            # This is ByteTrack's actual point, and we were bypassing it: a
            # confirmed vehicle's detection score can wobble below the
            # "confidence" threshold for a frame (lighting, partial
            # occlusion) without the vehicle having moved or left. ByteTrack
            # is designed to use those lower-score boxes to keep an already-
            # confirmed track alive, while still requiring the higher
            # threshold to START a new one — but only if it actually
            # receives them. We were pre-filtering at conf=confidence before
            # the tracker ever saw the frame, discarding exactly the boxes
            # it needs, which is why boxes were flickering on and off.
            track_activation_threshold=config.confidence,
            # lost_track_buffer is in units of *our* processed frames (frame_rate
            # stays at its default of 30, which keeps the tracker's internal
            # frame_rate/30 scaling a no-op) — ~2 seconds of occlusion tolerance
            # at our actual sampling rate, so a briefly-hidden car keeps its ID
            # instead of coming back as a new one.
            lost_track_buffer=max(5, round(config.fps * 2)),
            # Require a detection to hold for 3 consecutive frames before it
            # becomes a track, so a single spurious detection doesn't flicker
            # a box into existence for one frame.
            minimum_consecutive_frames=3,
        )
        # color_lookup=TRACK gives each track_id a distinct, stable color
        # from the palette — otherwise every vehicle is class "car" and all
        # boxes render identically, which is what made tracks illegible.
        # PolygonAnnotator traces the segmentation mask's actual silhouette
        # (roofline, mirrors, wheels) instead of a rectangle — a box can
        # never truly outline a car since cars aren't rectangles. Requires a
        # "-seg" model (config.model), which is the only difference; the
        # rest of the pipeline (tracking, plates, spaces) is unchanged.
        self.box_annotator = sv.PolygonAnnotator(thickness=2, color_lookup=sv.ColorLookup.TRACK)
        self.label_annotator = sv.LabelAnnotator(
            color_lookup=sv.ColorLookup.TRACK,
            text_scale=0.4,
            text_padding=4,
            smart_position=True,  # nudges labels apart when boxes cluster tightly
        )
        self.plate_reader = PlateReader() if read_plates else None
        self.best_plates: dict[int, PlateRead] = {}
        self._cached_spaces = None  # built lazily once we know frame size
        self.set_spaces(config.spaces)
        # Display-only toggles. Detection/tracking/timers/occupancy keep
        # running underneath either way — turning off the vehicle overlay
        # shouldn't also break space occupancy (which needs the detections)
        # or reset a parking timer's state.
        self.show_vehicles = True
        self.show_spaces = True
        # Off by default: plate OCR runs its own model per tracked vehicle,
        # every frame — the single most expensive thing in this pipeline,
        # and on a far-away feed like Brighton (per the PRD, unreadable at
        # this distance) it burns CPU for nothing. The model stays loaded so
        # flipping this on is instant, no reload.
        self.read_plates_enabled = False

    def set_spaces(self, spaces: list[SpaceRegion]) -> None:
        """(Re)builds the numbered occupancy-space overlay. Public so a live
        editor can update spaces on a running pipeline without restarting it."""
        self.config.spaces = spaces
        self._pending_spaces = spaces
        self._cached_spaces = None  # rebuilt on the next frame, once size is known

    def process_frame(self, frame: np.ndarray) -> tuple[np.ndarray, sv.Detections]:
        if self._cached_spaces is None:
            self._cached_spaces = build_space_masks(self._pending_spaces, frame.shape[:2])

        result = self.model(
            frame,
            classes=list(VEHICLE_CLASSES),
            # Deliberately NOT config.confidence — see the ByteTrack comment
            # in __init__. This has to stay low so the tracker gets the
            # marginal-confidence boxes it needs to bridge a momentary dip
            # in an already-tracked vehicle's score.
            conf=self.config.detection_floor,
            imgsz=self.config.imgsz,
            iou=self.config.iou,
            agnostic_nms=self.config.agnostic_nms,
            verbose=False,
        )[0]
        detections = sv.Detections.from_ultralytics(result)
        detections = self.tracker.update_with_detections(detections)

        labels = []
        for track_id, class_id, box in zip(detections.tracker_id, detections.class_id, detections.xyxy):
            class_name = VEHICLE_CLASSES.get(class_id, "vehicle")
            # "car" is the overwhelming majority — naming it on every box is
            # pure clutter, but a truck/bus/motorcycle is worth calling out.
            label = f"#{track_id}" if class_name == "car" else f"#{track_id} {class_name}"
            if self.plate_reader is not None and self.read_plates_enabled:
                label += self._update_and_format_plate(track_id, frame, box)
            labels.append(label)

        annotated = frame.copy()
        if self._cached_spaces:
            # Occupancy and the parking timer always run, regardless of the
            # show_spaces display toggle — a space's clock shouldn't pause
            # just because you're not currently looking at the overlay.
            # Prefer the real segmentation masks over boxes for occupancy —
            # a rectangular box is looser than the vehicle and can spill into
            # a neighboring space enough to false-positive as occupied there.
            masks = list(detections.mask) if detections.mask is not None else None
            occupancy = compute_occupancy(self._cached_spaces, [tuple(b) for b in detections.xyxy], masks=masks)
            status_by_label = self.parking_timers.update({label for label, occ in occupancy.items() if occ})
            if self.show_spaces:
                annotated = draw_spaces(annotated, self._cached_spaces, occupancy, status_by_label)
        if self.show_vehicles:
            annotated = self.box_annotator.annotate(scene=annotated, detections=detections)
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
