"""Ships space state-transition events to Supabase without ever blocking the
frame loop.

events.jsonl stays the local record; this is an additional, best-effort
destination. Events go on a bounded in-memory queue and a background thread
posts them to the database's record_space_event() function with the
service-role key (which must only ever live in this process's environment —
never in the repo, never in the dashboard).

Transient failures (network, 5xx) are retried with backoff; a rejected event
(4xx, e.g. a space label that was never seeded) is logged and dropped, since
retrying can't fix it. If the queue backs up past its limit the oldest events
are dropped rather than growing memory or stalling detection.
"""

from __future__ import annotations

import logging
import os
import queue
import threading
import time
from datetime import datetime, timezone

import httpx

log = logging.getLogger(__name__)

RETRY_DELAYS = (1, 2, 4, 8, 16)


class SupabaseEventSink:
    def __init__(
        self,
        url: str,
        service_key: str,
        camera_id: str,
        max_queue: int = 1000,
        timeout: float = 10.0,
        retry_delays: tuple[float, ...] = RETRY_DELAYS,
    ) -> None:
        self._rpc_base = f"{url.rstrip('/')}/rest/v1/rpc"
        self._headers = {"apikey": service_key, "Content-Type": "application/json"}
        # Legacy service_role keys are JWTs and go in Authorization too; the
        # newer sb_secret_* keys aren't JWTs and must only be sent as apikey.
        if service_key.startswith("eyJ"):
            self._headers["Authorization"] = f"Bearer {service_key}"
        self._camera_id = camera_id
        self._retry_delays = retry_delays
        self._client = httpx.Client(timeout=timeout)
        self._queue: queue.Queue[tuple[str, dict]] = queue.Queue(maxsize=max_queue)
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    @classmethod
    def from_env(cls) -> "SupabaseEventSink":
        missing = [k for k in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_CAMERA_ID") if not os.environ.get(k)]
        if missing:
            raise RuntimeError(f"--supabase needs these environment variables set: {', '.join(missing)}")
        return cls(
            os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"], os.environ["SUPABASE_CAMERA_ID"]
        )

    def enqueue(self, event: dict) -> None:
        """Called from the frame loop: must return immediately."""
        self._put("record_space_event", {
            "p_camera_id": self._camera_id,
            "p_label": str(event["space"]),
            "p_state": str(event["event"]).lower(),
            "p_elapsed": event.get("stationary_duration"),
            # Events are emitted the moment the transition happens, so now() is
            # the occurrence time; sent as UTC so it's unambiguous in the DB.
            "p_occurred_at": datetime.now(timezone.utc).isoformat(),
        })

    def enqueue_status(self, statuses: dict[str, dict]) -> None:
        """Snapshot of every space's current state ({label: {state, elapsed}}),
        so the live status table is right from startup and self-heals after any
        dropped event. Shares the queue with events, so it's delivered after
        any event enqueued before it and can't overwrite a newer state."""
        self._put("sync_space_status", {
            "p_camera_id": self._camera_id,
            "p_states": [
                {"label": str(label), "state": st["state"], "elapsed": st.get("elapsed")}
                for label, st in statuses.items()
            ],
        })

    def _put(self, rpc: str, payload: dict) -> None:
        item = (rpc, payload)
        try:
            self._queue.put_nowait(item)
        except queue.Full:
            try:
                self._queue.get_nowait()  # drop the oldest to make room
                self._queue.task_done()  # a dropped item is finished too, or flush() would wait on it forever
            except queue.Empty:
                pass
            self._queue.put_nowait(item)
            log.warning("supabase sink queue full; dropped the oldest item")

    def flush(self, timeout: float = 30.0) -> bool:
        """Blocks until everything queued has been sent (or given up on)."""
        done = threading.Event()

        def wait() -> None:
            self._queue.join()
            done.set()

        threading.Thread(target=wait, daemon=True).start()
        return done.wait(timeout)

    def _run(self) -> None:
        while True:
            rpc, payload = self._queue.get()
            try:
                self._send(rpc, payload)
            except Exception:
                log.exception("supabase sink: unexpected error, dropping event")
            finally:
                self._queue.task_done()

    def _send(self, rpc: str, payload: dict) -> None:
        for attempt in range(len(self._retry_delays) + 1):
            try:
                resp = self._client.post(f"{self._rpc_base}/{rpc}", headers=self._headers, json=payload)
            except httpx.HTTPError as e:
                error = f"network error: {e}"
            else:
                if resp.status_code < 300:
                    return
                if resp.status_code < 500:
                    log.error(
                        "supabase rejected %s (%s): %s — not retrying", rpc, resp.status_code, resp.text[:200],
                    )
                    return
                error = f"server error {resp.status_code}"
            if attempt < len(self._retry_delays):
                time.sleep(self._retry_delays[attempt])
            else:
                log.error("supabase sink: giving up on %s after retries (%s)", rpc, error)
