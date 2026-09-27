"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const STEPS = [
  {
    n: "01",
    label: "DETECT",
    title: "See it.",
    desc: "Mater watches the environment and identifies vehicles automatically.",
  },
  {
    n: "02",
    label: "VERIFY",
    title: "Time it.",
    desc: "A vehicle isn't a tow simply because it's there. Mater understands location, movement, dwell time, and the parking rules configured for each zone.",
  },
  {
    n: "03",
    label: "DISPATCH",
    title: "Send it.",
    desc: "When a tow is needed, Mater turns the event into a job.",
  },
] as const;

const TIMELINE = [
  { time: "01:31:22", label: "Vehicle detected" },
  { time: "01:32:04", label: "Vehicle stopped" },
  { time: "01:37:04", label: "Violation confirmed" },
];

function DetectVisual() {
  return (
    <div className="relative h-full w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/landing/detect-frame.jpg"
        alt="A real camera frame from a Mater-monitored lot, with space occupancy detected and labeled"
        className="h-full w-full object-cover"
      />
      <div className="absolute inset-x-0 top-0 flex items-center gap-1.5 bg-gradient-to-b from-black/70 to-transparent px-4 py-3">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-white/70">
          Live detection — real footage
        </span>
      </div>
    </div>
  );
}

function VerifyVisual() {
  return (
    <div className="relative h-full w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/landing/verify-frame.jpg"
        alt="The same lot at night, with one space flagged as occupied while Mater tracks how long the vehicle has stayed"
        className="h-full w-full object-cover"
      />
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-4 pb-4 pt-10">
        {TIMELINE.map((step) => (
          <div key={step.time} className="flex items-baseline gap-2.5 font-mono text-[11px]">
            <span className="text-white/40">{step.time}</span>
            <span className="text-white/80">{step.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DispatchVisual() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-900 to-neutral-950 p-8">
      <div className="w-full max-w-xs font-mono text-sm">
        <div className="flex items-center gap-2 text-white/40">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} className="h-4 w-4">
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
          TOW REQUEST
        </div>
        <div className="mt-3 space-y-1 text-white/80">
          <p>Vehicle #23</p>
          <p>Parking Lot A</p>
          <p className="text-red-400/80">Violation confirmed</p>
        </div>
        <div className="my-4 text-white/20">↓</div>
        <p className="text-white/40">TOW #14</p>
        <div className="mt-3 space-y-1 text-white/80">
          <p>2.1 mi away</p>
          <p>ETA 6 min</p>
        </div>
        <div className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs tracking-wide text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          DISPATCHED
        </div>
      </div>
    </div>
  );
}

const VISUALS = [DetectVisual, VerifyVisual, DispatchVisual];

// Detect/Verify/Dispatch as one pinned, scroll-scrubbed section — the visual
// on the right changes as you scroll through the three steps instead of each
// step being its own fade-in card. Pinning is desktop-only (gsap.matchMedia):
// on a phone, pinning a tall section for a multi-screen scroll distance is
// more disorienting than nice, so it falls back to a plain stacked list.
export default function PipelineSection() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const mm = gsap.matchMedia();
    mm.add("(min-width: 768px)", () => {
      const trigger = ScrollTrigger.create({
        trigger: wrap,
        start: "top top",
        end: () => `+=${window.innerHeight * (STEPS.length - 1)}`,
        pin: true,
        scrub: 0.5,
        onUpdate: (self) => {
          setActive(Math.min(STEPS.length - 1, Math.floor(self.progress * STEPS.length)));
        },
      });
      return () => trigger.kill();
    });

    return () => mm.revert();
  }, []);

  return (
    <div ref={wrapRef} className="relative bg-black">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-8 py-28 sm:px-12">
        <div className="grid gap-12 md:grid-cols-2 md:items-center">
          <div className="flex flex-col gap-10">
            {STEPS.map((step, i) => (
              <button
                key={step.label}
                onClick={() => setActive(i)}
                className="text-left transition-opacity duration-300 md:cursor-default"
                style={{ opacity: i === active ? 1 : 0.35 }}
              >
                <p className="font-mono text-xs uppercase tracking-[0.25em] text-white/40">
                  {step.n} · {step.label}
                </p>
                <h3 className="mt-2 font-serif text-4xl font-semibold text-white sm:text-5xl">{step.title}</h3>
                {i === active && <p className="mt-3 max-w-sm text-white/60">{step.desc}</p>}
              </button>
            ))}
          </div>

          <div className="relative aspect-video overflow-hidden rounded-2xl border border-neutral-800 md:sticky md:top-1/2 md:-translate-y-1/2">
            {VISUALS.map((Visual, i) => (
              <div
                key={i}
                className="absolute inset-0 transition-opacity duration-500"
                style={{ opacity: i === active ? 1 : 0, pointerEvents: i === active ? "auto" : "none" }}
              >
                <Visual />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
