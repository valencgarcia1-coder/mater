import type { DetectorEvent } from "@/lib/detector";

const DOT: Record<string, string> = {
  EMPTY: "bg-white/20",
  ARRIVING: "bg-white/40",
  PARKED: "bg-emerald-400",
  VIOLATION: "bg-amber-400",
  TOW_ELIGIBLE: "bg-red-400",
};

function timeOf(e: DetectorEvent) {
  return e.detected_at.slice(11, 16);
}

export default function ActivityPanel({ events }: { events: DetectorEvent[] }) {
  const violations = events
    .filter((e) => e.event === "VIOLATION" || e.event === "TOW_ELIGIBLE")
    .slice(0, 4);
  const recent = events.slice(0, 6);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="font-mono text-[11px] uppercase tracking-wider text-white/40">
          Recent Violations
        </h3>
        {violations.length === 0 ? (
          <p className="mt-3 text-sm font-light text-white/30">None right now.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-2.5">
            {violations.map((e, i) => (
              <div
                key={`${e.space}-${e.detected_at}-${i}`}
                className={`border-l-2 pl-3 ${
                  e.event === "TOW_ELIGIBLE" ? "border-red-500" : "border-amber-500"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-white">Space P{e.space}</span>
                  <span className="rounded-full bg-white/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white/50">
                    {e.event.replace("_", " ")}
                  </span>
                </div>
                <p className="mt-0.5 font-mono text-[11px] text-white/40">
                  {e.zone.replace("_", " ")}
                  {e.stationary_duration !== null ? ` · ${e.stationary_duration}s stationary` : ""}
                </p>
                <p className="font-mono text-[10px] text-white/25">{timeOf(e)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="font-mono text-[11px] uppercase tracking-wider text-white/40">
          Live Alerts
        </h3>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm font-light text-white/30">No activity yet.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {recent.map((e, i) => (
              <div
                key={`${e.space}-${e.detected_at}-${i}-alert`}
                className="flex items-start gap-2 font-mono text-[11px]"
              >
                <span className={`mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full ${DOT[e.event] ?? "bg-white/30"}`} />
                <span className="text-white/60">
                  Space P{e.space} {e.event.toLowerCase().replace("_", " ")}
                </span>
                <span className="ml-auto flex-shrink-0 text-white/25">{timeOf(e)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
