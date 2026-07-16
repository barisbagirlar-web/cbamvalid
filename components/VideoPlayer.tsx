"use client";

import { useRef } from "react";

interface VideoPlayerProps {
  src: string;
  poster?: string;
  startAtSeconds?: number;
  className?: string;
}

/**
 * VideoPlayer — client component that:
 * 1. Renders a native <video> with controls, preload="metadata", and a poster.
 * 2. On loadedmetadata, seeks to `startAtSeconds` to skip any black intro frames.
 */
export default function VideoPlayer({
  src,
  poster,
  startAtSeconds = 0,
  className = "",
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleLoadedMetadata = () => {
    if (videoRef.current && startAtSeconds > 0) {
      videoRef.current.currentTime = startAtSeconds;
    }
  };

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster}
      controls
      preload="metadata"
      onLoadedMetadata={handleLoadedMetadata}
      className={`w-full h-full object-cover ${className}`}
      playsInline
      aria-label="CBAMValid product walkthrough video"
    />
  );
}
