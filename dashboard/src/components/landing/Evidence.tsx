import SectionReveal from "./SectionReveal";

const FRAMES = [
  {
    src: "/landing/detect-frame.jpg",
    alt: "A real daytime camera frame from a live property, with space occupancy detected and labeled",
    caption: "Daytime — full lot, every space labeled",
  },
  {
    src: "/landing/verify-frame.jpg",
    alt: "The same lot at night, with one space flagged as occupied past its allowed time",
    caption: "Night — a violation held long enough to confirm",
  },
];

// Real evidence, presented plainly: no bordered app-chrome, no crossfading —
// just the actual frames from a live property, large enough to read.
export default function Evidence() {
  return (
    <SectionReveal className="relative mx-auto w-full max-w-6xl px-8 py-24 sm:px-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-0 bottom-0 -z-10 h-[360px] w-[600px] translate-y-1/4"
      >
        <div
          className="landing-glow h-full w-full rounded-full bg-emerald-500/10 blur-[110px]"
          style={{ animationDelay: "-3s" }}
        />
      </div>
      <p data-reveal-item className="font-mono text-xs uppercase tracking-[0.25em] text-white/40">
        Real footage
      </p>
      <h2
        data-reveal-item
        className="mt-4 max-w-2xl font-sans text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl"
      >
        This is a live property, running right now — not a mockup.
      </h2>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        {FRAMES.map((frame) => (
          <div key={frame.src} data-reveal-item className="flex flex-col gap-3">
            <div className="overflow-hidden rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={frame.src} alt={frame.alt} className="aspect-video w-full object-cover" />
            </div>
            <p className="font-mono text-xs uppercase tracking-wider text-white/40">{frame.caption}</p>
          </div>
        ))}
      </div>
    </SectionReveal>
  );
}
