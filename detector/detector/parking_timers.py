"""Per-space state machine: EMPTY -> ARRIVING -> PARKED -> VIOLATION -> TOW_ELIGIBLE.

Anchored to the numbered parking space itself, not to a tracked vehicle or
a raw position on the ground — a parking space is fixed, human-defined
ground truth. This module also owns the CV/business-rule split explicitly:
this file *only* asks "how long has this space been occupied, under which
zone's rule" — it does not decide detection thresholds, tracking, or
occupancy geometry (that's pipeline.py / spaces.py). Zone rules live in one
place (ZONE_RULES) precisely so they can change without touching the vision
code at all.

  EMPTY        no vehicle overlapping the space
  ARRIVING     occupied, but not yet held long enough to call it "parked"
               (a car driving through a marked spot isn't parked) — this is
               also the ACTIVE -> TEMPORARILY_LOST -> REIDENTIFIED grace
               window in reverse: a space reading briefly unoccupied
               (occlusion, a missed frame) doesn't reset the clock either,
               see GRACE_PERIOD_SECONDS below.
  PARKED       confirmed stationary, under the zone's violation threshold
  VIOLATION    parked past the zone's violation threshold
  TOW_ELIGIBLE parked past the zone's tow threshold

TOW_ELIGIBLE is as far as this goes. DISPATCHED would mean an actual job
went to an actual towing company's driver — there's no dispatch backend in
this codebase, so that state can't be implemented here without faking it.
What DOES belong here is emitting the event a dispatch system would
consume on every real state transition (see events.py) — not calling a
tow endpoint directly, since the rule that decides "who to notify and how"
is a dispatch-system concern, not this one's.

A space's clock only starts once it's been continuously occupied for its
zone's confirm_parked seconds. It survives up to GRACE_PERIOD_SECONDS of
reading as unoccupied before concluding the vehicle actually left, and the
whole thing persists to disk so a restart doesn't zero out a still-occupied
space's clock. A space already occupied the first time we ever see it has
no knowable prior duration, so — as intended — it starts from zero.
"""

from __future__ import annotations

import json
import time
from dataclasses import asdict, dataclass

from detector.events import EventLog

GRACE_PERIOD_SECONDS = 10  # how long a space can read empty before we call the vehicle gone

# Per-zone timing rules, looked up by SpaceRegion.zone. Changing tow policy
# for a zone type is an edit here, not a change to any vision code —
# that's the entire point of splitting these into two systems.
ZONE_RULES = {
    "standard": {"confirm_parked": 10, "violation_after": 60, "tow_after": 360},
    "fire_lane": {"confirm_parked": 5, "violation_after": 120, "tow_after": 300},
    "handicap": {"confirm_parked": 10, "violation_after": 60, "tow_after": 180},
    "loading_zone": {"confirm_parked": 15, "violation_after": 600, "tow_after": 1200},
}


class SpaceState:
    EMPTY = "empty"
    ARRIVING = "arriving"
    PARKED = "parked"
    VIOLATION = "violation"
    TOW_ELIGIBLE = "tow_eligible"


@dataclass
class SpaceStatus:
    state: str
    elapsed: float | None  # seconds since confirmed parked; None while arriving
    zone: str


@dataclass
class _SpaceState:
    label: str
    zone: str
    first_occupied_at: float
    last_occupied_at: float
    started_at: float | None = None  # None until confirmed parked


def _classify(elapsed_since_parked: float | None, rules: dict) -> str:
    if elapsed_since_parked is None:
        return SpaceState.ARRIVING
    if elapsed_since_parked >= rules["tow_after"]:
        return SpaceState.TOW_ELIGIBLE
    if elapsed_since_parked >= rules["violation_after"]:
        return SpaceState.VIOLATION
    return SpaceState.PARKED


class ParkingTimers:
    def __init__(self, state_path: str | None = "parking_timers.json", events_path: str | None = "events.jsonl") -> None:
        self._state: dict[str, _SpaceState] = {}
        self._state_path = state_path
        self._last_emitted_state: dict[str, str] = {}
        self._events = EventLog(path=events_path)
        self._load()

    def update(self, occupied: dict[str, str], now: float | None = None) -> dict[str, SpaceStatus]:
        """Call once per frame with {label: zone} for every space currently
        read as occupied. Returns {label: SpaceStatus} for those spaces — a
        space not in the result is EMPTY. Emits an event on every real state
        transition (not every frame a state merely continues)."""
        now = now if now is not None else time.time()
        result: dict[str, SpaceStatus] = {}

        for label, zone in occupied.items():
            rules = ZONE_RULES.get(zone, ZONE_RULES["standard"])
            s = self._state.get(label)
            if s is None:
                s = _SpaceState(label, zone=zone, first_occupied_at=now, last_occupied_at=now)
                self._state[label] = s
            else:
                s.zone = zone
                s.last_occupied_at = now
                if s.started_at is None and now - s.first_occupied_at >= rules["confirm_parked"]:
                    s.started_at = s.first_occupied_at
            elapsed = (now - s.started_at) if s.started_at is not None else None
            state = _classify(elapsed, rules)
            result[label] = SpaceStatus(state=state, elapsed=elapsed, zone=zone)
            self._maybe_emit(label, zone, state, elapsed)

        stale = [
            label for label, s in self._state.items()
            if label not in occupied and now - s.last_occupied_at > GRACE_PERIOD_SECONDS
        ]
        for label in stale:
            self._maybe_emit(label, self._state[label].zone, SpaceState.EMPTY, None)
            del self._state[label]

        self._save()
        return result

    def _maybe_emit(self, label: str, zone: str, state: str, elapsed: float | None) -> None:
        if self._last_emitted_state.get(label) == state:
            return
        self._last_emitted_state[label] = state
        self._events.emit(space=label, zone=zone, state=state, elapsed=elapsed)

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
            item.setdefault("zone", "standard")  # older state files predate zones
            s = _SpaceState(**item)
            self._state[s.label] = s
            self._last_emitted_state[s.label] = "parked" if s.started_at is not None else "arriving"

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
