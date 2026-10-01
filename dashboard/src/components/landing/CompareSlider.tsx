"use client";

import { useCallback, useRef, useState } from "react";

type CompareSliderProps = {
  beforeSrc: string;
  beforeAlt: string;
  beforeLabel: string;
  afterSrc: string;
  afterAlt: string;
  afterLabel: string;
  /** Controlled position (0-100). Omit to let the slider manage its own drag state. */
  value?: number;
  onChange?: (pos: number) => void;
  /** When false, drag/click input is ignored — used while a parent is driving `value` via scroll. */
  interactive?: boolean;
};

// A draggable day/night comparison instead of two static screenshots —
// the proof becomes something you interact with, not just look at. Can run
// uncontrolled (its own drag state) or controlled (a parent passes `value`,
// e.g. to drive it from scroll position instead of pointer input).
export default function CompareSlider({
  beforeSrc,
  beforeAlt,
  beforeLabel,
  afterSrc,
  afterAlt,
  afterLabel,
  value,
  onChange,
  interactive = true,
}: CompareSliderProps) {
  const [internalPos, setInternalPos] = useState(50);
  const pos = value ?? internalPos;
  const setPos = onChange ?? setInternalPos;
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updateFromClientX = useCallback(
    (clientX: number) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const pct = ((clientX - rect.left) / rect.width) * 100;
      setPos(Math.min(100, Math.max(0, pct)));
    },
    [setPos],
  );

  return (
    <div
      ref={ref}
      className={`relative aspect-video w-full touch-none select-none overflow-hidden rounded-2xl ${interactive ? "cursor-ew-resize" : ""}`}
      onMouseDown={(e) => {
        if (!interactive) return;
        dragging.current = true;
        updateFromClientX(e.clientX);
      }}
      onMouseMove={(e) => {
        if (interactive && dragging.current) updateFromClientX(e.clientX);
      }}
      onMouseUp={() => {
        dragging.current = false;
      }}
      onMouseLeave={() => {
        dragging.current = false;
      }}
      onTouchStart={(e) => interactive && updateFromClientX(e.touches[0].clientX)}
      onTouchMove={(e) => interactive && updateFromClientX(e.touches[0].clientX)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={afterSrc} alt={afterAlt} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      <div className="absolute inset-0 h-full w-full overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={beforeSrc} alt={beforeAlt} className="h-full w-full object-cover" draggable={false} />
      </div>

      <div className="pointer-events-none absolute bottom-0 top-0 w-px bg-white/70" style={{ left: `${pos}%` }}>
        <div className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/80 backdrop-blur-sm">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} className="h-4 w-4 text-white/80">
            <path d="M9 7 4 12l5 5M15 7l5 5-5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      <span className="pointer-events-none absolute bottom-3 left-3 rounded bg-black/55 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-white/70 backdrop-blur-sm">
        {beforeLabel}
      </span>
      <span className="pointer-events-none absolute bottom-3 right-3 rounded bg-black/55 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-white/70 backdrop-blur-sm">
        {afterLabel}
      </span>
    </div>
  );
}
