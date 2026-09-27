import SectionReveal from "./SectionReveal";

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
        <div className="relative overflow-hidden rounded-2xl border border-neutral-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/landing/detect-frame.jpg"
            alt="A real camera frame from a Mater-monitored lot, with space occupancy detected and labeled"
            className="aspect-video w-full object-cover"
          />
          <div className="absolute inset-x-0 top-0 flex items-center gap-1.5 bg-gradient-to-b from-black/70 to-transparent px-4 py-3">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-white/70">
              Live detection — real footage
            </span>
          </div>
        </div>
      </div>
    </SectionReveal>
  );
}
