"use client";

import { useRef, useState } from "react";
import type { DetectorStatus } from "@/lib/detector";
import LiveFeed from "../LiveFeed";
import ToggleButtons from "../ToggleButtons";

export default function CameraPanel({ status }: { status: DetectorStatus | null }) {
  const [zoom, setZoom] = useState(1);
  const wrapRef = useRef<HTMLDivElement>(null);

  function toggleFullscreen() {
    if (!wrapRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      wrapRef.current.requestFullscreen();
    }
  }

  return (
    <div ref={wrapRef} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-sm text-white">Test Lot — Camera 01</span>
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Live
          </span>
        </div>
        <div className="flex items-center gap-3">
          {status && (
            <span className="font-mono text-[10px] uppercase tracking-wider text-white/30">
              {status.fps_estimate.toFixed(0)} FPS
            </span>
          )}
          <ToggleButtons />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl">
        <div
          className="origin-center transition-transform duration-200"
          style={{ transform: `scale(${zoom})` }}
        >
          <LiveFeed />
        </div>
      </div>

      <div className="flex items-center justify-end gap-1.5 pt-3">
        <button
          onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/[0.03] text-white/60 hover:border-white/30 hover:text-white"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          onClick={() => setZoom((z) => Math.min(2, z + 0.25))}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/[0.03] text-white/60 hover:border-white/30 hover:text-white"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          onClick={toggleFullscreen}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/[0.03] text-white/60 hover:border-white/30 hover:text-white"
          aria-label="Toggle fullscreen"
        >
          <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} className="h-3.5 w-3.5">
            <path
              d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
