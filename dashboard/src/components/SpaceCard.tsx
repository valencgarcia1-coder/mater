import type { SpaceStatus } from "@/lib/detector";

export const STATE_STYLES: Record<
  SpaceStatus["state"],
  { label: string; classes: string }
> = {
  empty: {
    label: "Available",
    classes: "border-white/10 bg-white/[0.03] text-white/40",
  },
  arriving: {
    label: "Arriving",
    classes: "border-white/20 bg-white/[0.05] text-white/70",
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

export function formatDuration(seconds: number): string {
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
  selected,
  onSelect,
}: {
  label: string;
  status: SpaceStatus;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const style = STATE_STYLES[status.state];
  return (
    <div
      onClick={onSelect}
      className={`rounded-xl border px-3 py-2.5 flex flex-col gap-0.5 transition-colors ${style.classes} ${
        onSelect ? "cursor-pointer" : ""
      } ${selected ? "ring-2 ring-white/60" : ""}`}
    >
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-sm">P{label}</span>
        {status.zone !== "standard" && (
          <span className="font-mono text-[10px] uppercase tracking-wider opacity-70">
            {status.zone.replace("_", " ")}
          </span>
        )}
      </div>
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[11px] uppercase tracking-wide">{style.label}</span>
        {status.elapsed !== null && (
          <span className="font-mono text-xs opacity-80">
            {formatDuration(status.elapsed)}
          </span>
        )}
      </div>
    </div>
  );
}
