"use client";

import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

type SectionRevealProps = {
  children: ReactNode;
  className?: string;
  id?: string;
};

/**
 * Every section below the hero settles into place as it scrolls in: a soft
 * rise with a slight blur-to-sharp focus pull, timed to feel like something
 * coming into frame rather than sliding or bouncing in.
 */
export default function SectionReveal({ children, className, id }: SectionRevealProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = rootRef.current;
    if (!root) return;

    if (prefersReducedMotion) {
      gsap.set(root, { opacity: 1, y: 0, filter: "blur(0px)" });
      return;
    }

    gsap.set(root, { y: 28, opacity: 0, filter: "blur(6px)" });

    const tween = gsap.to(root, {
      y: 0,
      opacity: 1,
      filter: "blur(0px)",
      duration: 0.9,
      ease: "power3.out",
      scrollTrigger: {
        trigger: root,
        start: "top 80%",
        toggleActions: "play none none reverse",
      },
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, []);

  return (
    <div ref={rootRef} id={id} className={className}>
      {children}
    </div>
  );
}
