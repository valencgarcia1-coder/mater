"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import CompareSlider from "./CompareSlider";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

type EvidencePinProps = {
  beforeSrc: string;
  beforeAlt: string;
  beforeLabel: string;
  afterSrc: string;
  afterAlt: string;
  afterLabel: string;
};

/**
 * Experimental "pinned frame" treatment: the comparison image locks in
 * place and fills in (scale + opacity) while the scroll wipes it from day
 * to night, then releases back into normal flow for whatever comes next —
 * the single-still-frame-per-scroll-beat pattern, instead of everything
 * just continuously scrolling past. Scoped to this one section to see if
 * it's worth carrying anywhere else.
 */
export default function EvidencePin({
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
  const [pos, setPos] = useState(0);
  const [locked, setLocked] = useState(true);

  useEffect(() => {
    const outer = outerRef.current;
    const sticky = stickyRef.current;
    const frame = frameRef.current;
    if (!outer || !sticky || !frame) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      setPos(50);
      setLocked(false);
      gsap.set(frame, { scale: 1, opacity: 1 });
      return;
    }

    gsap.set(frame, { scale: 0.88, opacity: 0.55 });

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
        const introProgress = Math.min(1, p / 0.35);
        gsap.set(frame, {
          scale: 0.88 + 0.12 * introProgress,
          opacity: 0.55 + 0.45 * introProgress,
        });
      },
    });

    return () => {
      st.kill();
    };
  }, []);

  return (
    <div ref={outerRef} className="relative" style={{ height: "230vh" }}>
      <div ref={stickyRef} className="flex h-screen w-full flex-col items-center justify-center">
        <div ref={frameRef} className="w-full will-change-transform">
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
          <p className="mt-3 text-center font-mono text-xs uppercase tracking-wider text-white/40">
            {locked ? "Scroll to compare day and night" : "Drag to compare day and night"}
          </p>
        </div>
      </div>
    </div>
  );
}
