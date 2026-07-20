"use client";

import React, { useRef } from "react";

interface VideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
  ariaLabel?: string;
}

export default function VideoPlayer({ src, poster, className, ariaLabel }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video && video.currentTime < 3) {
      video.currentTime = 3;
    }
  };

  const handlePlay = () => {
    const video = videoRef.current;
    if (video && video.currentTime < 3) {
      video.currentTime = 3;
    }
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (video && video.currentTime < 3) {
      video.currentTime = 3;
    }
  };

  return (
    <video
      ref={videoRef}
      controls
      playsInline
      preload="metadata"
      poster={poster}
      aria-label={ariaLabel}
      className={className}
      onPlay={handlePlay}
      onTimeUpdate={handleTimeUpdate}
      onLoadedMetadata={handleLoadedMetadata}
    >
      <source src={src} type="video/mp4" />
      <p className="text-white p-4">Your browser does not support the video tag.</p>
    </video>
  );
}
