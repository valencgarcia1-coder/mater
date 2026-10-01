import SectionReveal from "./SectionReveal";
import RevealText from "./RevealText";
import EvidencePin from "./EvidencePin";

// Real evidence, presented plainly: no bordered app-chrome, no crossfading —
// just the actual frames from a live property, large enough to read.
export default function Evidence() {
  return (
    <SectionReveal id="evidence" className="relative isolate mx-auto w-full max-w-6xl px-8 py-24 sm:px-12">
      <div
        aria-hidden="true"
        data-reveal-item
        className="pointer-events-none absolute left-0 top-0 -z-10 h-[320px] w-[560px] -translate-y-1/3"
      >
        <div
          className="landing-glow h-full w-full rounded-full bg-violet-400/12 blur-[90px]"
          style={{ animationDelay: "-3s" }}
        />
      </div>
      <p data-reveal-item className="font-mono text-xs uppercase tracking-[0.25em] text-white/40">
        Real footage
      </p>
      <h2 className="mt-4 max-w-2xl font-sans text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl">
        <RevealText text="This is a live property, running right now — not a mockup." />
      </h2>

      <div className="mt-12">
        <EvidencePin
          beforeSrc="/landing/detect-frame.jpg"
          beforeAlt="A real daytime camera frame from a live property, with space occupancy detected and labeled"
          beforeLabel="Daytime — every space labeled"
          afterSrc="/landing/verify-frame.jpg"
          afterAlt="The same lot at night, with one space flagged as occupied past its allowed time"
          afterLabel="Night — a violation held long enough to confirm"
        />
      </div>
    </SectionReveal>
  );
}
