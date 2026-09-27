"""Tests for the Supabase event sink and seed script against a fake PostgREST
server. Run from detector/:  python -m unittest discover -s tests -t .
The SQL itself is tested separately on real Postgres (supabase/tests)."""

from __future__ import annotations

import json
import os
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

from detector.events import EventLog
from detector.supabase_seed import seed
from detector.supabase_sink import SupabaseEventSink


class FakeSupabase:
    """Records requests; `script` is a list of status codes to return in order
    for the RPC endpoint (default 200), and `delay` slows every response."""

    def __init__(self, script=None, delay=0.0):
        self.requests, self.script, self.delay = [], list(script or []), delay
        self.tables = {"properties": [], "cameras": [], "spaces": []}
        fake = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *a): pass

            def _reply(self, code, body=None):
                data = json.dumps(body if body is not None else {}).encode()
                self.send_response(code)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

            def do_POST(self):
                if fake.delay:
                    time.sleep(fake.delay)
                raw = self.rfile.read(int(self.headers.get("Content-Length", 0)))
                body = json.loads(raw) if raw else None
                url = urlparse(self.path)
                fake.requests.append({"path": url.path, "query": parse_qs(url.query), "headers": dict(self.headers), "body": body})
                if "/rpc/" in url.path:
                    code = fake.script.pop(0) if fake.script else 200
                    return self._reply(code, 1 if code < 300 else {"message": "nope"})
                table = url.path.rsplit("/", 1)[-1]
                if table == "spaces":
                    for row in body:
                        existing = [r for r in fake.tables["spaces"] if r["camera_id"] == row["camera_id"] and r["label"] == row["label"]]
                        if existing:
                            existing[0].update(row)
                        else:
                            fake.tables["spaces"].append(dict(row))
                    return self._reply(201)
                row = {"id": f"{table}-{len(fake.tables[table]) + 1}", **body}
                fake.tables[table].append(row)
                self._reply(201, [row])

            def do_GET(self):
                url = urlparse(self.path)
                table = url.path.rsplit("/", 1)[-1]
                filters = {k: v[0][3:] for k, v in parse_qs(url.query).items() if v[0].startswith("eq.")}
                rows = [r for r in fake.tables[table] if all(str(r.get(k)) == v for k, v in filters.items())]
                self._reply(200, [{"id": r["id"]} for r in rows])

        self.server = HTTPServer(("127.0.0.1", 0), Handler)
        self.url = f"http://127.0.0.1:{self.server.server_port}"
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def rpc(self, name="record_space_event"):
        return [r for r in self.requests if r["path"].endswith(f"/rpc/{name}")]

    def close(self):
        self.server.shutdown()


EVENT = {"event": "VIOLATION", "space": "7", "zone": "standard", "detected_at": "x", "stationary_duration": 65.4}


class SinkTests(unittest.TestCase):
    def make(self, fake, **kw):
        return SupabaseEventSink(fake.url, "svc-key", "cam-1", retry_delays=kw.pop("retry_delays", (0.01, 0.01)), **kw)

    def test_event_is_mapped_and_authenticated(self):
        fake = FakeSupabase(); self.addCleanup(fake.close)
        sink = self.make(fake)
        sink.enqueue(EVENT); self.assertTrue(sink.flush())
        req = fake.rpc()[0]
        self.assertEqual(req["body"]["p_camera_id"], "cam-1")
        self.assertEqual(req["body"]["p_label"], "7")
        self.assertEqual(req["body"]["p_state"], "violation")
        self.assertEqual(req["body"]["p_elapsed"], 65.4)
        self.assertTrue(req["body"]["p_occurred_at"].endswith("+00:00"))  # timezone-aware UTC
        self.assertEqual(req["headers"]["apikey"], "svc-key")
        self.assertNotIn("Authorization", req["headers"])   # not a JWT -> apikey only

    def test_legacy_jwt_key_is_also_sent_as_bearer(self):
        fake = FakeSupabase(); self.addCleanup(fake.close)
        sink = SupabaseEventSink(fake.url, "eyJhbGciOi.payload.sig", "cam-1", retry_delays=())
        sink.enqueue(EVENT); sink.flush()
        self.assertEqual(fake.rpc()[0]["headers"]["Authorization"], "Bearer eyJhbGciOi.payload.sig")

    def test_server_error_is_retried_until_it_succeeds(self):
        fake = FakeSupabase(script=[500, 503, 200]); self.addCleanup(fake.close)
        sink = self.make(fake)
        sink.enqueue(EVENT); self.assertTrue(sink.flush())
        self.assertEqual(len(fake.rpc()), 3)

    def test_rejected_event_is_not_retried(self):
        fake = FakeSupabase(script=[400]); self.addCleanup(fake.close)
        sink = self.make(fake)
        sink.enqueue(EVENT); self.assertTrue(sink.flush())
        self.assertEqual(len(fake.rpc()), 1)

    def test_gives_up_after_retries_without_raising(self):
        fake = FakeSupabase(script=[500] * 10); self.addCleanup(fake.close)
        sink = self.make(fake, retry_delays=(0.01, 0.01))
        sink.enqueue(EVENT); self.assertTrue(sink.flush())
        self.assertEqual(len(fake.rpc()), 3)  # first try + 2 retries

    def test_unreachable_server_does_not_raise_or_hang(self):
        sink = SupabaseEventSink("http://127.0.0.1:1", "k", "cam-1", retry_delays=(0.01,), timeout=1)
        sink.enqueue(EVENT)
        self.assertTrue(sink.flush(timeout=10))

    def test_enqueue_never_blocks_on_a_slow_network(self):
        fake = FakeSupabase(delay=1.0); self.addCleanup(fake.close)
        sink = self.make(fake)
        start = time.monotonic()
        for _ in range(5):
            sink.enqueue(EVENT)
        self.assertLess(time.monotonic() - start, 0.2)

    def test_queue_overflow_drops_oldest_not_newest(self):
        fake = FakeSupabase(delay=0.3); self.addCleanup(fake.close)
        sink = self.make(fake, max_queue=2)
        for i in range(6):
            sink.enqueue({**EVENT, "space": str(i)})
        self.assertTrue(sink.flush(timeout=10))
        sent = [r["body"]["p_label"] for r in fake.rpc()]
        self.assertEqual(sent[-1], "5")          # newest survived
        self.assertLess(len(sent), 6)            # something was dropped

    def test_status_snapshot_is_sent_to_its_own_rpc(self):
        fake = FakeSupabase(); self.addCleanup(fake.close)
        sink = self.make(fake)
        sink.enqueue_status({"5": {"zone": "standard", "state": "parked", "elapsed": 33.5},
                             "6": {"zone": "standard", "state": "empty", "elapsed": None}})
        self.assertTrue(sink.flush())
        body = fake.rpc("sync_space_status")[0]["body"]
        self.assertEqual(body["p_camera_id"], "cam-1")
        self.assertEqual(body["p_states"], [{"label": "5", "state": "parked", "elapsed": 33.5},
                                            {"label": "6", "state": "empty", "elapsed": None}])
        self.assertEqual(fake.rpc(), [])  # not mistaken for an event

    def test_snapshot_is_delivered_after_events_enqueued_before_it(self):
        fake = FakeSupabase(); self.addCleanup(fake.close)
        sink = self.make(fake)
        sink.enqueue(EVENT)
        sink.enqueue_status({"7": {"state": "violation", "elapsed": 65.4}})
        self.assertTrue(sink.flush())
        order = [r["path"].rsplit("/", 1)[-1] for r in fake.requests]
        self.assertEqual(order, ["record_space_event", "sync_space_status"])

    def test_from_env_requires_all_variables(self):
        for k in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_CAMERA_ID"):
            os.environ.pop(k, None)
        with self.assertRaises(RuntimeError):
            SupabaseEventSink.from_env()

    def test_event_log_writes_local_file_and_feeds_sink(self):
        fake = FakeSupabase(); self.addCleanup(fake.close)
        sink = self.make(fake)
        path = os.path.join(tempfile.mkdtemp(), "events.jsonl")
        EventLog(path, sink=sink).emit(space="3", zone="standard", state="parked", elapsed=12.0)
        sink.flush()
        self.assertEqual(json.loads(open(path).readline())["event"], "PARKED")   # local record kept
        self.assertEqual(fake.rpc()[0]["body"]["p_state"], "parked")

    def test_event_log_survives_sink_being_down(self):
        sink = SupabaseEventSink("http://127.0.0.1:1", "k", "cam-1", retry_delays=(), timeout=1)
        path = os.path.join(tempfile.mkdtemp(), "events.jsonl")
        EventLog(path, sink=sink).emit(space="3", zone="standard", state="parked", elapsed=1.0)
        self.assertTrue(os.path.getsize(path) > 0)


class SeedTests(unittest.TestCase):
    def spaces_file(self, spaces):
        import yaml
        path = os.path.join(tempfile.mkdtemp(), "spaces.yaml")
        yaml.safe_dump({"spaces": spaces}, open(path, "w"))
        return path

    def test_seed_is_idempotent_and_upserts_spaces(self):
        fake = FakeSupabase(); self.addCleanup(fake.close)
        good = [{"label": "1", "polygon": [[0, 0], [5, 0], [5, 5]], "zone": "standard"},
                {"label": "2", "polygon": [[1, 1], [6, 1], [6, 6]], "zone": "handicap"}]
        f = self.spaces_file(good)
        cam1 = seed(fake.url, "k", "Ski Lot", "Main", f, "America/Denver", None)
        cam2 = seed(fake.url, "k", "Ski Lot", "Main", f, "America/Denver", None)
        self.assertEqual(cam1, cam2)
        self.assertEqual(len(fake.tables["properties"]), 1)
        self.assertEqual(len(fake.tables["cameras"]), 1)
        self.assertEqual(len(fake.tables["spaces"]), 2)
        spaces_call = [r for r in fake.requests if r["path"].endswith("/spaces")][0]
        self.assertEqual(spaces_call["query"]["on_conflict"], ["camera_id,label"])
        self.assertIn("merge-duplicates", spaces_call["headers"]["Prefer"])

    def test_seed_skips_invalid_spaces_and_refuses_an_empty_set(self):
        fake = FakeSupabase(); self.addCleanup(fake.close)
        f = self.spaces_file([{"label": "1", "polygon": [[0, 0]]}])
        with self.assertRaises(SystemExit):
            seed(fake.url, "k", "P", "C", f, "America/Denver", None)
        self.assertEqual(fake.requests, [])   # nothing sent before validation


if __name__ == "__main__":
    unittest.main()
