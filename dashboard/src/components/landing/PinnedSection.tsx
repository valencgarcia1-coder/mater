"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

type PinnedSectionProps = {
  children: ReactNode;
  className?: string;
  id?: string;
  /** Scroll distance consumed while this section is pinned, as vh. More runway = slower reveal. */
  runwayVh?: number;
};

/**
 * Every section on the page is one "beat" of a single scroll story: it
 * locks in place (pinned, not just sticky) and its content fills in —
 * headline words sliding up, cards/items staggering in — driven directly
 * by scroll position (scrubbed, not auto-timed), then releases into the
 * next beat once fully revealed.
 *
 * Forwards the OUTER (tall, scroll-runway) element's ref, not the inner
 * pinned one — a sibling that wants its own scroll-synced animation
 * (e.g. a progress bar) should scrollTrigger off that same outer element
 * with start:"top top", end:"bottom bottom" to stay perfectly in sync.
 *
 * Any descendant marked `data-reveal-item` staggers in individually;
 * otherwise the whole block animates as one. A `RevealText` used inside
 * must be given `scrubbed` so it doesn't run its own competing animation —
 * its `[data-word]` spans are picked up and driven by this timeline too.
 */
const PinnedSection = forwardRef<HTMLDivElement, PinnedSectionProps>(function PinnedSection(
  { children, className, id, runwayVh = 160 },
  forwardedOuterRef,
) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(forwardedOuterRef, () => outerRef.current as HTMLDivElement);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const items = inner.querySelectorAll<HTMLElement>("[data-reveal-item]");
    const words = inner.querySelectorAll<HTMLElement>("[data-word]");
    const targets: HTMLElement[] = items.length > 0 ? Array.from(items) : [inner];

    if (prefersReducedMotion) {
      gsap.set(targets, { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" });
      gsap.set(words, { yPercent: 0 });
      return;
    }

    gsap.set(targets, { y: 28, opacity: 0, scale: 0.96, filter: "blur(6px)" });
    if (words.length > 0) gsap.set(words, { yPercent: 110 });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: outer,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.4,
        pin: inner,
        pinSpacing: true,
      },
    });

    if (words.length > 0) {
      tl.to(words, { yPercent: 0, duration: 1, ease: "power3.out", stagger: 0.03 }, 0);
    }
    tl.to(
      targets,
      {
        y: 0,
        opacity: 1,
        scale: 1,
        filter: "blur(0px)",
        duration: 1,
        ease: "power3.out",
        stagger: targets.length > 1 ? 0.12 : 0,
      },
      words.length > 0 ? 0.35 : 0,
    );

    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
    };
  }, [runwayVh]);

  return (
    <div ref={outerRef} className="relative" style={{ height: `${runwayVh}vh` }}>
      <div ref={innerRef} className="flex h-screen w-full items-center justify-center">
        <div id={id} className={className}>
          {children}
        </div>
      </div>
    </div>
  );
});

export default PinnedSection;
