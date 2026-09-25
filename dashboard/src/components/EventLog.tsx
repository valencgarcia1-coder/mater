import type { DetectorEvent } from "@/lib/detector";

const EVENT_COLORS: Record<string, string> = {
  EMPTY: "text-white/40",
  ARRIVING: "text-white/60",
  PARKED: "text-emerald-400",
  VIOLATION: "text-amber-400",
  TOW_ELIGIBLE: "text-red-400 font-medium",
};

export default function EventLog({ events }: { events: DetectorEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm font-light text-white/40">No events yet.</p>;
  }

  return (
    <div className="flex flex-col divide-y divide-white/10">
      {events.map((e, i) => (
        <div
          key={`${e.space}-${e.detected_at}-${i}`}
          className="flex items-center gap-3 py-1.5 font-mono text-xs"
        >
          <span className="text-white/40 w-16 shrink-0">
            {e.detected_at.slice(11)}
          </span>
          <span className="text-white/70 w-10 shrink-0">
            P{e.space}
          </span>
          <span
            className={`w-24 shrink-0 uppercase tracking-wide ${EVENT_COLORS[e.event] ?? "text-white/70"}`}
          >
            {e.event}
          </span>
          <span className="text-white/40">
            {e.stationary_duration !== null
              ? `${e.stationary_duration}s parked`
              : ""}
          </span>
        </div>
      ))}
    </div>
  );
}
