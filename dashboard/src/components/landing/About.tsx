import SectionReveal from "./SectionReveal";
import RevealText from "./RevealText";

export default function About() {
  return (
    <SectionReveal id="about" className="relative isolate mx-auto w-full max-w-3xl px-8 py-28 text-center sm:px-12">
      <div
        aria-hidden="true"
        data-reveal-item
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[380px] w-[760px] -translate-x-1/2 -translate-y-1/2"
      >
        <div
          className="landing-glow h-full w-full rounded-full bg-sky-400/15 blur-[95px]"
          style={{ animationDelay: "-10s" }}
        />
      </div>
      <p data-reveal-item className="font-mono text-xs uppercase tracking-[0.25em] text-white/40">
        About
      </p>
      <h2 className="mt-4 font-sans text-3xl font-semibold leading-[1.15] tracking-tight text-white sm:text-4xl">
        <RevealText text="We think enforcement shouldn't require someone walking the lot." />
      </h2>
      <p data-reveal-item className="mx-auto mt-5 max-w-xl text-white/60">
        Mater started as a way to watch one parking lot properly — every space, every hour, without
        paying someone to patrol it. It&apos;s built to run on cameras that already exist, review
        itself before anything gets towed, and get out of the way otherwise.
      </p>
    </SectionReveal>
  );
}
