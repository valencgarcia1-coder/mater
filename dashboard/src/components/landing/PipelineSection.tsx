"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import SectionReveal from "./SectionReveal";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const STEPS = [
  {
    n: "01",
    label: "DETECT",
    title: "See every vehicle, the instant it arrives.",
    desc: "Mater runs real-time vehicle detection and tracking on your existing camera feed — no new hardware, no separate sensors. Every space is checked against its exact drawn geometry, not a rough zone, so a car parked across a line reads correctly instead of confusing two spaces at once.",
  },
  {
    n: "02",
    label: "VERIFY",
    title: "Confirm it's a violation, not a glitch.",
    desc: "A car passing through, a plow blocking the view for a second, headlight glare — none of that should trigger an alert. Mater requires a state to hold steady across multiple frames before it trusts it, then times how long the vehicle has actually stayed against the rule configured for that exact zone: fire lane, handicap, standard, whatever you've set.",
  },
  {
    n: "03",
    label: "REVIEW",
    title: "A person signs off before anything happens.",
    desc: "Every confirmed violation raises an alert in the dashboard for a human reviewer — nothing escalates on its own. You see the timestamped evidence, the zone, and how long the vehicle has been there, and you decide: acknowledge it, dismiss it, or send it on.",
  },
  {
    n: "04",
    label: "DISPATCH",
    title: "Turn a reviewed case into a job.",
    desc: "Once a reviewer confirms it, Mater turns the case into a tow request — vehicle, location, and evidence attached — and routes it to the nearest available truck.",
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
      <div className="absolute inset-x-0 top-0 flex items-center gap-1.5 bg-gradient-to-b from-black/70 to-transparent px-5 py-4">
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
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-5 pb-5 pt-12">
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

function ReviewVisual() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-900 to-neutral-950 p-8">
      <div className="w-full max-w-sm rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-wider text-white/40">Alerts to review</span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] text-white/70">1</span>
        </div>
        <div className="mt-3 rounded-lg border border-white/10 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-sm text-white">Space P9</span>
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-amber-400">
              Violation
            </span>
          </div>
          <p className="mt-1 font-mono text-[11px] text-white/40">Standard · 6m stationary</p>
          <div className="mt-3 flex gap-2">
            <span className="rounded-full bg-white px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-black">
              Acknowledge
            </span>
            <span className="rounded-full border border-white/20 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-white/70">
              Dismiss
            </span>
          </div>
        </div>
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

const VISUALS = [DetectVisual, VerifyVisual, ReviewVisual, DispatchVisual];

// Detect/Verify/Review/Dispatch as one pinned, scroll-scrubbed section — the
// image and the text both crossfade together as you scroll through the four
// steps, with a slim always-visible progress row above for orientation
// (rather than stacking every title, dimmed, underneath the active one).
// Pinning is desktop-only (gsap.matchMedia): on a phone, pinning a tall
// section for a multi-screen scroll distance is more disorienting than
// nice, so it falls back to a plain stacked list.
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
    <>
      <SectionReveal className="mx-auto w-full max-w-4xl px-8 pt-28 text-center sm:px-12">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-white/40">How it works</p>
        <h2 className="mt-4 font-serif text-4xl font-semibold text-white sm:text-5xl">
          From a parked car to a dispatched tow — with a person deciding at every step.
        </h2>
      </SectionReveal>

      <div ref={wrapRef} className="relative bg-black">
        <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-8 py-20 sm:px-12">
          <div className="mb-10 flex items-center justify-center gap-2 sm:gap-4">
            {STEPS.map((step, i) => (
              <div key={step.label} className="flex items-center gap-2 sm:gap-4">
                <button
                  onClick={() => setActive(i)}
                  className="font-mono text-[11px] uppercase tracking-[0.2em] transition-colors md:cursor-default"
                  style={{ color: i === active ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.3)" }}
                >
                  {step.label}
                </button>
                {i < STEPS.length - 1 && <span className="text-white/20">→</span>}
              </div>
            ))}
          </div>

          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <div className="min-h-[220px]">
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-white/40">
                {STEPS[active].n} · {STEPS[active].label}
              </p>
              <h3 className="mt-4 font-serif text-3xl font-semibold text-white sm:text-4xl">
                {STEPS[active].title}
              </h3>
              <p className="mt-5 max-w-md text-white/60">{STEPS[active].desc}</p>
            </div>

            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-neutral-800 sm:aspect-video">
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
    </>
  );
}
