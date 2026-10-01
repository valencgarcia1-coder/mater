"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

type RevealTextProps = {
  text: string;
  className?: string;
  as?: "span";
};

/**
 * Splits plain text into words, each masked behind `overflow-hidden`, and
 * slides them up into place with a stagger as the heading scrolls into view.
 * Use only for headings that are plain strings (no nested markup) — the
 * split happens on `text`, not on children.
 */
export default function RevealText({ text, className }: RevealTextProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const words = el.querySelectorAll<HTMLElement>("[data-word]");

    if (prefersReducedMotion) {
      gsap.set(words, { yPercent: 0 });
      return;
    }

    gsap.set(words, { yPercent: 110 });
    const tween = gsap.to(words, {
      yPercent: 0,
      duration: 0.85,
      ease: "power3.out",
      stagger: 0.035,
      scrollTrigger: {
        trigger: el,
        start: "top 85%",
        toggleActions: "play none none reverse",
      },
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [text]);

  return (
    <span ref={ref} className={className}>
      {text.split(" ").map((word, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.15em] align-top">
          <span data-word className="inline-block will-change-transform">
            {word}
            {i < text.split(" ").length - 1 ? " " : ""}
          </span>
        </span>
      ))}
    </span>
  );
}
