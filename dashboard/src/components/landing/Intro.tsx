import PinnedSection from "./PinnedSection";
import RevealText from "./RevealText";
import Counter from "./Counter";

const TRUST = [
  { text: "Works with your existing cameras — no new hardware" },
  { text: "A person reviews every case before a tow" },
  { stat: true as const },
];

// The first thing after the hero — answers the two objections that matter
// most before anything else: "do I need to buy cameras" and "will this
// falsely tow someone." Both are true differentiators buried nowhere else
// on the page otherwise.
export default function Intro() {
  return (
    <PinnedSection
      runwayVh={150}
      className="relative isolate mx-auto w-full max-w-4xl px-8 pt-32 pb-20 text-center sm:px-12"
    >
      <div
        aria-hidden="true"
        data-reveal-item
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[420px] w-[900px] -translate-x-1/2 -translate-y-1/3"
      >
        <div className="landing-glow h-full w-full rounded-full bg-emerald-400/15 blur-[95px]" />
      </div>
      <h2 className="font-sans text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl">
        <RevealText scrubbed text="Manual patrols miss violations. Automatic tows create liability." />
        <br className="hidden sm:block" />
        <RevealText scrubbed text="Mater does neither." className="text-white/50" />
      </h2>

      <div className="mt-14 grid gap-8 border-t border-white/10 pt-10 sm:grid-cols-3">
        {TRUST.map((item, i) => (
          <div key={i} data-reveal-item className="flex flex-col items-center gap-3">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {item.stat ? (
              <p className="font-mono text-xs uppercase tracking-wider text-white/60">
                <Counter to={91.7} decimals={1} suffix="%" className="text-white" /> accuracy in real-world evaluation
              </p>
            ) : (
              <p className="font-mono text-xs uppercase tracking-wider text-white/60">{item.text}</p>
            )}
          </div>
        ))}
      </div>
    </PinnedSection>
  );
}
