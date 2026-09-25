import type { SpacesStatus, SpaceState } from "@/lib/detector";
import SpaceCard from "./SpaceCard";

// Most-actionable first — a property manager scanning this should see
// tow-eligible spaces before empty ones, not in whatever order they were
// drawn in the editor.
const STATE_ORDER: SpaceState[] = [
  "tow_eligible",
  "violation",
  "parked",
  "arriving",
  "empty",
];

export default function SpaceGrid({ spaces }: { spaces: SpacesStatus }) {
  const labels = Object.keys(spaces).sort((a, b) => {
    const rank =
      STATE_ORDER.indexOf(spaces[a].state) -
      STATE_ORDER.indexOf(spaces[b].state);
    if (rank !== 0) return rank;
    return Number(a) - Number(b);
  });

  if (labels.length === 0) {
    return (
      <p className="text-sm font-light text-white/40">
        No spaces configured yet — number them at the detector&apos;s{" "}
        <code className="font-mono text-white/60">/editor</code> page.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
      {labels.map((label) => (
        <SpaceCard key={label} label={label} status={spaces[label]} />
      ))}
    </div>
  );
}
