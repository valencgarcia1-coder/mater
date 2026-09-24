import type { DetectorEvent } from "@/lib/detector";

const EVENT_COLORS: Record<string, string> = {
  EMPTY: "text-neutral-500",
  ARRIVING: "text-neutral-400",
  PARKED: "text-emerald-400",
  VIOLATION: "text-amber-400",
  TOW_ELIGIBLE: "text-red-400 font-semibold",
};

export default function EventLog({ events }: { events: DetectorEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-neutral-500">No events yet.</p>;
  }

  return (
    <div className="flex flex-col divide-y divide-neutral-900">
      {events.map((e, i) => (
        <div
          key={`${e.space}-${e.detected_at}-${i}`}
          className="flex items-center gap-3 py-1.5 text-xs"
        >
          <span className="font-mono text-neutral-500 w-16 shrink-0">
            {e.detected_at.slice(11)}
          </span>
          <span className="font-mono text-neutral-300 w-10 shrink-0">
            P{e.space}
          </span>
          <span
            className={`w-24 shrink-0 ${EVENT_COLORS[e.event] ?? "text-neutral-300"}`}
          >
            {e.event}
          </span>
          <span className="text-neutral-500">
            {e.stationary_duration !== null
              ? `${e.stationary_duration}s parked`
              : ""}
          </span>
        </div>
      ))}
    </div>
  );
}
