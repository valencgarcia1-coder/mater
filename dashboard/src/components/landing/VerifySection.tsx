import SectionReveal from "./SectionReveal";

const TIMELINE = [
  { time: "01:31:22", label: "VEHICLE DETECTED" },
  { time: "01:32:04", label: "VEHICLE STOPPED" },
  { time: "01:37:04", label: "VIOLATION CONFIRMED" },
];

export default function VerifySection() {
  return (
    <SectionReveal className="mx-auto w-full max-w-6xl px-8 py-28 sm:px-12">
      <div className="grid gap-12 md:grid-cols-2 md:items-center">
        <div className="order-2 rounded-2xl border border-neutral-800 bg-neutral-950 p-6 md:order-1">
          {TIMELINE.map((step, i) => (
            <div key={step.time}>
              <div className="flex items-baseline gap-3 font-mono text-sm">
                <span className="text-white/40">{step.time}</span>
                <span className="text-white/80">{step.label}</span>
              </div>
              {i < TIMELINE.length - 1 && (
                <div className="my-1.5 pl-1 text-white/20">↓</div>
              )}
            </div>
          ))}
        </div>
        <div className="order-1 md:order-2">
          <p className="text-xs font-medium tracking-[0.25em] text-white/40">02 · VERIFY</p>
          <h2 className="mt-4 font-serif text-5xl font-semibold text-white">Time it.</h2>
          <p className="mt-5 max-w-sm text-white/60">
            A vehicle isn&apos;t a tow simply because it&apos;s there. Mater understands location,
            movement, dwell time, and the parking rules configured for each zone.
          </p>
        </div>
      </div>
    </SectionReveal>
  );
}
