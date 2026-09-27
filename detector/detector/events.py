"""Structured events for space state transitions — not a direct call to a
tow endpoint.

Don't send POST /tow every time the model sees a violation: generate an
event and let a separate dispatch system decide what to do with it. There
is no dispatch system in this codebase — this module is the interface
boundary a future one would consume, not a dispatch implementation. It only
does one thing: write a structured record to an append-only log whenever a
space's state actually changes (EMPTY, ARRIVING, PARKED, VIOLATION,
TOW_ELIGIBLE), so nothing downstream has to poll or re-derive history.
"""

from __future__ import annotations

import json
import time


class EventLog:
    def __init__(self, path: str | None = "events.jsonl", sink=None) -> None:
        self._path = path
        # Optional additional destination (see supabase_sink.py). The local
        # file is still written first and stays the source of truth — the sink
        # is best-effort and must never block or fail the caller.
        self._sink = sink

    def emit(self, space: str, zone: str, state: str, elapsed: float | None) -> dict:
        event = {
            "event": state.upper(),
            "space": space,
            "zone": zone,
            "detected_at": time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime()),
            "stationary_duration": round(elapsed, 1) if elapsed is not None else None,
        }
        if self._path:
            with open(self._path, "a") as f:
                f.write(json.dumps(event) + "\n")
        if self._sink is not None:
            self._sink.enqueue(event)
        return event
