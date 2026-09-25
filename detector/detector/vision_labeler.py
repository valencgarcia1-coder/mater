"""Bootstraps a labeled occupancy dataset by periodically asking a vision
model to judge whether a space's own cropped image shows a parked vehicle.

Why this exists: the geometric occupancy pipeline (ground-point-in-polygon,
SpaceAppearanceModel's background-diff corroboration, OccupancyDebouncer) is
a detector + geometry pipeline, not a system that actually looks at each
space's pixels and judges occupancy the way a person would. The research
this project is built on (CNRPark-EXT/PKLot) gets its accuracy from a
trained per-space classifier instead — but training one needs labeled
examples of THIS camera's spaces, occupied and empty, which don't exist.
Rather than hand-labeling images, this asks a real vision model for its
judgment on each space at a slow, sustainable cadence and logs the result,
accumulating a camera-specific labeled dataset for free over days of
runtime — training data for a future local classifier, without a human
labeling anything.

Deliberately NOT called every frame, or even every few seconds: each call
is a real, billed API request. This runs its own background thread on a
long per-space interval and never blocks frame processing; the pipeline
just hands it the latest frame each tick and moves on.
"""

from __future__ import annotations

import base64
import json
import logging
import os
import threading
import time
from dataclasses import dataclass

import cv2
import numpy as np

log = logging.getLogger(__name__)

DEFAULT_INTERVAL_SECONDS = 90.0  # per space — see module docstring on API cost
DEFAULT_MODEL = "claude-haiku-4-5-20251001"  # cheap/fast is the right tradeoff for a repetitive yes/no crop judgment

LABEL_PROMPT = (
    "This is a cropped image of a single marked parking space from a fixed "
    "overhead camera. Reply with exactly one word: \"occupied\" if a "
    "vehicle (car, truck, SUV, motorcycle) is parked in this space, "
    "\"empty\" if it is not, or \"unsure\" if the crop is unclear or you "
    "cannot tell."
)


@dataclass
class LabelResult:
    label: str  # "occupied" | "empty" | "unsure"
    raw_response: str


class VisionLabeler:
    """Runs its own background thread. `submit_frame` is cheap — it just
    records the latest frame and space geometry; the thread decides on its
    own schedule when a given space is actually due for another labeling
    call, independent of the pipeline's own frame rate."""

    def __init__(
        self,
        dataset_dir: str,
        interval_seconds: float = DEFAULT_INTERVAL_SECONDS,
        model: str = DEFAULT_MODEL,
    ) -> None:
        self._dataset_dir = dataset_dir
        self._images_dir = os.path.join(dataset_dir, "images")
        self._manifest_path = os.path.join(dataset_dir, "labels.jsonl")
        os.makedirs(self._images_dir, exist_ok=True)

        self._interval = interval_seconds
        self._model = model
        self._client = None  # constructed lazily, see `client` — only needs
        # ANTHROPIC_API_KEY if this feature is actually enabled and used.

        self._lock = threading.Lock()
        self._latest_frame: np.ndarray | None = None
        self._latest_spaces: list | None = None  # list[_CachedSpace] from spaces.py
        self._last_labeled_at: dict[str, float] = {}

        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    @property
    def client(self):
        if self._client is None:
            import anthropic  # deferred: avoid the import cost/requirement when unused

            self._client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from the environment
        return self._client

    def submit_frame(self, frame: np.ndarray, cached_spaces: list) -> None:
        with self._lock:
            self._latest_frame = frame
            self._latest_spaces = cached_spaces

    def _run(self) -> None:
        while True:
            try:
                self._label_one_due_space()
            except Exception:
                log.exception("vision labeler: label attempt failed, continuing")
            time.sleep(1.0)  # check for a due space roughly once a second — cheap, no API call itself

    def _label_one_due_space(self) -> None:
        with self._lock:
            frame = self._latest_frame
            spaces = self._latest_spaces

        if frame is None or not spaces:
            return

        now = time.time()
        due = [s for s in spaces if now - self._last_labeled_at.get(s.label, 0.0) >= self._interval]
        if not due:
            return

        # One per wake-up, not all overdue spaces at once — keeps the real
        # API call rate predictable (~1 per second at most) instead of
        # bursting every space through at the same moment. Picking the MOST
        # overdue space (not just due[0]) matters: spaces.yaml's list order
        # never changes, so due[0] would always resolve to the same space
        # every single wake-up once it re-qualifies each interval, starving
        # every other space of a turn forever.
        space = min(due, key=lambda s: self._last_labeled_at.get(s.label, 0.0))
        self._last_labeled_at[space.label] = now

        x1, y1, x2, y2 = space.bbox
        h, w = frame.shape[:2]
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)
        if x2 <= x1 or y2 <= y1:
            return
        crop = frame[y1:y2, x1:x2]

        result = self._ask_vision_model(crop)
        if result is not None:
            self._log_example(space.label, crop, result)

    def _ask_vision_model(self, crop: np.ndarray) -> LabelResult | None:
        ok, buf = cv2.imencode(".jpg", crop, [cv2.IMWRITE_JPEG_QUALITY, 90])
        if not ok:
            return None
        image_b64 = base64.b64encode(buf.tobytes()).decode("ascii")

        response = self.client.messages.create(
            model=self._model,
            max_tokens=10,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {"type": "base64", "media_type": "image/jpeg", "data": image_b64},
                        },
                        {"type": "text", "text": LABEL_PROMPT},
                    ],
                }
            ],
        )
        text = "".join(block.text for block in response.content if block.type == "text").strip().lower()
        if "occupied" in text:
            label = "occupied"
        elif "empty" in text:
            label = "empty"
        else:
            label = "unsure"
        return LabelResult(label=label, raw_response=text)

    def _log_example(self, space_label: str, crop: np.ndarray, result: LabelResult) -> None:
        if result.label == "unsure":
            return  # not a usable training example either way

        ts = time.time()
        image_filename = f"{space_label}_{int(ts * 1000)}.jpg"
        image_path = os.path.join(self._images_dir, image_filename)
        cv2.imwrite(image_path, crop)

        record = {
            "space": space_label,
            "label": result.label,
            "raw_response": result.raw_response,
            "timestamp": ts,
            "image": os.path.join("images", image_filename),
        }
        with open(self._manifest_path, "a") as f:
            f.write(json.dumps(record) + "\n")
        log.info("vision labeler: space %s -> %s", space_label, result.label)
