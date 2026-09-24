"""Per-vehicle "how long has this been parked" timers.

Deliberately anchored to spatial position, not the tracker's track_id.
ByteTrack's ID can still change after a long/heavy occlusion — we saw this
happen ourselves on the Brighton feed even after tuning it — which would
silently reset a track-id-keyed timer back to zero. That's exactly the
"cannot go on and off" behavior a persistent dwell timer must not have. A
session here tracks a *location*; whichever vehicle box lands there each
frame keeps that session's clock running, independent of what ID the
tracker currently has for it.

A session only starts its clock once a vehicle has held roughly the same
spot for CONFIRM_STATIONARY_SECONDS — a car passing through the lot isn't
"parked," so it shouldn't get a timer. A session survives up to
GRACE_PERIOD_SECONDS of no matching detection (occlusion by a passing
vehicle, a missed frame) before we conclude the vehicle actually left.

State is persisted to disk after every update: restarting the server
should not zero out the clock for a car that's still legitimately parked.
For a car already parked when a session is first created (including the
very first frame the whole system ever runs), there's no way to know how
long it was already sitting there, so — as intended — its timer simply
starts counting from zero at that point.
"""

from __future__ import annotations

import json
import time
from dataclasses import asdict, dataclass

MATCH_DISTANCE_PX = 45  # how close a centroid must be to count as "the same parked vehicle"
CONFIRM_STATIONARY_SECONDS = 5  # how long it must hold still before we call it "parked", not "passing through"
GRACE_PERIOD_SECONDS = 12  # how long a spot can go unmatched before we call the vehicle gone


@dataclass
class _Session:
    session_id: int
    centroid_x: float
    centroid_y: float
    first_seen_at: float
    last_seen_at: float
    started_at: float | None = None  # None until confirmed stationary


class ParkingTimers:
    def __init__(self, state_path: str | None = "parking_timers.json") -> None:
        self._sessions: dict[int, _Session] = {}
        self._next_id = 1
        self._state_path = state_path
        self._load()

    def update(self, centroids: list[tuple[float, float]], now: float | None = None) -> list[float | None]:
        """Call once per frame with every current detection's centroid, in
        the same order as the detections. Returns, per detection, elapsed
        parked seconds — or None if it hasn't been confirmed stationary yet."""
        now = now if now is not None else time.time()
        assigned: dict[int, int] = {}
        used_sessions: set[int] = set()

        for i, (cx, cy) in enumerate(centroids):
            best_id, best_dist = None, MATCH_DISTANCE_PX
            for sid, s in self._sessions.items():
                if sid in used_sessions:
                    continue
                dist = ((s.centroid_x - cx) ** 2 + (s.centroid_y - cy) ** 2) ** 0.5
                if dist <= best_dist:
                    best_id, best_dist = sid, dist

            if best_id is not None:
                s = self._sessions[best_id]
                s.centroid_x, s.centroid_y = cx, cy
                s.last_seen_at = now
                if s.started_at is None and now - s.first_seen_at >= CONFIRM_STATIONARY_SECONDS:
                    s.started_at = s.first_seen_at
                assigned[i] = best_id
            else:
                sid = self._next_id
                self._next_id += 1
                self._sessions[sid] = _Session(sid, cx, cy, first_seen_at=now, last_seen_at=now)
                assigned[i] = sid
            used_sessions.add(assigned[i])

        stale = [sid for sid, s in self._sessions.items() if now - s.last_seen_at > GRACE_PERIOD_SECONDS]
        for sid in stale:
            del self._sessions[sid]

        self._save()

        elapsed: list[float | None] = []
        for i in range(len(centroids)):
            s = self._sessions.get(assigned.get(i))
            elapsed.append((now - s.started_at) if (s and s.started_at is not None) else None)
        return elapsed

    def _load(self) -> None:
        if not self._state_path:
            return
        try:
            with open(self._state_path) as f:
                raw = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return
        # The process may have been stopped for longer than GRACE_PERIOD_SECONDS;
        # that's downtime, not evidence the vehicle left. Reset the grace clock
        # to "since restart" rather than purging everything on the first update.
        now = time.time()
        for item in raw:
            item["last_seen_at"] = now
            s = _Session(**item)
            self._sessions[s.session_id] = s
            self._next_id = max(self._next_id, s.session_id + 1)

    def _save(self) -> None:
        if not self._state_path:
            return
        with open(self._state_path, "w") as f:
            json.dump([asdict(s) for s in self._sessions.values()], f)


def format_duration(seconds: float) -> str:
    total = int(seconds)
    h, rem = divmod(total, 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"
