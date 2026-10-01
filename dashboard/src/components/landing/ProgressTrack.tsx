"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// A thin line that fills left-to-right as its parent section scrolls
// through the viewport — ties the four steps together as one continuous
// process instead of four disconnected cards.
export default function ProgressTrack({ sectionRef }: { sectionRef: React.RefObject<HTMLDivElement | null> }) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    const section = sectionRef.current;
    if (!bar || !section) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      gsap.set(bar, { scaleX: 1 });
      return;
    }

    gsap.set(bar, { scaleX: 0, transformOrigin: "left" });
    const tween = gsap.to(bar, {
      scaleX: 1,
      ease: "none",
      scrollTrigger: {
        trigger: section,
        start: "top 70%",
        end: "bottom 60%",
        scrub: 0.4,
      },
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [sectionRef]);

  return (
    <div className="h-px w-full bg-white/10">
      <div ref={barRef} className="h-full w-full bg-gradient-to-r from-emerald-400 via-sky-400 to-violet-400" />
    </div>
  );
}
