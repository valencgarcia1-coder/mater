import SectionReveal from "./SectionReveal";
import GetStartedButton from "./GetStartedButton";
import RevealText from "./RevealText";

export default function CTASection() {
  return (
    <SectionReveal className="relative isolate mx-auto w-full max-w-3xl px-8 py-32 text-center sm:px-12" id="contact">
      <div
        aria-hidden="true"
        data-reveal-item
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[420px] w-[820px] -translate-x-1/2 -translate-y-1/2"
      >
        <div
          className="landing-glow h-full w-full rounded-full bg-emerald-400/15 blur-[100px]"
          style={{ animationDelay: "-2s" }}
        />
      </div>
      <h2 className="font-sans text-5xl font-semibold leading-[1.1] tracking-tight text-white sm:text-6xl">
        <RevealText text="Let the lot watch itself." />
      </h2>
      <p data-reveal-item className="mt-5 text-white/60">
        Mater automates the work between detection and dispatch.
      </p>
      <div data-reveal-item className="mt-9 flex justify-center">
        <GetStartedButton className="w-fit font-semibold" />
      </div>
    </SectionReveal>
  );
}
