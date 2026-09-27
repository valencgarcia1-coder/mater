"use client";

import { useEffect, useRef, useState } from "react";

type Rect = { x: number; y: number; width: number; height: number };
type Edges = { left?: boolean; right?: boolean; top?: boolean; bottom?: boolean };
type Drag = { kind: "move" } | { kind: "resize"; edges: Edges };
type DragState = Drag & { startX: number; startY: number; startRect: Rect };

const MIN_WIDTH = 240;
const MIN_HEIGHT = 160;
// How far outside (and in) the visible border the invisible grab strip
// extends — matches how macOS gives you a few extra pixels of slop to grab
// an edge rather than requiring a pixel-perfect hit on the border itself.
const EDGE = 6;
const CORNER = 14;

// Resize with the opposite edge pinned in place (drag the left edge and the
// right edge stays put) — how every native window resize behaves. Clamps to
// a minimum size without letting the box "jump" once that minimum is hit.
function applyEdges(start: Rect, edges: Edges, dx: number, dy: number): Rect {
  let { x, y, width, height } = start;
  if (edges.left) {
    const next = Math.max(MIN_WIDTH, width - dx);
    x += width - next;
    width = next;
  } else if (edges.right) {
    width = Math.max(MIN_WIDTH, width + dx);
  }
  if (edges.top) {
    const next = Math.max(MIN_HEIGHT, height - dy);
    y += height - next;
    height = next;
  } else if (edges.bottom) {
    height = Math.max(MIN_HEIGHT, height + dy);
  }
  return { x, y, width, height };
}

// Keeps the box fully inside [0,0]..[boundsWidth,boundsHeight] — shrinking
// from whichever side is pinned against the bound, not just translating it,
// so a resize that runs into the map's edge stops there instead of hopping.
function clampToBounds(r: Rect, boundsWidth: number, boundsHeight: number): Rect {
  let { x, y, width, height } = r;
  if (x < 0) {
    width += x;
    x = 0;
  }
  if (y < 0) {
    height += y;
    y = 0;
  }
  if (x + width > boundsWidth) width = boundsWidth - x;
  if (y + height > boundsHeight) height = boundsHeight - y;
  width = Math.max(MIN_WIDTH, Math.min(width, boundsWidth));
  height = Math.max(MIN_HEIGHT, Math.min(height, boundsHeight));
  x = Math.min(Math.max(x, 0), Math.max(0, boundsWidth - width));
  y = Math.min(Math.max(y, 0), Math.max(0, boundsHeight - height));
  return { x, y, width, height };
}

const HANDLES: { edges: Edges; cursor: string; style: React.CSSProperties }[] = [
  { edges: { top: true }, cursor: "ns-resize", style: { top: -EDGE / 2, left: CORNER, right: CORNER, height: EDGE } },
  {
    edges: { bottom: true },
    cursor: "ns-resize",
    style: { bottom: -EDGE / 2, left: CORNER, right: CORNER, height: EDGE },
  },
  { edges: { left: true }, cursor: "ew-resize", style: { left: -EDGE / 2, top: CORNER, bottom: CORNER, width: EDGE } },
  {
    edges: { right: true },
    cursor: "ew-resize",
    style: { right: -EDGE / 2, top: CORNER, bottom: CORNER, width: EDGE },
  },
  {
    edges: { top: true, left: true },
    cursor: "nwse-resize",
    style: { top: -EDGE / 2, left: -EDGE / 2, width: CORNER, height: CORNER },
  },
  {
    edges: { top: true, right: true },
    cursor: "nesw-resize",
    style: { top: -EDGE / 2, right: -EDGE / 2, width: CORNER, height: CORNER },
  },
  {
    edges: { bottom: true, left: true },
    cursor: "nesw-resize",
    style: { bottom: -EDGE / 2, left: -EDGE / 2, width: CORNER, height: CORNER },
  },
  {
    edges: { bottom: true, right: true },
    cursor: "nwse-resize",
    style: { bottom: -EDGE / 2, right: -EDGE / 2, width: CORNER, height: CORNER },
  },
];

// A real window: drag anywhere on the title bar to move it, grab any edge or
// corner to resize (with the opposite side pinned, like macOS), all clamped
// to stay fully inside `boundsRef` — the map, not the whole screen. Position
// and size persist per-browser in localStorage — a per-viewer convenience,
// not shared state, so it's wrapped defensively.
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
  const [drag, setDrag] = useState<DragState | null>(null);

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
    const clamped = clampToBounds(initial, boundsWidth, boundsHeight);
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
      const clamped = clampToBounds(rectRef.current, bounds.clientWidth, bounds.clientHeight);
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
        drag.kind === "move"
          ? { ...drag.startRect, x: drag.startRect.x + dx, y: drag.startRect.y + dy }
          : applyEdges(drag.startRect, drag.edges, dx, dy);
      const clamped = clampToBounds(next, bounds.clientWidth, bounds.clientHeight);
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
      {HANDLES.map((h, i) => (
        <div
          key={i}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDrag({ kind: "resize", edges: h.edges, startX: e.clientX, startY: e.clientY, startRect: rect });
          }}
          className="absolute z-10"
          style={{ ...h.style, cursor: h.cursor }}
        />
      ))}

      <div
        onPointerDown={(e) => {
          e.preventDefault();
          setDrag({ kind: "move", startX: e.clientX, startY: e.clientY, startRect: rect });
        }}
        className="flex h-7 flex-shrink-0 cursor-grab items-center justify-center gap-1 rounded-t-2xl active:cursor-grabbing"
      >
        <span className="h-1 w-1 rounded-full bg-white/25" />
        <span className="h-1 w-1 rounded-full bg-white/25" />
        <span className="h-1 w-1 rounded-full bg-white/25" />
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3">{children}</div>
    </div>
  );
}
