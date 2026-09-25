import type { DetectorStatus, SpacesStatus } from "@/lib/detector";

function CarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} className="h-4 w-4 text-white/40">
      <path d="M3 13l1.5-4.5A2 2 0 0 1 6.4 7h11.2a2 2 0 0 1 1.9 1.5L21 13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="3" y="13" width="18" height="5" rx="1.5" stroke="currentColor" />
      <circle cx="7.5" cy="18.5" r="1.5" stroke="currentColor" />
      <circle cx="16.5" cy="18.5" r="1.5" stroke="currentColor" />
    </svg>
  );
}
function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} className="h-4 w-4 text-white/40">
      <path d="M12 3 2 20h20L12 3Z" stroke="currentColor" strokeLinejoin="round" />
      <path d="M12 10v4M12 17h.01" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}
function ParkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} className="h-4 w-4 text-white/40">
      <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" />
      <path d="M9 16V8h3.2a2.4 2.4 0 0 1 0 4.8H9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PulseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} className="h-4 w-4 text-white/40">
      <path d="M3 12h4l2 7 4-14 2 7h6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Card({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <div className="flex flex-1 flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-mono text-[10px] uppercase tracking-wider text-white/40">{label}</span>
      </div>
      <div className="font-mono text-3xl text-white">{value}</div>
      <div className="font-mono text-[10px] uppercase tracking-wider text-white/30">{hint}</div>
    </div>
  );
}

export default function StatCards({
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
  const violations = (counts.violation ?? 0) + (counts.tow_eligible ?? 0);

  return (
    <div className="flex flex-wrap gap-4">
      <Card
        icon={<CarIcon />}
        label="Active Vehicles"
        value={status?.active_tracks ?? "—"}
        hint="in monitored area"
      />
      <Card
        icon={<AlertIcon />}
        label="Current Violations"
        value={violations}
        hint="awaiting review"
      />
      <Card
        icon={<ParkIcon />}
        label="Parked"
        value={counts.parked ?? 0}
        hint="stationary spaces"
      />
      <Card
        icon={<PulseIcon />}
        label="FPS"
        value={status ? status.fps_estimate.toFixed(1) : "—"}
        hint="detector throughput"
      />
    </div>
  );
}
