import type { DetectorStatus, SpacesStatus } from "@/lib/detector";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-wider text-white/40">
        {label}
      </span>
      <span className="font-mono text-lg text-white">{value}</span>
    </div>
  );
}

export default function StatsBar({
  status,
  spaces,
}: {
  status: DetectorStatus | null;
  spaces: SpacesStatus;
}) {
  const counts = Object.values(spaces).reduce(
    (acc, s) => {
      acc[s.state] = (acc[s.state] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="flex flex-wrap gap-6 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
      <Stat label="Active tracks" value={status?.active_tracks ?? "—"} />
      <Stat
        label="FPS"
        value={status ? status.fps_estimate.toFixed(1) : "—"}
      />
      <Stat label="Parked" value={counts.parked ?? 0} />
      <Stat label="Violation" value={counts.violation ?? 0} />
      <Stat label="Tow eligible" value={counts.tow_eligible ?? 0} />
    </div>
  );
}
