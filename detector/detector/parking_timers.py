"""Per-space "how long has a vehicle been parked here" timers.

Anchored to the numbered parking space itself, not to a tracked vehicle or
a raw position on the ground. This is a deliberate choice: a parking space
is fixed, human-defined ground truth, and every tow-decision rule this
system exists to support is written per zone/space ("stationary in a
restricted zone for 18 minutes"), not per arbitrary vehicle. A vehicle
sitting in an aisle or open pavement has no rule attached to it at all, so
timing it wouldn't mean anything — and matching "the same parked vehicle"
across frames by position needs a distance-threshold heuristic, whereas
"is this exact space occupied" is already computed precisely via mask
overlap (see spaces.py) and needs no guessing.

A space's clock only starts once it's been continuously occupied for
CONFIRM_OCCUPIED_SECONDS — a car briefly driving through a marked spot
isn't "parked." It survives up to GRACE_PERIOD_SECONDS of reading as
unoccupied (a passing vehicle blocking the view for a moment, a missed
frame) before we conclude the vehicle actually left.

State persists to disk after every update: restarting the server shouldn't
zero out the clock for a space that's still legitimately occupied. A space
that's already occupied the first time we ever see it has no knowable
prior duration, so — as intended — its timer starts from zero.
"""

from __future__ import annotations

import json
import time
from dataclasses import asdict, dataclass

CONFIRM_OCCUPIED_SECONDS = 4  # how long continuous occupancy must hold before we call it "parked"
GRACE_PERIOD_SECONDS = 10  # how long a space can read empty before we call the vehicle gone


@dataclass
class _SpaceState:
    label: str
    first_occupied_at: float
    last_occupied_at: float
    started_at: float | None = None  # None until confirmed parked


class ParkingTimers:
    def __init__(self, state_path: str | None = "parking_timers.json") -> None:
        self._state: dict[str, _SpaceState] = {}
        self._state_path = state_path
        self._load()

    def update(self, occupied_labels: set[str], now: float | None = None) -> dict[str, float | None]:
        """Call once per frame with the set of space labels currently read
        as occupied. Returns {label: elapsed_seconds}, only for spaces whose
        clock has actually started (confirmed parked, not just occupied)."""
        now = now if now is not None else time.time()
        elapsed: dict[str, float | None] = {}

        for label in occupied_labels:
            s = self._state.get(label)
            if s is None:
                s = _SpaceState(label, first_occupied_at=now, last_occupied_at=now)
                self._state[label] = s
            else:
                s.last_occupied_at = now
                if s.started_at is None and now - s.first_occupied_at >= CONFIRM_OCCUPIED_SECONDS:
                    s.started_at = s.first_occupied_at
            elapsed[label] = (now - s.started_at) if s.started_at is not None else None

        stale = [
            label for label, s in self._state.items()
            if label not in occupied_labels and now - s.last_occupied_at > GRACE_PERIOD_SECONDS
        ]
        for label in stale:
            del self._state[label]

        self._save()
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
            item["last_occupied_at"] = now
            s = _SpaceState(**item)
            self._state[s.label] = s

    def _save(self) -> None:
        if not self._state_path:
            return
        with open(self._state_path, "w") as f:
            json.dump([asdict(s) for s in self._state.values()], f)


def format_duration(seconds: float) -> str:
    total = int(seconds)
    h, rem = divmod(total, 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"
