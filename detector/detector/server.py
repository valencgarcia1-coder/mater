"""Minimal live viewer: runs the pipeline in a background thread against one
configured source and serves the annotated feed as MJPEG, so you can watch
tracking (and plate reads) in a browser instead of digging through exported
clips. Also serves a small point-and-click editor for numbering parking
spaces on a snapshot of the feed (FR8's "camera setup" idea, minimal
version) — those spaces then render live on the annotated stream.

Usage:
  python -m detector.server "https://www.youtube.com/watch?v=4a-3iEM7bHk"
  python -m detector.server path/to/clip.mp4 --no-plates
  python -m detector.server --config detector/config.example.yaml
"""

from __future__ import annotations

import argparse
import logging
import threading
import time

import cv2
import yaml
from flask import Flask, Response, jsonify, request

from detector.config import CameraConfig, SpaceRegion
from detector.pipeline import DetectionPipeline

log = logging.getLogger(__name__)

INDEX_HTML = """<!doctype html>
<html>
<head>
  <title>Mater detector — live view</title>
  <style>
    body { background: #111; color: #eee; font-family: system-ui, sans-serif; margin: 0; padding: 24px; }
    h1 { font-size: 16px; font-weight: 600; color: #999; margin: 0 0 16px; display: flex; justify-content: space-between; }
    h1 a { color: #6cf; font-size: 13px; font-weight: 400; text-decoration: none; }
    img { max-width: 100%; border-radius: 8px; display: block; }
    #status { margin-top: 12px; font-size: 13px; color: #888; }
  </style>
</head>
<body>
  <h1><span>Mater detector — live view</span><a href="/editor">number parking spaces →</a></h1>
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

EDITOR_HTML = """<!doctype html>
<html>
<head>
  <title>Mater detector — number parking spaces</title>
  <style>
    body { background: #111; color: #eee; font-family: system-ui, sans-serif; margin: 0; padding: 24px; }
    h1 { font-size: 16px; font-weight: 600; color: #999; margin: 0 0 8px; }
    p { font-size: 13px; color: #888; margin: 0 0 16px; max-width: 640px; }
    #wrap { position: relative; display: inline-block; }
    canvas { border-radius: 8px; display: block; cursor: crosshair; }
    #controls { margin-top: 12px; display: flex; gap: 8px; align-items: center; }
    button { background: #333; color: #eee; border: 1px solid #555; border-radius: 6px; padding: 8px 14px; cursor: pointer; font-size: 13px; }
    button:hover { background: #444; }
    button.primary { background: #2563eb; border-color: #2563eb; }
    button.primary:hover { background: #1d4ed8; }
    #list { margin-top: 16px; font-size: 13px; color: #ccc; }
    #list div { padding: 4px 0; display: flex; justify-content: space-between; max-width: 300px; }
    #saveStatus { font-size: 13px; color: #6f6; margin-left: 8px; }
  </style>
</head>
<body>
  <h1>Number parking spaces</h1>
  <p>Click each corner of a space (3+ points), then "Finish space" to close it and assign the next number.
     Click "Save" when done — spaces render live on the feed immediately.</p>
  <div id="wrap">
    <canvas id="canvas"></canvas>
  </div>
  <div id="controls">
    <button id="finishBtn">Finish space</button>
    <button id="undoBtn">Undo point</button>
    <button id="clearBtn">Clear current</button>
    <button id="removeLastBtn">Remove last saved space</button>
    <button id="saveBtn" class="primary">Save</button>
    <span id="saveStatus"></span>
  </div>
  <div id="list"></div>
  <script>
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    let spaces = [];       // {label, polygon: [[x,y],...]}
    let current = [];      // points for the in-progress polygon

    async function loadExisting() {
      const r = await fetch('/api/spaces');
      spaces = (await r.json()).spaces || [];
      render();
    }

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      render();
    };
    img.src = '/snapshot?' + Date.now();

    function nextLabel() {
      const nums = spaces.map(s => parseInt(s.label, 10)).filter(n => !isNaN(n));
      return String((nums.length ? Math.max(...nums) : 0) + 1);
    }

    function render() {
      ctx.drawImage(img, 0, 0);
      ctx.lineWidth = 2;
      ctx.font = '16px sans-serif';
      for (const s of spaces) {
        ctx.strokeStyle = '#8cf';
        ctx.beginPath();
        s.polygon.forEach((p, i) => i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]));
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = '#8cf';
        ctx.fillText('P' + s.label, s.polygon[0][0] + 4, s.polygon[0][1] + 16);
      }
      if (current.length) {
        ctx.strokeStyle = '#fc6';
        ctx.beginPath();
        current.forEach((p, i) => i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]));
        ctx.stroke();
        for (const p of current) {
          ctx.fillStyle = '#fc6';
          ctx.beginPath();
          ctx.arc(p[0], p[1], 3, 0, 7);
          ctx.fill();
        }
      }
      renderList();
    }

    function renderList() {
      const list = document.getElementById('list');
      list.innerHTML = spaces.map(s => `<div><span>Space ${s.label}</span><span>${s.polygon.length} pts</span></div>`).join('');
    }

    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = Math.round((e.clientX - rect.left) * (canvas.width / rect.width));
      const y = Math.round((e.clientY - rect.top) * (canvas.height / rect.height));
      current.push([x, y]);
      render();
    });

    document.getElementById('finishBtn').onclick = () => {
      if (current.length < 3) { alert('Need at least 3 points'); return; }
      spaces.push({ label: nextLabel(), polygon: current });
      current = [];
      render();
    };
    document.getElementById('undoBtn').onclick = () => { current.pop(); render(); };
    document.getElementById('clearBtn').onclick = () => { current = []; render(); };
    document.getElementById('removeLastBtn').onclick = () => { spaces.pop(); render(); };
    document.getElementById('saveBtn').onclick = async () => {
      await fetch('/api/spaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spaces })
      });
      const status = document.getElementById('saveStatus');
      status.textContent = 'saved ✓';
      setTimeout(() => status.textContent = '', 2000);
    };

    loadExisting();
  </script>
</body>
</html>"""


def load_spaces_file(path: str) -> list[SpaceRegion]:
    try:
        with open(path) as f:
            raw = yaml.safe_load(f) or {}
    except FileNotFoundError:
        return []
    return [SpaceRegion(**s) for s in raw.get("spaces", [])]


def save_spaces_file(path: str, spaces: list[SpaceRegion]) -> None:
    payload = {"spaces": [{"label": s.label, "polygon": s.polygon} for s in spaces]}
    with open(path, "w") as f:
        yaml.safe_dump(payload, f, sort_keys=False)


class LiveFeed:
    """Owns the pipeline and the single latest annotated JPEG, produced by
    one background thread and read by any number of HTTP clients."""

    def __init__(self, config: CameraConfig, read_plates: bool) -> None:
        self.config = config
        self.pipeline = DetectionPipeline(config, read_plates=read_plates)
        self._lock = threading.Lock()
        self._latest_jpeg: bytes | None = None
        self._latest_raw_jpeg: bytes | None = None  # unannotated, for the space editor
        self._active_tracks = 0
        self._frames_processed = 0
        self._started_at = time.monotonic()
        self._thread = threading.Thread(target=self._run, daemon=True)

    def start(self) -> None:
        self._thread.start()

    def _run(self) -> None:
        while True:
            try:
                self._process_forever()
            except Exception:
                log.exception("pipeline crashed, restarting in 5s")
                time.sleep(5)

    def _process_forever(self) -> None:
        from detector.video_source import frames as _frames

        for raw_frame in _frames(self.pipeline.config):
            annotated, detections = self.pipeline.process_frame(raw_frame)
            ok_a, buf_a = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 80])
            ok_r, buf_r = cv2.imencode(".jpg", raw_frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            with self._lock:
                if ok_a:
                    self._latest_jpeg = buf_a.tobytes()
                if ok_r:
                    self._latest_raw_jpeg = buf_r.tobytes()
                self._active_tracks = len(detections)
                self._frames_processed += 1

    def latest_jpeg(self) -> bytes | None:
        with self._lock:
            return self._latest_jpeg

    def latest_raw_jpeg(self) -> bytes | None:
        with self._lock:
            return self._latest_raw_jpeg

    def set_spaces(self, spaces: list[SpaceRegion]) -> None:
        self.pipeline.set_spaces(spaces)

    def status(self) -> dict:
        with self._lock:
            elapsed = time.monotonic() - self._started_at
            return {
                "active_tracks": self._active_tracks,
                "frames_processed": self._frames_processed,
                "fps_estimate": self._frames_processed / elapsed if elapsed > 0 else 0.0,
            }


def create_app(config: CameraConfig, read_plates: bool = True, spaces_file: str = "spaces.yaml") -> Flask:
    app = Flask(__name__)
    feed = LiveFeed(config, read_plates=read_plates)
    feed.start()

    @app.route("/")
    def index():
        return INDEX_HTML

    @app.route("/editor")
    def editor():
        return EDITOR_HTML

    @app.route("/status")
    def status():
        return jsonify(feed.status())

    @app.route("/stream")
    def stream():
        return Response(_mjpeg_generator(feed), mimetype="multipart/x-mixed-replace; boundary=frame")

    @app.route("/snapshot")
    def snapshot():
        jpeg = feed.latest_raw_jpeg() or feed.latest_jpeg()
        if jpeg is None:
            return Response(status=503)
        return Response(jpeg, mimetype="image/jpeg")

    @app.route("/api/spaces", methods=["GET"])
    def get_spaces():
        return jsonify({"spaces": [{"label": s.label, "polygon": s.polygon} for s in feed.pipeline.config.spaces]})

    @app.route("/api/spaces", methods=["POST"])
    def post_spaces():
        payload = request.get_json(force=True)
        spaces = [SpaceRegion(label=str(s["label"]), polygon=s["polygon"]) for s in payload.get("spaces", [])]
        save_spaces_file(spaces_file, spaces)
        feed.set_spaces(spaces)
        return jsonify({"ok": True, "count": len(spaces)})

    return app


def _mjpeg_generator(feed: LiveFeed):
    while True:
        jpeg = feed.latest_jpeg()
        if jpeg is not None:
            yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + jpeg + b"\r\n"
        time.sleep(0.1)


def main() -> None:
    parser = argparse.ArgumentParser(description="Mater detector — live viewer")
    parser.add_argument("source", nargs="?", help="video file path, RTSP URL, or YouTube URL")
    parser.add_argument("--config", help="camera config YAML (overrides source and the flags below)")
    parser.add_argument("--fps", type=int, default=5)
    # Tuned against the Brighton livestream (elevated, wide, fisheye-distorted
    # lot): yolov8n/640/conf=0.4 was missing real vehicles at range. A bigger
    # model at native resolution and a lower confidence catches them, but
    # needs class-agnostic NMS at a tighter IoU or the same vehicle gets
    # double-boxed under two different vehicle classes.
    parser.add_argument("--conf", type=float, default=0.3)
    parser.add_argument("--model", default="yolov8s-seg.pt")
    parser.add_argument("--imgsz", type=int, default=1280)
    parser.add_argument("--iou", type=float, default=0.2)
    parser.add_argument("--no-plates", action="store_true")
    parser.add_argument("--spaces-file", default="spaces.yaml", help="where the /editor page saves numbered spaces")
    parser.add_argument("--port", type=int, default=5050)
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)

    if args.config:
        config = CameraConfig.from_yaml(args.config)
    else:
        if not args.source:
            parser.error("source is required unless --config is given")
        config = CameraConfig(
            source=args.source,
            fps=args.fps,
            confidence=args.conf,
            model=args.model,
            imgsz=args.imgsz,
            iou=args.iou,
            agnostic_nms=True,
        )
    saved_spaces = load_spaces_file(args.spaces_file)
    if saved_spaces:
        config.spaces = saved_spaces

    app = create_app(config, read_plates=not args.no_plates, spaces_file=args.spaces_file)
    app.run(host="127.0.0.1", port=args.port, threaded=True)


if __name__ == "__main__":
    main()
