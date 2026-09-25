import SectionReveal from "./SectionReveal";

export default function DispatchSection() {
  return (
    <SectionReveal className="mx-auto w-full max-w-6xl px-8 py-28 sm:px-12">
      <div className="grid gap-12 md:grid-cols-2 md:items-center">
        <div>
          <p className="text-xs font-medium tracking-[0.25em] text-white/40">03 · DISPATCH</p>
          <h2 className="mt-4 font-serif text-5xl font-semibold text-white">Send it.</h2>
          <p className="mt-5 max-w-sm text-white/60">
            When a tow is needed, Mater turns the event into a job.
          </p>
        </div>
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 font-mono text-sm">
          <p className="text-white/40">TOW REQUEST</p>
          <div className="mt-3 space-y-1 text-white/80">
            <p>Vehicle #23</p>
            <p>Parking Lot A</p>
            <p className="text-red-400/80">Violation confirmed</p>
          </div>
          <div className="my-4 text-white/20">↓</div>
          <p className="text-white/40">TOW #14</p>
          <div className="mt-3 space-y-1 text-white/80">
            <p>2.1 mi away</p>
            <p>ETA 6 min</p>
          </div>
          <div className="mt-5 inline-block rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs tracking-wide text-emerald-400">
            DISPATCHED
          </div>
        </div>
      </div>
    </SectionReveal>
  );
}
