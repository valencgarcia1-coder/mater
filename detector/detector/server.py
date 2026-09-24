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
import json
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
    #toggles { margin-bottom: 12px; display: flex; gap: 8px; }
    .toggle { background: #333; color: #eee; border: 1px solid #555; border-radius: 6px; padding: 8px 14px; cursor: pointer; font-size: 13px; }
    .toggle:hover { background: #444; }
    .toggle.on { background: #16733f; border-color: #1e9c54; }
    .toggle.on:hover { background: #1a8a4b; }
  </style>
</head>
<body>
  <h1><span>Mater detector — live view</span><span><a href="/editor">number parking spaces →</a> &nbsp; <a href="/calibrate">calibrate distance →</a> &nbsp; <a href="/events">events →</a></span></h1>
  <div id="toggles">
    <button id="vehiclesBtn" class="toggle">Vehicle tracking</button>
    <button id="spacesBtn" class="toggle">Parking space availability</button>
    <button id="platesBtn" class="toggle">Plate reading (CPU-heavy)</button>
  </div>
  <img src="/stream" alt="live annotated feed">
  <div id="status">connecting…</div>
  <script>
    function paint(btn, on) {
      btn.classList.toggle('on', on);
      btn.textContent = btn.dataset.label + (on ? ': on' : ': off');
    }
    document.getElementById('vehiclesBtn').dataset.label = 'Vehicle tracking';
    document.getElementById('spacesBtn').dataset.label = 'Parking space availability';
    document.getElementById('platesBtn').dataset.label = 'Plate reading (CPU-heavy)';

    async function loadToggles() {
      const r = await fetch('/api/toggles');
      const t = await r.json();
      paint(document.getElementById('vehiclesBtn'), t.show_vehicles);
      paint(document.getElementById('spacesBtn'), t.show_spaces);
      paint(document.getElementById('platesBtn'), t.read_plates);
    }

    async function flip(key, btn) {
      const on = !btn.classList.contains('on');
      paint(btn, on);  // reflect the click immediately, don't wait on the network
      const r = await fetch('/api/toggles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: on })
      });
      const t = await r.json();
      // Only repaint the button this call actually changed. Repainting both
      // from every response is what let two near-simultaneous clicks' replies
      // arrive out of order and stomp on each other's button state.
      paint(btn, t[key]);
    }
    document.getElementById('vehiclesBtn').onclick = (e) => flip('show_vehicles', e.target);
    document.getElementById('spacesBtn').onclick = (e) => flip('show_spaces', e.target);
    document.getElementById('platesBtn').onclick = (e) => flip('read_plates', e.target);

    async function poll() {
      try {
        const r = await fetch('/status');
        const s = await r.json();
        document.getElementById('status').textContent =
          `${s.active_tracks} active tracks · ${s.frames_processed} frames processed · ${s.fps_estimate.toFixed(1)} fps`;
      } catch (e) {}
      setTimeout(poll, 1000);
    }
    loadToggles();
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
    select { background: #333; color: #eee; border: 1px solid #555; border-radius: 6px; padding: 7px 10px; font-size: 13px; }
    label { font-size: 13px; color: #aaa; }
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
    <label>Zone <select id="zoneSelect">
      <option value="standard">standard</option>
      <option value="fire_lane">fire_lane</option>
      <option value="handicap">handicap</option>
      <option value="loading_zone">loading_zone</option>
    </select></label>
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
        const zoneTag = s.zone && s.zone !== 'standard' ? ' ' + s.zone : '';
        ctx.fillText('P' + s.label + zoneTag, s.polygon[0][0] + 4, s.polygon[0][1] + 16);
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
      list.innerHTML = spaces.map(s => `<div><span>Space ${s.label} (${s.zone || 'standard'})</span><span>${s.polygon.length} pts</span></div>`).join('');
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
      const zone = document.getElementById('zoneSelect').value;
      spaces.push({ label: nextLabel(), polygon: current, zone });
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


CALIBRATE_HTML = """<!doctype html>
<html>
<head>
  <title>Mater detector — calibrate distance</title>
  <style>
    body { background: #111; color: #eee; font-family: system-ui, sans-serif; margin: 0; padding: 24px; }
    h1 { font-size: 16px; font-weight: 600; color: #999; margin: 0 0 8px; }
    p { font-size: 13px; color: #888; margin: 0 0 16px; max-width: 640px; }
    #wrap { position: relative; display: inline-block; }
    canvas { border-radius: 8px; display: block; cursor: crosshair; }
    #controls { margin-top: 12px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    button, input { background: #333; color: #eee; border: 1px solid #555; border-radius: 6px; padding: 8px 14px; cursor: pointer; font-size: 13px; }
    input { cursor: text; width: 70px; }
    button:hover { background: #444; }
    button.primary { background: #2563eb; border-color: #2563eb; }
    button.primary:hover { background: #1d4ed8; }
    label { font-size: 13px; color: #aaa; }
    #saveStatus { font-size: 13px; color: #6f6; margin-left: 8px; }
    #calStatus { margin-top: 12px; font-size: 13px; color: #888; }
  </style>
</head>
<body>
  <h1>Calibrate distance</h1>
  <p>Click 4 corners, in order, of a rectangle you know the real size of on the ground — one marked parking
     space works well. Order matters: top-left, top-right, bottom-right, bottom-left (as the rectangle actually
     sits on the ground, not necessarily top-left of the screen). Set its real width/height in meters, then Save.
     This fixes the "20 pixels near the camera != 20 pixels near the horizon" problem for stationary detection.</p>
  <div id="wrap">
    <canvas id="canvas"></canvas>
  </div>
  <div id="controls">
    <button id="resetBtn">Reset points</button>
    <label>Width (m) <input id="widthInput" type="number" step="0.1" value="2.7"></label>
    <label>Height (m) <input id="heightInput" type="number" step="0.1" value="5.5"></label>
    <button id="saveBtn" class="primary">Save</button>
    <span id="saveStatus"></span>
  </div>
  <div id="calStatus">loading…</div>
  <script>
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    let points = [];

    async function loadExisting() {
      const r = await fetch('/api/calibration');
      const c = await r.json();
      const status = document.getElementById('calStatus');
      if (c.calibrated) {
        points = c.image_points;
        document.getElementById('widthInput').value = c.width_m;
        document.getElementById('heightInput').value = c.height_m;
        status.textContent = `Calibrated: ${c.width_m}m x ${c.height_m}m rectangle`;
      } else {
        status.textContent = 'Not calibrated yet — using raw pixel distances (perspective-blind).';
      }
      render();
    }

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      render();
    };
    img.src = '/snapshot?' + Date.now();

    function render() {
      ctx.drawImage(img, 0, 0);
      ctx.lineWidth = 2;
      ctx.font = '16px sans-serif';
      ctx.strokeStyle = '#8cf';
      ctx.fillStyle = '#8cf';
      points.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(p[0], p[1], 5, 0, 7);
        ctx.fill();
        ctx.fillText(String(i + 1), p[0] + 8, p[1] - 8);
      });
      if (points.length > 1) {
        ctx.beginPath();
        points.forEach((p, i) => i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]));
        if (points.length === 4) ctx.closePath();
        ctx.stroke();
      }
    }

    canvas.addEventListener('click', (e) => {
      if (points.length >= 4) return;
      const rect = canvas.getBoundingClientRect();
      const x = Math.round((e.clientX - rect.left) * (canvas.width / rect.width));
      const y = Math.round((e.clientY - rect.top) * (canvas.height / rect.height));
      points.push([x, y]);
      render();
    });

    document.getElementById('resetBtn').onclick = () => { points = []; render(); };
    document.getElementById('saveBtn').onclick = async () => {
      if (points.length !== 4) { alert('Click exactly 4 points first'); return; }
      const width_m = parseFloat(document.getElementById('widthInput').value);
      const height_m = parseFloat(document.getElementById('heightInput').value);
      const r = await fetch('/api/calibration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_points: points, width_m, height_m })
      });
      const status = document.getElementById('saveStatus');
      if (r.ok) {
        status.textContent = 'saved ✓';
        await loadExisting();
      } else {
        status.textContent = 'error — check point order / values';
      }
      setTimeout(() => status.textContent = '', 3000);
    };

    loadExisting();
  </script>
</body>
</html>"""


EVENTS_HTML = """<!doctype html>
<html>
<head>
  <title>Mater detector — events</title>
  <style>
    body { background: #111; color: #eee; font-family: system-ui, sans-serif; margin: 0; padding: 24px; }
    h1 { font-size: 16px; font-weight: 600; color: #999; margin: 0 0 8px; }
    p { font-size: 13px; color: #888; margin: 0 0 16px; }
    table { border-collapse: collapse; width: 100%; max-width: 800px; font-size: 13px; }
    th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #333; }
    th { color: #999; font-weight: 600; }
    .EMPTY { color: #999; }
    .ARRIVING { color: #ccc; }
    .PARKED { color: #4d4; }
    .VIOLATION { color: #f90; }
    .TOW_ELIGIBLE { color: #f44; font-weight: 600; }
  </style>
</head>
<body>
  <h1>Space state transition events</h1>
  <p>One row per real state change — not one row per frame a state merely continues. This is the interface
     boundary a dispatch system would consume (see events.py); nothing in this codebase currently consumes it.</p>
  <table>
    <thead><tr><th>Time</th><th>Space</th><th>Zone</th><th>Event</th><th>Duration</th></tr></thead>
    <tbody id="rows"></tbody>
  </table>
  <script>
    async function poll() {
      const r = await fetch('/api/events?limit=100');
      const { events } = await r.json();
      document.getElementById('rows').innerHTML = events.map(e => `
        <tr>
          <td>${e.detected_at.replace('T', ' ')}</td>
          <td>P${e.space}</td>
          <td>${e.zone}</td>
          <td class="${e.event}">${e.event}</td>
          <td>${e.stationary_duration != null ? e.stationary_duration + 's' : '—'}</td>
        </tr>`).join('');
      setTimeout(poll, 2000);
    }
    poll();
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
    payload = {"spaces": [{"label": s.label, "polygon": s.polygon, "zone": s.zone} for s in spaces]}
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

    @app.route("/calibrate")
    def calibrate():
        return CALIBRATE_HTML

    @app.route("/events")
    def events_page():
        return EVENTS_HTML

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
        return jsonify({
            "spaces": [{"label": s.label, "polygon": s.polygon, "zone": s.zone} for s in feed.pipeline.config.spaces]
        })

    @app.route("/api/spaces", methods=["POST"])
    def post_spaces():
        payload = request.get_json(force=True)
        spaces = [
            SpaceRegion(label=str(s["label"]), polygon=s["polygon"], zone=s.get("zone", "standard"))
            for s in payload.get("spaces", [])
        ]
        save_spaces_file(spaces_file, spaces)
        feed.set_spaces(spaces)
        return jsonify({"ok": True, "count": len(spaces)})

    @app.route("/api/events")
    def get_events():
        limit = request.args.get("limit", default=50, type=int)
        events = []
        try:
            with open(feed.pipeline.events_path) as f:
                lines = f.readlines()
            for line in lines[-limit:]:
                events.append(json.loads(line))
        except FileNotFoundError:
            pass
        events.reverse()  # newest first
        return jsonify({"events": events})

    @app.route("/api/calibration", methods=["GET"])
    def get_calibration():
        raw = feed.pipeline.calibration.as_dict()
        if raw is None:
            return jsonify({"calibrated": False})
        return jsonify({"calibrated": True, **raw})

    @app.route("/api/calibration", methods=["POST"])
    def post_calibration():
        payload = request.get_json(force=True)
        try:
            feed.pipeline.apply_calibration(
                payload["image_points"], float(payload["width_m"]), float(payload["height_m"])
            )
        except (KeyError, ValueError) as e:
            return jsonify({"ok": False, "error": str(e)}), 400
        return jsonify({"ok": True})

    def _toggles_state():
        return {
            "show_vehicles": feed.pipeline.show_vehicles,
            "show_spaces": feed.pipeline.show_spaces,
            "read_plates": feed.pipeline.read_plates_enabled,
        }

    @app.route("/api/toggles", methods=["GET"])
    def get_toggles():
        return jsonify(_toggles_state())

    @app.route("/api/toggles", methods=["POST"])
    def post_toggles():
        payload = request.get_json(force=True)
        if "show_vehicles" in payload:
            feed.pipeline.show_vehicles = bool(payload["show_vehicles"])
        if "show_spaces" in payload:
            feed.pipeline.show_spaces = bool(payload["show_spaces"])
        if "read_plates" in payload:
            feed.pipeline.read_plates_enabled = bool(payload["read_plates"])
        return jsonify(_toggles_state())

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
