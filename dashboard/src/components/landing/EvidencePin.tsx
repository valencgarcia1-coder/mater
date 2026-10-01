"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import CompareSlider from "./CompareSlider";
import RevealText from "./RevealText";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

type EvidencePinProps = {
  eyebrow: string;
  heading: string;
  beforeSrc: string;
  beforeAlt: string;
  beforeLabel: string;
  afterSrc: string;
  afterAlt: string;
  afterLabel: string;
};

/**
 * The Evidence beat as one pinned block: the heading words slide into
 * place first, then the comparison frame scales/fades in while the scroll
 * wipes it from day to night — all driven by a single scroll range, then
 * released back into normal flow for the close.
 */
export default function EvidencePin({
  eyebrow,
  heading,
  beforeSrc,
  beforeAlt,
  beforeLabel,
  afterSrc,
  afterAlt,
  afterLabel,
}: EvidencePinProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [pos, setPos] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 50 : 0,
  );
  const [locked, setLocked] = useState(
    () => !(typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches),
  );

  useEffect(() => {
    const outer = outerRef.current;
    const sticky = stickyRef.current;
    const frame = frameRef.current;
    const headingEl = headingRef.current;
    if (!outer || !sticky || !frame || !headingEl) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const words = headingEl.querySelectorAll<HTMLElement>("[data-word]");

    if (prefersReducedMotion) {
      gsap.set(frame, { scale: 1, opacity: 1 });
      gsap.set(words, { yPercent: 0 });
      return;
    }

    gsap.set(frame, { scale: 0.88, opacity: 0.55 });
    gsap.set(words, { yPercent: 110 });

    const st = ScrollTrigger.create({
      trigger: outer,
      start: "top top",
      end: "bottom bottom",
      pin: sticky,
      pinSpacing: true,
      scrub: 0.4,
      onUpdate: (self) => {
        const p = self.progress;
        setPos(p * 100);
        setLocked(p < 0.999);
        const headingProgress = Math.min(1, p / 0.22);
        gsap.set(words, { yPercent: 110 * (1 - headingProgress) });
        const frameProgress = Math.min(1, Math.max(0, (p - 0.1) / 0.3));
        gsap.set(frame, {
          scale: 0.88 + 0.12 * frameProgress,
          opacity: 0.55 + 0.45 * frameProgress,
        });
      },
    });

    return () => {
      st.kill();
    };
  }, []);

  return (
    <div ref={outerRef} className="relative" style={{ height: "260vh" }}>
      <div ref={stickyRef} className="flex h-screen w-full flex-col items-center justify-center px-8 sm:px-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-[18%] -z-10 h-[320px] w-[560px] -translate-x-1/2"
        >
          <div className="landing-glow h-full w-full rounded-full bg-violet-400/18 blur-[90px]" />
        </div>
        <div className="w-full max-w-6xl">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-white/55">{eyebrow}</p>
          <h2
            ref={headingRef}
            className="mt-4 max-w-2xl font-sans text-3xl font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl"
          >
            <RevealText scrubbed text={heading} />
          </h2>
          <div ref={frameRef} className="mt-8 will-change-transform">
            <CompareSlider
              beforeSrc={beforeSrc}
              beforeAlt={beforeAlt}
              beforeLabel={beforeLabel}
              afterSrc={afterSrc}
              afterAlt={afterAlt}
              afterLabel={afterLabel}
              value={pos}
              onChange={setPos}
              interactive={!locked}
            />
            <p className="mt-3 text-center font-mono text-xs uppercase tracking-wider text-white/55">
              {locked ? "Scroll to compare day and night" : "Drag to compare day and night"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
