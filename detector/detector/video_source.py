"""Resolves a video source (file / RTSP / YouTube) into sampled frames.

Handles FR1 from the PRD: accept file/RTSP/YouTube input, sample at a
configured fps, reconnect with backoff on stream drops, and mask configured
regions before they reach the detector.
"""

from __future__ import annotations

import logging
import time
from collections.abc import Iterator

import cv2
import numpy as np
import yt_dlp

from detector.config import CameraConfig, MaskRegion

log = logging.getLogger(__name__)

MAX_BACKOFF_SECONDS = 30


def is_youtube_url(source: str) -> bool:
    return "youtube.com" in source or "youtu.be" in source


def resolve_stream_url(youtube_url: str) -> str:
    """Resolve a YouTube URL to a direct, playable stream URL via yt-dlp.

    Forces the `android` player client: as of this writing, YouTube's web/tv
    player responses fail extraction ("The page needs to be reloaded" /
    "No video formats found") for live streams, while `android` still works.
    """
    ydl_opts = {
        "format": "best[ext=mp4]/best",
        "quiet": True,
        "noplaylist": True,
        "extractor_args": {"youtube": {"player_client": ["android"]}},
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(youtube_url, download=False)
        if "url" in info:
            return info["url"]
        return info["formats"][-1]["url"]


def apply_masks(frame: np.ndarray, masks: list[MaskRegion]) -> np.ndarray:
    for m in masks:
        cv2.rectangle(frame, (m.x1, m.y1), (m.x2, m.y2), (0, 0, 0), thickness=-1)
    return frame


def _open_capture(source: str) -> tuple[cv2.VideoCapture, str]:
    """Opens `source`, resolving it fresh if it's a YouTube URL. Returns the
    capture plus the URL actually opened (so reconnects can re-resolve)."""
    resolved = resolve_stream_url(source) if is_youtube_url(source) else source
    cap = cv2.VideoCapture(resolved)
    return cap, resolved


def frames(config: CameraConfig, duration_seconds: float | None = None) -> Iterator[np.ndarray]:
    """Yields masked frames sampled at `config.fps`, reconnecting with
    exponential backoff if the source drops. `duration_seconds` bounds a run
    against a live/infinite source (e.g. for local testing); omit it to run
    until the source ends (a finite file) or forever (a stream).

    Sampling skips frames by count (source_fps / target_fps), not by wall
    clock: a local file should be processed as fast as it decodes, and a
    live stream is already paced to real time by the network read itself.
    """
    is_live = is_youtube_url(config.source) or config.source.startswith("rtsp://")
    cap, current_url = _open_capture(config.source)

    def frame_skip(capture: cv2.VideoCapture) -> int:
        source_fps = capture.get(cv2.CAP_PROP_FPS) or 30.0
        return max(1, round(source_fps / config.fps))

    skip = frame_skip(cap)
    frame_index = 0
    start = time.monotonic()
    backoff = 1.0

    try:
        while True:
            if duration_seconds is not None and time.monotonic() - start >= duration_seconds:
                return

            ok, frame = cap.read()
            if not ok:
                cap.release()
                if not is_live:
                    return  # end of a local file, nothing to reconnect to
                log.warning("stream drop on %s, reconnecting in %.0fs", config.source, backoff)
                time.sleep(backoff)
                backoff = min(backoff * 2, MAX_BACKOFF_SECONDS)
                cap, current_url = _open_capture(config.source)
                skip = frame_skip(cap)
                frame_index = 0
                continue

            backoff = 1.0  # reset after a good read
            frame_index += 1
            if frame_index % skip != 0:
                continue

            yield apply_masks(frame, config.masks)
    finally:
        cap.release()
