import type { SpaceStatus } from "@/lib/detector";

const STATE_STYLES: Record<
  SpaceStatus["state"],
  { label: string; classes: string }
> = {
  empty: {
    label: "Available",
    classes: "border-neutral-800 bg-neutral-950 text-neutral-600",
  },
  arriving: {
    label: "Arriving",
    classes: "border-neutral-600 bg-neutral-900 text-neutral-300",
  },
  parked: {
    label: "Parked",
    classes: "border-emerald-800 bg-emerald-950/40 text-emerald-400",
  },
  violation: {
    label: "Violation",
    classes: "border-amber-700 bg-amber-950/40 text-amber-400",
  },
  tow_eligible: {
    label: "Tow eligible",
    classes: "border-red-700 bg-red-950/50 text-red-400 animate-pulse",
  },
};

function formatDuration(seconds: number): string {
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default function SpaceCard({
  label,
  status,
}: {
  label: string;
  status: SpaceStatus;
}) {
  const style = STATE_STYLES[status.state];
  return (
    <div
      className={`rounded-lg border px-3 py-2.5 flex flex-col gap-0.5 transition-colors ${style.classes}`}
    >
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-sm font-medium">P{label}</span>
        {status.zone !== "standard" && (
          <span className="text-[10px] uppercase tracking-wide opacity-70">
            {status.zone.replace("_", " ")}
          </span>
        )}
      </div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs">{style.label}</span>
        {status.elapsed !== null && (
          <span className="font-mono text-xs opacity-80">
            {formatDuration(status.elapsed)}
          </span>
        )}
      </div>
    </div>
  );
}
