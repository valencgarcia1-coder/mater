import SectionReveal from "./SectionReveal";

const STEPS = ["DETECT", "VERIFY", "DISPATCH", "TOW"];

export default function FullLoopSection() {
  return (
    <SectionReveal className="mx-auto w-full max-w-4xl px-8 py-28 text-center sm:px-12">
      <h2 className="font-serif text-4xl font-semibold text-white sm:text-5xl">
        From detection to dispatch. Automatically.
      </h2>
      <div className="mt-14 flex flex-wrap items-center justify-center gap-3 sm:gap-5">
        {STEPS.map((step, i) => (
          <div key={step} className="flex items-center gap-3 sm:gap-5">
            <span className="font-mono text-sm tracking-[0.2em] text-white/70">{step}</span>
            {i < STEPS.length - 1 && <span className="text-white/25">→</span>}
          </div>
        ))}
      </div>
    </SectionReveal>
  );
}
