"use client";

import { useRef } from "react";
import SectionReveal from "./SectionReveal";
import RevealText from "./RevealText";
import ProgressTrack from "./ProgressTrack";

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

// A plain static flow diagram, not a scroll-driven demo — the pattern this
// market's real products actually use (see PLACA.AI's "Your Gate → AI Layer
// → Automated Access"). One pass, no scroll-jacking.
export default function HowItWorks() {
  const sectionRef = useRef<HTMLDivElement>(null);

  return (
    <SectionReveal
      id="how-it-works"
      ref={sectionRef}
      className="relative isolate mx-auto w-full max-w-6xl px-8 py-24 sm:px-12"
    >
      <div
        aria-hidden="true"
        data-reveal-item
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[340px] w-[700px] -translate-x-1/2 -translate-y-1/3"
      >
        <div
          className="landing-glow h-full w-full rounded-full bg-emerald-400/15 blur-[95px]"
          style={{ animationDelay: "-13s" }}
        />
      </div>
      <p data-reveal-item className="font-mono text-xs uppercase tracking-[0.25em] text-white/40">
        How it works
      </p>
      <h2 className="mt-4 max-w-2xl font-sans text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl">
        <RevealText text="From a parked car to a dispatched tow — with a person deciding at every step." />
      </h2>

      <div data-reveal-item className="mt-14">
        <ProgressTrack sectionRef={sectionRef} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, i) => (
          <div key={step.label} data-reveal-item className="flex flex-col gap-4 bg-black p-7">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-emerald-400">
                {step.icon}
              </div>
              <span className="font-mono text-xs text-white/25">0{i + 1}</span>
            </div>
            <h3 className="font-mono text-xs uppercase tracking-wider text-white">{step.label}</h3>
            <p className="text-sm text-white/50">{step.desc}</p>
          </div>
        ))}
      </div>
    </SectionReveal>
  );
}
