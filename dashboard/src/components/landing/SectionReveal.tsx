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
 * Every section below the hero is "caught" by the tow hook as it scrolls in:
 * the cable drops, the hook catches, and the section is pulled up into place.
 * This is the site's recurring physical motif from the landing-page PRD.
 */
export default function SectionReveal({ children, className, id }: SectionRevealProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const cableRef = useRef<SVGLineElement>(null);
  const hookRef = useRef<SVGGElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = rootRef.current;
    if (!root || !cableRef.current || !hookRef.current || !contentRef.current) return;

    if (prefersReducedMotion) {
      gsap.set(contentRef.current, { opacity: 1, y: 0 });
      gsap.set(cableRef.current, { scaleY: 1 });
      return;
    }

    gsap.set(cableRef.current, { scaleY: 0, transformOrigin: "top" });
    gsap.set(hookRef.current, { rotate: -6, transformOrigin: "50% 0%" });
    gsap.set(contentRef.current, { y: 70, opacity: 0 });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: root,
        start: "top 78%",
        toggleActions: "play none none reverse",
      },
    });

    tl.to(cableRef.current, { scaleY: 1, duration: 0.5, ease: "power2.out" })
      .to(hookRef.current, { rotate: 4, duration: 0.22, ease: "power1.inOut" }, "-=0.1")
      .to(hookRef.current, { rotate: 0, duration: 0.4, ease: "elastic.out(1, 0.5)" })
      .to(
        contentRef.current,
        { y: 0, opacity: 1, duration: 0.7, ease: "back.out(1.6)" },
        "-=0.45",
      );

    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
    };
  }, []);

  return (
    <div ref={rootRef} id={id} className={className}>
      <svg
        width="28"
        height="56"
        viewBox="0 0 28 56"
        className="mx-auto mb-2 block"
        aria-hidden="true"
      >
        <line
          ref={cableRef}
          x1="14"
          y1="0"
          x2="14"
          y2="34"
          stroke="#6b6b6b"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <g ref={hookRef} transform="translate(14 34)">
          <circle cx="0" cy="4" r="4.5" fill="none" stroke="#8a8a8a" strokeWidth="2.5" />
          <path
            d="M 0 8 L 0 18 C 0 28, 10 29, 11 20 C 11.5 14, 5 12, 4 17"
            fill="none"
            stroke="#8a8a8a"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
      </svg>
      <div ref={contentRef}>{children}</div>
    </div>
  );
}
