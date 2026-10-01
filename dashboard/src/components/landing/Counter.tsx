"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

type CounterProps = {
  to: number;
  suffix?: string;
  decimals?: number;
  className?: string;
};

// Counts up from 0 once the number scrolls into view — a plain number just
// sitting there reads as a claim; one that counts up reads as measured.
export default function Counter({ to, suffix = "", decimals = 0, className }: CounterProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      el.textContent = to.toFixed(decimals) + suffix;
      return;
    }

    const obj = { val: 0 };
    const tween = gsap.to(obj, {
      val: to,
      duration: 1.6,
      ease: "power2.out",
      onUpdate: () => {
        el.textContent = obj.val.toFixed(decimals) + suffix;
      },
      scrollTrigger: {
        trigger: el,
        start: "top 85%",
        once: true,
      },
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [to, suffix, decimals]);

  return (
    <span ref={ref} className={className}>
      0{suffix}
    </span>
  );
}
