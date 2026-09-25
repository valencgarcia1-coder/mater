import SectionReveal from "./SectionReveal";

const TRACKS = [
  { id: "#12", status: "TRACKING" },
  { id: "#19", status: "PARKED" },
  { id: "#23", status: "MOVING" },
  { id: "#27", status: "PARKED" },
];

export default function DetectSection() {
  return (
    <SectionReveal className="mx-auto w-full max-w-6xl px-8 py-28 sm:px-12">
      <div className="grid gap-12 md:grid-cols-2 md:items-center">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-white/40">01 · DETECT</p>
          <h2 className="mt-4 font-serif text-5xl font-semibold text-white">See it.</h2>
          <p className="mt-5 max-w-sm text-white/60">
            Mater watches the environment and identifies vehicles automatically.
          </p>
        </div>
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
          <p className="font-mono text-xs tracking-wide text-white/40">42 VEHICLES DETECTED</p>
          <div className="mt-4 space-y-2">
            {TRACKS.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between border-b border-neutral-900 py-2 font-mono text-sm"
              >
                <span className="text-white/70">{t.id}</span>
                <span className="text-white/40">{t.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionReveal>
  );
}
