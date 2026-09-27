"use client";

import { useEffect, useRef, useState } from "react";

type Rect = { x: number; y: number; width: number; height: number };

const MIN_WIDTH = 240;
const MIN_HEIGHT = 160;

function clampRect(r: Rect, boundsWidth: number, boundsHeight: number): Rect {
  const width = Math.min(Math.max(r.width, MIN_WIDTH), Math.max(MIN_WIDTH, boundsWidth));
  const height = Math.min(Math.max(r.height, MIN_HEIGHT), Math.max(MIN_HEIGHT, boundsHeight));
  const x = Math.min(Math.max(r.x, 0), Math.max(0, boundsWidth - width));
  const y = Math.min(Math.max(r.y, 0), Math.max(0, boundsHeight - height));
  return { x, y, width, height };
}

// A window-like panel: drag by the grip bar, resize from the corner, both
// clamped to stay fully inside `boundsRef` (the map, not the whole screen).
// Position/size persist per-browser in localStorage — a per-viewer
// convenience, not shared state, so it's wrapped defensively.
export default function FloatingPanel({
  storageKey,
  defaultRect,
  boundsRef,
  children,
}: {
  storageKey: string;
  defaultRect: Rect;
  boundsRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
}) {
  const [rect, setRect] = useState<Rect | null>(null);
  const rectRef = useRef<Rect | null>(null);
  const [drag, setDrag] = useState<{
    mode: "move" | "resize";
    startX: number;
    startY: number;
    startRect: Rect;
  } | null>(null);

  // Placed after mount so it can measure the real bounds size, and so a
  // saved rect from localStorage (which doesn't exist on the server) never
  // causes a server/client render mismatch.
  useEffect(() => {
    const bounds = boundsRef.current;
    const boundsWidth = bounds?.clientWidth ?? window.innerWidth;
    const boundsHeight = bounds?.clientHeight ?? window.innerHeight;
    let initial = defaultRect;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) initial = JSON.parse(saved);
    } catch {
      // ignore — private browsing, disabled storage, or corrupt JSON
    }
    const clamped = clampRect(initial, boundsWidth, boundsHeight);
    rectRef.current = clamped;
    setRect(clamped);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount only
  }, []);

  // Re-clamp whenever the map area itself resizes, so the panel can't end
  // up stuck partly or fully off-screen after a window resize.
  useEffect(() => {
    function onResize() {
      const bounds = boundsRef.current;
      if (!bounds || !rectRef.current) return;
      const clamped = clampRect(rectRef.current, bounds.clientWidth, bounds.clientHeight);
      rectRef.current = clamped;
      setRect(clamped);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [boundsRef]);

  useEffect(() => {
    if (!drag) return;
    function onMove(e: PointerEvent) {
      const bounds = boundsRef.current;
      if (!bounds || !drag) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const next =
        drag.mode === "move"
          ? { ...drag.startRect, x: drag.startRect.x + dx, y: drag.startRect.y + dy }
          : { ...drag.startRect, width: drag.startRect.width + dx, height: drag.startRect.height + dy };
      const clamped = clampRect(next, bounds.clientWidth, bounds.clientHeight);
      rectRef.current = clamped;
      setRect(clamped);
    }
    function onUp() {
      setDrag(null);
      if (rectRef.current) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(rectRef.current));
        } catch {
          // ignore
        }
      }
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, boundsRef, storageKey]);

  if (!rect) return null;

  return (
    <div
      style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
      className="pointer-events-auto flex flex-col rounded-2xl border border-white/10 bg-black/70 backdrop-blur-md"
    >
      <div
        onPointerDown={(e) => {
          e.preventDefault();
          setDrag({ mode: "move", startX: e.clientX, startY: e.clientY, startRect: rect });
        }}
        className="flex flex-shrink-0 cursor-grab items-center justify-center gap-1 rounded-t-2xl py-1.5 active:cursor-grabbing"
      >
        <span className="h-1 w-1 rounded-full bg-white/25" />
        <span className="h-1 w-1 rounded-full bg-white/25" />
        <span className="h-1 w-1 rounded-full bg-white/25" />
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3">{children}</div>

      <div
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDrag({ mode: "resize", startX: e.clientX, startY: e.clientY, startRect: rect });
        }}
        className="absolute bottom-0.5 right-0.5 flex h-4 w-4 cursor-nwse-resize items-end justify-end text-white/25 hover:text-white/50"
      >
        <svg viewBox="0 0 10 10" className="h-2.5 w-2.5">
          <path
            d="M9 1 1 9M9 5 5 9M9 9v0"
            stroke="currentColor"
            strokeWidth={1.2}
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </div>
    </div>
  );
}
