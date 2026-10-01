"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, type ReactNode } from "react";
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
 * rise with a slight scale-up and blur-to-sharp focus pull, timed to feel
 * like something coming into frame rather than sliding or bouncing in.
 *
 * If any descendant is marked `data-reveal-item`, those animate individually
 * with a stagger (a grid of cards cascading in one after another) instead of
 * the whole section moving as one block — mark the repeated items in a grid
 * (cards, list rows) with that attribute to opt in.
 */
const SectionReveal = forwardRef<HTMLDivElement, SectionRevealProps>(function SectionReveal(
  { children, className, id },
  forwardedRef,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(forwardedRef, () => rootRef.current as HTMLDivElement);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = rootRef.current;
    if (!root) return;

    const items = root.querySelectorAll<HTMLElement>("[data-reveal-item]");
    const targets: HTMLElement[] = items.length > 0 ? Array.from(items) : [root];

    if (prefersReducedMotion) {
      gsap.set(targets, { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" });
      return;
    }

    gsap.set(targets, { y: 28, opacity: 0, scale: 0.96, filter: "blur(6px)" });

    const tween = gsap.to(targets, {
      y: 0,
      opacity: 1,
      scale: 1,
      filter: "blur(0px)",
      duration: 0.9,
      ease: "power3.out",
      stagger: targets.length > 1 ? 0.1 : 0,
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
});

export default SectionReveal;
