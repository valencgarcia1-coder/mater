"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import RevealText from "./RevealText";
import ProgressTrack from "./ProgressTrack";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const ICON_PROPS = { viewBox: "0 0 24 24", fill: "none", strokeWidth: 1.6, className: "h-5 w-5" } as const;

const STEPS = [
  {
    label: "Detect",
    desc: "Sees every vehicle on your existing camera feed.",
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="3" y="6" width="18" height="14" rx="2" stroke="currentColor" />
        <circle cx="12" cy="13" r="3.5" stroke="currentColor" />
        <path d="M8 6 9.5 3.5h5L16 6" stroke="currentColor" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Verify",
    desc: "Confirms it's a real, sustained violation.",
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" />
        <path d="M12 7.5V12l3 2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Review",
    desc: "A person signs off before anything happens.",
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="12" cy="8.5" r="3.2" stroke="currentColor" />
        <path d="M5 20c0-3.6 3.1-6.5 7-6.5s7 2.9 7 6.5" stroke="currentColor" strokeLinecap="round" />
        <path d="m9 20 2 2 4-4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Dispatch",
    desc: "Routes the confirmed case to the nearest truck.",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M3 16V7a1 1 0 0 1 1-1h9v10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        <path
          d="M13 10h4.4a1 1 0 0 1 .9.55L20 14v2h-2"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="7.5" cy="17" r="1.8" stroke="currentColor" />
        <circle cx="16.5" cy="17" r="1.8" stroke="currentColor" />
      </svg>
    ),
  },
];

const SHRINK_TO = 44; // video column's flex-basis (%) once fully shrunk

/**
 * The real hero footage, reused here: it locks in place and shrinks into a
 * small dashboard-framed clip while the four-step pipeline fills in beside
 * it, in the same continuous scroll — proof and explanation side by side,
 * instead of a static card grid. Pinned like Evidence, with its own
 * continuous scrub (not the generic PinnedSection stagger), since the video
 * needs fine-grained control, not a one-shot reveal.
 */
export default function HowItWorks() {
  const outerRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const videoColRef = useRef<HTMLDivElement>(null);
  const stepsColRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const chromeRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const outer = outerRef.current;
    const sticky = stickyRef.current;
    const videoCol = videoColRef.current;
    const stepsCol = stepsColRef.current;
    const frame = frameRef.current;
    const chrome = chromeRef.current;
    if (!outer || !sticky || !videoCol || !stepsCol || !frame || !chrome) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stepEls = stepRefs.current.filter((el): el is HTMLDivElement => el !== null);

    function render(p: number) {
      const isNarrow = window.innerWidth < 1024;
      const shrinkP = Math.min(1, p / 0.4);
      if (!isNarrow && videoCol && stepsCol) {
        videoCol.style.flexBasis = `${100 - shrinkP * (100 - SHRINK_TO)}%`;
        stepsCol.style.flexBasis = `${shrinkP * (100 - SHRINK_TO)}%`;
      }
      if (stepsCol) stepsCol.style.opacity = String(shrinkP);
      if (chrome) chrome.style.opacity = String(shrinkP);
      if (frame) frame.style.borderRadius = `${shrinkP * 14}px`;

      const stepsP = Math.max(0, (p - 0.4) / 0.6);
      stepEls.forEach((el, i) => {
        const start = i / stepEls.length;
        const end = (i + 1) / stepEls.length;
        const local = Math.min(1, Math.max(0, (stepsP - start) / (end - start)));
        el.style.opacity = String(local);
        el.style.transform = `translateY(${14 * (1 - local)}px)`;
      });
    }

    // Below the lg breakpoint, video+steps stack instead of sitting
    // side by side — there's no "shrink sideways" to animate, and pinning a
    // stacked column for a fixed-height screen is exactly how content gets
    // clipped. Render it fully settled, in normal scroll, instead.
    if (prefersReducedMotion || narrow) {
      render(1);
      return;
    }

    render(0);

    const st = ScrollTrigger.create({
      trigger: outer,
      start: "top top",
      end: "bottom bottom",
      pin: sticky,
      pinSpacing: true,
      scrub: 0.4,
      onUpdate: (self) => render(self.progress),
    });

    return () => {
      st.kill();
    };
  }, [narrow]);

  return (
    <div ref={outerRef} className="relative" style={{ height: narrow ? "auto" : "280vh" }}>
      <div
        ref={stickyRef}
        id="how-it-works"
        className={
          narrow
            ? "relative isolate w-full px-8 py-20 sm:px-12"
            : "relative isolate flex h-screen w-full flex-col justify-center overflow-hidden px-8 sm:px-12"
        }
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-[8%] -z-10 h-[340px] w-[700px] -translate-x-1/2"
        >
          <div className="landing-glow h-full w-full rounded-full bg-emerald-400/20 blur-[95px]" />
        </div>

        <div className="mx-auto w-full max-w-6xl">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-white/55">How it works</p>
          <h2 className="mt-3 max-w-2xl font-sans text-3xl font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl">
            <RevealText text="From a parked car to a dispatched tow — with a person deciding at every step." />
          </h2>

          <div className="mt-6">
            <ProgressTrack sectionRef={outerRef} />
          </div>

          <div className="mt-8 flex flex-col items-center gap-8 lg:flex-row">
            <div ref={videoColRef} className="min-w-0" style={{ flexBasis: narrow ? "auto" : "100%" }}>
              <div
                ref={frameRef}
                className="relative w-full overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
                style={{ aspectRatio: "16 / 9" }}
              >
                <div
                  ref={chromeRef}
                  className="absolute inset-x-0 top-0 z-10 flex h-8 items-center gap-1.5 bg-black/90 px-3"
                  style={{ opacity: narrow ? 1 : 0 }}
                >
                  <span className="h-2 w-2 rounded-full bg-white/20" />
                  <span className="h-2 w-2 rounded-full bg-white/20" />
                  <span className="h-2 w-2 rounded-full bg-white/20" />
                  <span className="ml-1.5 font-mono text-[10px] tracking-wider text-white/40">mater.live — overview</span>
                </div>
                <video
                  className="h-full w-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                  poster="/hero-poster.jpg"
                  src="/hero.mp4"
                />
              </div>
            </div>

            <div
              ref={stepsColRef}
              className="min-w-0"
              style={{ flexBasis: narrow ? "auto" : "0%", opacity: narrow ? 1 : 0 }}
            >
              <div className="flex flex-col gap-5 lg:w-[360px]">
                {STEPS.map((step, i) => (
                  <div
                    key={step.label}
                    ref={(el) => {
                      stepRefs.current[i] = el;
                    }}
                    className="flex gap-3.5"
                    style={narrow ? undefined : { opacity: 0, transform: "translateY(14px)" }}
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/[0.06] text-emerald-400">
                      {step.icon}
                    </div>
                    <div>
                      <h3 className="font-mono text-xs uppercase tracking-wider text-white">{step.label}</h3>
                      <p className="mt-1 text-sm text-white/65">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
