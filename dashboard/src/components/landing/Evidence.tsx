import SectionReveal from "./SectionReveal";

const FRAMES = [
  {
    src: "/landing/detect-frame.jpg",
    alt: "A real daytime camera frame from Brighton Ski Resort, with space occupancy detected and labeled",
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
    <SectionReveal className="mx-auto w-full max-w-6xl px-8 py-24 sm:px-12">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-white/40">Real footage</p>
      <h2 className="mt-4 max-w-2xl font-serif text-3xl font-semibold text-white sm:text-4xl">
        This is Brighton Ski Resort, running right now — not a mockup.
      </h2>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        {FRAMES.map((frame) => (
          <div key={frame.src} className="flex flex-col gap-3">
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
