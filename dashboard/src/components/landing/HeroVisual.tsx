"use client";

import { useEffect, useRef, useState } from "react";
import HeroIllustration from "./HeroIllustration";

/**
 * Full-bleed hero background: public/hero.mp4 is the actual Mater
 * detector's output (YOLO + ByteTrack) run against a licensed stock
 * clip — the overlays are genuine tracker output, not mockup graphics.
 * Falls back to a clearly-labeled illustration if the file is missing.
 */
export default function HeroVisual() {
  const [videoFailed, setVideoFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // Only the real "error" event counts as failure — checking
    // video.networkState synchronously here is racy: on a fast client-side
    // remount (e.g. navigating back from /dashboard), the browser hasn't
    // necessarily started resolving the source yet, and a transient
    // NETWORK_NO_SOURCE reading would falsely trigger the fallback even
    // though the video goes on to load fine.
    const handleError = () => setVideoFailed(true);
    video.addEventListener("error", handleError);
    return () => video.removeEventListener("error", handleError);
  }, []);

  if (videoFailed) {
    return <HeroIllustration />;
  }

  return (
    <video
      ref={videoRef}
      className="absolute inset-0 h-full w-full object-cover"
      autoPlay
      muted
      loop
      playsInline
      poster="/hero-poster.jpg"
      src="/hero.mp4"
    />
  );
}
