"use client";

import { useRef, useCallback } from "react";

interface VideoPlayerProps {
  src: string;
  poster?: string;
  startAtSeconds?: number;
  className?: string;
}

/**
 * VideoPlayer — client component that:
 * 1. Renders a native <video> with controls and poster.
 * 2. Uses Media Fragment URI (#t=N) to start at startAtSeconds.
 * 3. Falls back to onLoadedMetadata currentTime seek as a safety net.
 */
export default function VideoPlayer({
  src,
  poster,
  startAtSeconds = 0,
  className = "",
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current && startAtSeconds > 0) {
      videoRef.current.currentTime = startAtSeconds;
    }
  }, [startAtSeconds]);

  // Use Media Fragment URI for browser-level skip
  const videoSrc = startAtSeconds > 0 ? `${src}#t=${startAtSeconds}` : src;

  return (
    <video
      ref={videoRef}
      src={videoSrc}
      poster={poster}
      controls
      preload="auto"
      onLoadedMetadata={handleLoadedMetadata}
      className={`w-full h-full object-cover ${className}`}
      playsInline
      aria-label="CBAMValid product walkthrough video"
      style={{ backgroundColor: "transparent" }}
    />
  );
}
