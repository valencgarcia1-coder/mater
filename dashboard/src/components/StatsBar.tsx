import type { DetectorStatus, SpacesStatus } from "@/lib/detector";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      <span className="font-mono text-lg text-neutral-100">{value}</span>
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
    <div className="flex flex-wrap gap-6 rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-3">
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
