"""Minimal live viewer: runs the pipeline in a background thread against one
configured source and serves the annotated feed as MJPEG, so you can watch
tracking (and plate reads) in a browser instead of digging through exported
clips.

Usage:
  python -m detector.server "https://www.youtube.com/watch?v=4a-3iEM7bHk"
  python -m detector.server path/to/clip.mp4 --no-plates
"""

from __future__ import annotations

import argparse
import logging
import threading
import time

import cv2
from flask import Flask, Response, jsonify

from detector.config import CameraConfig
from detector.pipeline import DetectionPipeline

log = logging.getLogger(__name__)

INDEX_HTML = """<!doctype html>
<html>
<head>
  <title>Mater detector — live view</title>
  <style>
    body { background: #111; color: #eee; font-family: system-ui, sans-serif; margin: 0; padding: 24px; }
    h1 { font-size: 16px; font-weight: 600; color: #999; margin: 0 0 16px; }
    img { max-width: 100%; border-radius: 8px; display: block; }
    #status { margin-top: 12px; font-size: 13px; color: #888; }
  </style>
</head>
<body>
  <h1>Mater detector — live view</h1>
  <img src="/stream" alt="live annotated feed">
  <div id="status">connecting…</div>
  <script>
    async function poll() {
      try {
        const r = await fetch('/status');
        const s = await r.json();
        document.getElementById('status').textContent =
          `${s.active_tracks} active tracks · ${s.frames_processed} frames processed · ${s.fps_estimate.toFixed(1)} fps`;
      } catch (e) {}
      setTimeout(poll, 1000);
    }
    poll();
  </script>
</body>
</html>"""


class LiveFeed:
    """Owns the pipeline and the single latest annotated JPEG, produced by
    one background thread and read by any number of HTTP clients."""

    def __init__(self, config: CameraConfig, read_plates: bool) -> None:
        self.config = config
        self.pipeline = DetectionPipeline(config, read_plates=read_plates)
        self._lock = threading.Lock()
        self._latest_jpeg: bytes | None = None
        self._active_tracks = 0
        self._frames_processed = 0
        self._started_at = time.monotonic()
        self._thread = threading.Thread(target=self._run, daemon=True)

    def start(self) -> None:
        self._thread.start()

    def _run(self) -> None:
        while True:
            try:
                for annotated, detections in self.pipeline.stream():
                    ok, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 80])
                    if not ok:
                        continue
                    with self._lock:
                        self._latest_jpeg = buf.tobytes()
                        self._active_tracks = len(detections)
                        self._frames_processed += 1
            except Exception:
                log.exception("pipeline crashed, restarting in 5s")
                time.sleep(5)

    def latest_jpeg(self) -> bytes | None:
        with self._lock:
            return self._latest_jpeg

    def status(self) -> dict:
        with self._lock:
            elapsed = time.monotonic() - self._started_at
            return {
                "active_tracks": self._active_tracks,
                "frames_processed": self._frames_processed,
                "fps_estimate": self._frames_processed / elapsed if elapsed > 0 else 0.0,
            }


def create_app(config: CameraConfig, read_plates: bool = True) -> Flask:
    app = Flask(__name__)
    feed = LiveFeed(config, read_plates=read_plates)
    feed.start()

    @app.route("/")
    def index():
        return INDEX_HTML

    @app.route("/status")
    def status():
        return jsonify(feed.status())

    @app.route("/stream")
    def stream():
        return Response(_mjpeg_generator(feed), mimetype="multipart/x-mixed-replace; boundary=frame")

    return app


def _mjpeg_generator(feed: LiveFeed):
    while True:
        jpeg = feed.latest_jpeg()
        if jpeg is not None:
            yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + jpeg + b"\r\n"
        time.sleep(0.1)


def main() -> None:
    parser = argparse.ArgumentParser(description="Mater detector — live viewer")
    parser.add_argument("source", help="video file path, RTSP URL, or YouTube URL")
    parser.add_argument("--fps", type=int, default=5)
    parser.add_argument("--conf", type=float, default=0.4)
    parser.add_argument("--model", default="yolov8n.pt")
    parser.add_argument("--no-plates", action="store_true")
    parser.add_argument("--port", type=int, default=5050)
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)
    config = CameraConfig(source=args.source, fps=args.fps, confidence=args.conf, model=args.model)
    app = create_app(config, read_plates=not args.no_plates)
    app.run(host="127.0.0.1", port=args.port, threaded=True)


if __name__ == "__main__":
    main()
