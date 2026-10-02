"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import HeroVisual from "./HeroVisual";
import RotatingWord from "./RotatingWord";
import GetStartedButton from "./GetStartedButton";

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

const SHRINK_TO = 62; // video column's flex-basis (%) once fully shrunk — stays a decent size

/**
 * One continuous sequence, not two separate moments: the real hero video
 * plays full-bleed, then — same scroll, same video, no section boundary in
 * between — the headline fades, the video shrinks into a small framed clip,
 * and the four-step pipeline fills in beside it. "How it works" used to be
 * its own section further down the page with a second copy of this video;
 * now it's the second half of this one pinned block.
 *
 * Below the lg breakpoint there's no pin (a stacked column pinned to a
 * fixed-height screen just clips) — it renders as the plain hero, then the
 * steps in normal flow underneath, no shrink animation.
 */
export default function Hero() {
  const outerRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);
  const tintRef = useRef<HTMLDivElement>(null);
  const videoColRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const chromeRef = useRef<HTMLDivElement>(null);
  const stepsColRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const stRef = useRef<ScrollTrigger | null>(null);

  // narrow must start false on both server and client's first render — same
  // value either side, or React throws a hydration mismatch. The real value
  // (which can differ on an actually-narrow device) is only known after
  // mount, so it's applied in an effect, gated by `checked` so the pin
  // (below) never gets created before the real value is in — see that
  // effect's comment for why a create-then-immediately-unmount is a crash.
  const [narrow, setNarrow] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => {
      // Kill the pin synchronously, before the state change below can cause
      // React to unmount the pinned subtree — see the note above.
      stRef.current?.kill();
      stRef.current = null;
      setNarrow(mq.matches);
      setChecked(true);
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    // Wait for the real narrow value before ever creating the pin — on the
    // very first mount `narrow` is still the SSR-matching `false` default,
    // even on an actually-narrow device. Creating the pin on that stale
    // value just to tear it down a tick later (once `checked` flips) is the
    // same unmount-before-GSAP-unwraps crash this whole effect exists to
    // avoid.
    if (!checked || narrow) return;
    const outer = outerRef.current;
    const sticky = stickyRef.current;
    const row = rowRef.current;
    const headline = headlineRef.current;
    const tint = tintRef.current;
    const videoCol = videoColRef.current;
    const frame = frameRef.current;
    const chrome = chromeRef.current;
    const stepsCol = stepsColRef.current;
    if (!outer || !sticky || !row || !headline || !tint || !videoCol || !frame || !chrome || !stepsCol) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stepEls = stepRefs.current.filter((el): el is HTMLDivElement => el !== null);

    const render = (p: number) => {
      const headlineP = Math.min(1, p / 0.18);
      headline.style.opacity = String(1 - headlineP);
      headline.style.transform = `translateY(${-24 * headlineP}px)`;
      tint.style.opacity = String(1 - headlineP);

      const shrinkP = Math.min(1, Math.max(0, (p - 0.12) / 0.33));
      // Full-bleed at rest, same as the original hero — page margin only
      // appears once the split starts, instead of pinching the video at
      // rest with padding it never used to have.
      const pad = shrinkP * 48;
      row.style.paddingLeft = `${pad}px`;
      row.style.paddingRight = `${pad}px`;
      videoCol.style.flexBasis = `${100 - shrinkP * (100 - SHRINK_TO)}%`;
      stepsCol.style.flexBasis = `${shrinkP * (100 - SHRINK_TO)}%`;
      stepsCol.style.opacity = String(shrinkP);
      chrome.style.opacity = String(shrinkP);
      frame.style.borderRadius = `${shrinkP * 14}px`;

      const stepsP = Math.max(0, (p - 0.5) / 0.5);
      stepEls.forEach((el, i) => {
        const start = i / stepEls.length;
        const end = (i + 1) / stepEls.length;
        const local = Math.min(1, Math.max(0, (stepsP - start) / (end - start)));
        el.style.opacity = String(local);
        el.style.transform = `translateY(${14 * (1 - local)}px)`;
      });
    };

    if (prefersReducedMotion) {
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
    stRef.current = st;

    // ScrollTrigger's pin wraps `sticky` in a new spacer element, which
    // reparents everything inside it — including the <video> — and browsers
    // pause a video the moment it's reparented, autoplay or not. The
    // reparenting itself happens on the next frame, not synchronously inside
    // .create(), so resuming playback has to wait a frame too or it just
    // gets paused again right after.
    const videoEl = frame.querySelector("video");
    const resumeId = requestAnimationFrame(() => {
      videoEl?.play().catch(() => {});
    });
    // Belt and suspenders: a later ScrollTrigger.refresh() (window resize,
    // font load, etc.) can re-trigger the same reparent-and-pause. If it's
    // ever paused and nothing in this component asked for that, just resume.
    const onPause = () => {
      videoEl?.play().catch(() => {});
    };
    videoEl?.addEventListener("pause", onPause);

    return () => {
      cancelAnimationFrame(resumeId);
      videoEl?.removeEventListener("pause", onPause);
      st.kill();
      if (stRef.current === st) stRef.current = null;
    };
  }, [narrow, checked]);

  if (narrow) {
    return (
      <div id="how-it-works">
        <section className="relative h-screen min-h-[720px] w-full overflow-hidden bg-black">
          <HeroVisual />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/25 to-black/55" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/25 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-b from-transparent to-black sm:h-80" />
          <div className="relative z-20 flex h-full flex-col justify-center px-10 sm:px-16">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-white/60">
              AI-Powered Towing Infrastructure
            </p>
            <h1 className="mt-6 font-sans text-6xl font-normal leading-[1.08] tracking-tight text-white sm:text-7xl">
              Towing should be
              <br />
              <RotatingWord />
            </h1>
            <p className="mt-8 max-w-sm text-base font-light text-white/60">
              Mater automatically detects vehicles that need to be towed and dispatches the nearest
              available truck.
            </p>
            <GetStartedButton className="mt-10 w-fit" />
          </div>
        </section>

        <div className="bg-[#0a0a0c] px-8 py-20 sm:px-12">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-white/55">How it works</p>
          <h2 className="mt-3 max-w-2xl font-sans text-3xl font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl">
            From a parked car to a dispatched tow — with a person deciding at every step.
          </h2>
          <div className="relative mt-8 w-full overflow-hidden rounded-2xl" style={{ aspectRatio: "16 / 9" }}>
            <HeroVisual />
          </div>
          <div className="mt-8 flex flex-col gap-5">
            {STEPS.map((step) => (
              <div key={step.label} className="flex gap-3.5">
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
    );
  }

  return (
    <div ref={outerRef} className="relative" style={{ height: "320vh" }}>
      <div
        ref={stickyRef}
        id="how-it-works"
        className="relative isolate flex h-screen w-full flex-col justify-center overflow-hidden bg-black"
      >
        <div ref={rowRef} className="flex h-full w-full items-center gap-10">
          <div ref={videoColRef} className="relative flex h-full min-w-0 items-center" style={{ flexBasis: "100%" }}>
            <div ref={frameRef} className="relative w-full overflow-hidden" style={{ height: "100%" }}>
              <HeroVisual />
              <div
                ref={tintRef}
                className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.4),rgba(0,0,0,0.25)_50%,rgba(0,0,0,0.55)),linear-gradient(to_right,rgba(0,0,0,0.75),rgba(0,0,0,0.25)_50%,transparent)]"
              />
              <div
                ref={chromeRef}
                className="absolute inset-x-0 top-0 z-10 flex h-8 items-center gap-1.5 bg-black/90 px-3 opacity-0"
              >
                <span className="h-2 w-2 rounded-full bg-white/20" />
                <span className="h-2 w-2 rounded-full bg-white/20" />
                <span className="h-2 w-2 rounded-full bg-white/20" />
                <span className="ml-1.5 font-mono text-[10px] tracking-wider text-white/40">
                  mater.live — overview
                </span>
              </div>
            </div>

            <div
              ref={headlineRef}
              className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-center px-10 sm:px-16"
            >
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-white/60">
                AI-Powered Towing Infrastructure
              </p>
              <h1 className="mt-6 font-sans text-6xl font-normal leading-[1.08] tracking-tight text-white sm:text-7xl">
                Towing should be
                <br />
                <RotatingWord />
              </h1>
              <p className="mt-8 max-w-sm text-base font-light text-white/60">
                Mater automatically detects vehicles that need to be towed and dispatches the nearest
                available truck.
              </p>
              <div className="pointer-events-auto mt-10 w-fit">
                <GetStartedButton />
              </div>
            </div>
          </div>

          <div ref={stepsColRef} className="min-w-0 opacity-0" style={{ flexBasis: "0%" }}>
            <div className="flex flex-col gap-5 lg:w-[360px]">
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-white/55">How it works</p>
              <h2 className="font-sans text-2xl font-semibold leading-[1.15] tracking-tight text-white">
                From a parked car to a dispatched tow.
              </h2>
              {STEPS.map((step, i) => (
                <div
                  key={step.label}
                  ref={(el) => {
                    stepRefs.current[i] = el;
                  }}
                  className="flex gap-3.5"
                  style={{ opacity: 0, transform: "translateY(14px)" }}
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
  );
}
