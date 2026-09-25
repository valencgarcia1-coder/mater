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
    if (video.error || video.networkState === video.NETWORK_NO_SOURCE) {
      setVideoFailed(true);
      return;
    }
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
