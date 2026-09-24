"use client";

import { streamUrl } from "@/lib/detector";

export default function LiveFeed() {
  return (
    <div className="relative overflow-hidden rounded-lg border border-neutral-800 bg-black">
      <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-medium text-neutral-200 backdrop-blur">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
        LIVE
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- MJPEG multipart stream, not a static image Next's optimizer can handle */}
      <img
        src={streamUrl()}
        alt="Live annotated camera feed"
        className="w-full h-auto block"
      />
    </div>
  );
}
