import SectionReveal from "./SectionReveal";

const TRUST = [
  "Works with your existing cameras — no new hardware",
  "A person reviews every case before a tow",
  "91.7% accuracy in real-world evaluation",
];

// The first thing after the hero — answers the two objections that matter
// most before anything else: "do I need to buy cameras" and "will this
// falsely tow someone." Both are true differentiators buried nowhere else
// on the page otherwise.
export default function Intro() {
  return (
    <SectionReveal className="relative mx-auto w-full max-w-4xl px-8 pt-32 pb-20 text-center sm:px-12">
      <div
        aria-hidden="true"
        className="landing-glow pointer-events-none absolute left-1/2 top-0 -z-10 h-[420px] w-[900px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-emerald-500/10 blur-[120px]"
      />
      <h2
        data-reveal-item
        className="font-sans text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl"
      >
        Manual patrols miss violations. Automatic tows create liability.
        <span className="text-white/50"> Mater does neither.</span>
      </h2>

      <div className="mt-14 grid gap-8 border-t border-white/10 pt-10 sm:grid-cols-3">
        {TRUST.map((item) => (
          <div key={item} data-reveal-item className="flex flex-col items-center gap-3">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <p className="font-mono text-xs uppercase tracking-wider text-white/60">{item}</p>
          </div>
        ))}
      </div>
    </SectionReveal>
  );
}
