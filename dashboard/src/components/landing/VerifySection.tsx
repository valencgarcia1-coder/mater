import SectionReveal from "./SectionReveal";

const TIMELINE = [
  { time: "01:31:22", label: "Vehicle detected" },
  { time: "01:32:04", label: "Vehicle stopped" },
  { time: "01:37:04", label: "Violation confirmed" },
];

export default function VerifySection() {
  return (
    <SectionReveal className="mx-auto w-full max-w-6xl px-8 py-28 sm:px-12">
      <div className="grid gap-12 md:grid-cols-2 md:items-center">
        <div className="order-2 relative overflow-hidden rounded-2xl border border-neutral-800 md:order-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/landing/verify-frame.jpg"
            alt="The same lot at night, with one space flagged as occupied while Mater tracks how long the vehicle has stayed"
            className="aspect-video w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-4 pb-3 pt-8">
            {TIMELINE.map((step) => (
              <div key={step.time} className="flex items-baseline gap-2.5 font-mono text-[11px]">
                <span className="text-white/40">{step.time}</span>
                <span className="text-white/80">{step.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="order-1 md:order-2">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-white/40">02 · VERIFY</p>
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
