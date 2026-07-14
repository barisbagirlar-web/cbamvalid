"use client";

import { Play } from "lucide-react";
import { useCallback, useRef, useState } from "react";

const VIDEO_SOURCE = "/media/cbamvalid-product-walkthrough.mp4";
const START_SECONDS = 3;

type Props = {
  ariaLabel?: string;
  className?: string;
};

export function WalkthroughVideo({
  ariaLabel = "CBAMValid product workflow walkthrough",
  className = "",
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const initialSeekRef = useRef(false);
  const [frameReady, setFrameReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const previewTime = useCallback(() => {
    const video = videoRef.current;
    if (!video) return START_SECONDS;
    if (!Number.isFinite(video.duration) || video.duration <= 0) return START_SECONDS;
    return Math.min(START_SECONDS, Math.max(0, video.duration - 0.05));
  }, []);

  const preparePreview = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    initialSeekRef.current = true;
    try {
      video.currentTime = previewTime();
    } catch {
      initialSeekRef.current = false;
      setLoadFailed(true);
    }
  }, [previewTime]);

  const playFromPreview = useCallback(async () => {
    const video = videoRef.current;
    if (!video || loadFailed) return;

    if (video.ended || video.currentTime < START_SECONDS - 0.25) {
      initialSeekRef.current = false;
      video.currentTime = previewTime();
    }

    try {
      await video.play();
    } catch {
      setIsPlaying(false);
    }
  }, [loadFailed, previewTime]);

  return (
    <div className={`relative aspect-video overflow-hidden rounded-xl border border-border bg-neutral-soft shadow-2xl ${className}`}>
      {!loadFailed && (
        <video
          ref={videoRef}
          controls={frameReady}
          playsInline
          preload="auto"
          aria-label={ariaLabel}
          className={`h-full w-full object-cover transition-opacity duration-200 ${frameReady ? "opacity-100" : "opacity-0"}`}
          onLoadedMetadata={() => {
            const video = videoRef.current;
            if (!video) return;
            if (video.duration <= START_SECONDS) {
              video.currentTime = 0;
              setFrameReady(true);
              return;
            }
            preparePreview();
          }}
          onSeeked={() => {
            const video = videoRef.current;
            if (!video || !initialSeekRef.current) return;
            initialSeekRef.current = false;
            video.pause();
            setFrameReady(true);
          }}
          onCanPlay={() => {
            const video = videoRef.current;
            if (video && Math.abs(video.currentTime - previewTime()) < 0.5) {
              setFrameReady(true);
            }
          }}
          onPlaying={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            setIsPlaying(false);
            preparePreview();
          }}
          onError={() => setLoadFailed(true)}
        >
          <source src={VIDEO_SOURCE} type="video/mp4" />
          Your browser does not support the video element.
        </video>
      )}

      {!frameReady && !loadFailed && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-soft" role="status" aria-live="polite">
          <div className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-muted shadow-sm">
            Loading walkthrough preview…
          </div>
        </div>
      )}

      {frameReady && !isPlaying && !loadFailed && (
        <button
          type="button"
          onClick={playFromPreview}
          className="absolute inset-0 flex cursor-pointer items-center justify-center bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
          aria-label="Play the CBAMValid walkthrough from 3 seconds"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/95 text-surface shadow-lg transition-transform hover:scale-105">
            <Play className="ml-1 h-7 w-7" fill="currentColor" aria-hidden="true" />
          </span>
        </button>
      )}

      {loadFailed && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-soft px-6 text-center">
          <p className="max-w-md text-sm text-muted">
            The walkthrough preview could not be loaded. Open the full workflow page to try again.
          </p>
        </div>
      )}
    </div>
  );
}
