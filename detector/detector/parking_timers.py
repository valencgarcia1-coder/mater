"""Per-space state machine: EMPTY -> ARRIVING -> PARKED -> VIOLATION -> TOW_ELIGIBLE.

Anchored to the numbered parking space itself, not to a tracked vehicle or
a raw position on the ground — a parking space is fixed, human-defined
ground truth, and every tow-decision rule this system exists to support is
written per zone/space ("stationary in a restricted zone for 18 minutes"),
not per arbitrary vehicle. Matching "the same parked vehicle" across frames
by position needs a distance-threshold heuristic; "is this exact space
occupied" is already computed precisely via mask overlap (see spaces.py)
and needs no guessing.

Don't dispatch a tow just because a car appears in a space — that's exactly
the false-positive machine this state machine exists to prevent:

  EMPTY        no vehicle overlapping the space
  ARRIVING     occupied, but not yet held long enough to call it "parked"
               (a car driving through a marked spot isn't parked)
  PARKED       confirmed stationary, under the violation threshold
  VIOLATION    still parked past the violation threshold
  TOW_ELIGIBLE violation has held long enough to be actionable, not just a
               momentary reading

TOW_ELIGIBLE is as far as this goes. DISPATCHED would mean an actual job
went to an actual towing company's driver — there's no dispatch backend in
this codebase, so that state can't be implemented here without faking it;
it belongs to the separate dispatch system this detector feeds, not to a
detection/testing tool.

A space's clock only starts once it's been continuously occupied for
CONFIRM_OCCUPIED_SECONDS. It survives up to GRACE_PERIOD_SECONDS of reading
as unoccupied (a passing vehicle blocking the view, a missed frame) before
concluding the vehicle actually left, and the whole thing persists to disk
so a restart doesn't zero out a still-occupied space's clock. A space
already occupied the first time we ever see it has no knowable prior
duration, so — as intended — it starts from zero.

VIOLATION_AFTER_SECONDS / TOW_ELIGIBLE_AFTER_SECONDS currently apply to
every space uniformly, since spaces don't yet carry a per-space rule (a
"restricted zone" flag or time limit — the "zone" field from the vehicle
record note). Real deployments would gate VIOLATION on that per-space rule
instead of a single global threshold; this is the generic version.
"""

from __future__ import annotations

import json
import time
from dataclasses import asdict, dataclass

CONFIRM_OCCUPIED_SECONDS = 10  # how long continuous occupancy must hold before we call it "parked"
GRACE_PERIOD_SECONDS = 10  # how long a space can read empty before we call the vehicle gone
VIOLATION_AFTER_SECONDS = 60  # parked this long -> VIOLATION
TOW_ELIGIBLE_AFTER_SECONDS = 300  # violating this much longer on top -> TOW_ELIGIBLE


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


@dataclass
class _SpaceState:
    label: str
    first_occupied_at: float
    last_occupied_at: float
    started_at: float | None = None  # None until confirmed parked


def _classify(elapsed_since_parked: float | None) -> str:
    if elapsed_since_parked is None:
        return SpaceState.ARRIVING
    if elapsed_since_parked >= VIOLATION_AFTER_SECONDS + TOW_ELIGIBLE_AFTER_SECONDS:
        return SpaceState.TOW_ELIGIBLE
    if elapsed_since_parked >= VIOLATION_AFTER_SECONDS:
        return SpaceState.VIOLATION
    return SpaceState.PARKED


class ParkingTimers:
    def __init__(self, state_path: str | None = "parking_timers.json") -> None:
        self._state: dict[str, _SpaceState] = {}
        self._state_path = state_path
        self._load()

    def update(self, occupied_labels: set[str], now: float | None = None) -> dict[str, SpaceStatus]:
        """Call once per frame with the set of space labels currently read
        as occupied. Returns {label: SpaceStatus} for those spaces — a space
        not in the result is EMPTY."""
        now = now if now is not None else time.time()
        result: dict[str, SpaceStatus] = {}

        for label in occupied_labels:
            s = self._state.get(label)
            if s is None:
                s = _SpaceState(label, first_occupied_at=now, last_occupied_at=now)
                self._state[label] = s
            else:
                s.last_occupied_at = now
                if s.started_at is None and now - s.first_occupied_at >= CONFIRM_OCCUPIED_SECONDS:
                    s.started_at = s.first_occupied_at
            elapsed = (now - s.started_at) if s.started_at is not None else None
            result[label] = SpaceStatus(state=_classify(elapsed), elapsed=elapsed)

        stale = [
            label for label, s in self._state.items()
            if label not in occupied_labels and now - s.last_occupied_at > GRACE_PERIOD_SECONDS
        ]
        for label in stale:
            del self._state[label]

        self._save()
        return result

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
