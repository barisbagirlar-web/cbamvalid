"use client";

import { Play } from "lucide-react";
import { useCallback, useRef, useState } from "react";

const WALKTHROUGH_SOURCE = "/media/cbamvalid-product-walkthrough.mp4";
const START_TIME_SECONDS = 3;

type WalkthroughVideoProps = {
  ariaLabel?: string;
  className?: string;
};

export function WalkthroughVideo({
  ariaLabel = "CBAMValid product workflow walkthrough",
  className = "",
}: WalkthroughVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [frameReady, setFrameReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const seekToPreviewFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const target = Number.isFinite(video.duration) && video.duration > 0
      ? Math.min(START_TIME_SECONDS, Math.max(0, video.duration - 0.05))
      : START_TIME_SECONDS;

    try {
      video.currentTime = target;
    } catch {
      setLoadFailed(true);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.duration <= START_TIME_SECONDS) {
      video.currentTime = 0;
      setFrameReady(true);
      return;
    }

    seekToPreviewFrame();
  }, [seekToPreviewFrame]);

  const handleSeeked = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.pause();
    setFrameReady(true);
  }, []);

  const handlePlayRequest = useCallback(async () => {
    const video = videoRef.current;
    if (!video || loadFailed) return;

    if (video.ended || video.currentTime < START_TIME_SECONDS - 0.25) {
      seekToPreviewFrame();
    }

    try {
      await video.play();
    } catch {
      // Native controls remain available when browser autoplay or playback policy blocks the request.
    }
  }, [loadFailed, seekToPreviewFrame]);

  const handleEnded = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    setIsPlaying(false);
    seekToPreviewFrame();
  }, [seekToPreviewFrame]);

  return (
    <div
      className={`relative aspect-video overflow-hidden rounded-xl border border-border bg-neutral-soft shadow-2xl ${className}`}
    >
      {!loadFailed && (
        <video
          ref={videoRef}
          controls={frameReady}
          playsInline
          preload="auto"
          aria-label={ariaLabel}
          className={`h-full w-full object-cover transition-opacity duration-200 ${frameReady ? "opacity-100" : "opacity-0"}`}
          onLoadedMetadata={handleLoadedMetadata}
          onSeeked={handleSeeked}
          onCanPlay={() => {
            const video = videoRef.current;
            if (video && Math.abs(video.currentTime - START_TIME_SECONDS) < 0.5) {
              setFrameReady(true);
            }
          }}
          onPlaying={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={handleEnded}
          onError={() => setLoadFailed(true)}
        >
          <source src={WALKTHROUGH_SOURCE} type="video/mp4" />
          Your browser does not support the video element.
        </video>
      )}

      {!frameReady && !loadFailed && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-neutral-soft"
          role="status"
          aria-live="polite"
        >
          <div className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-muted shadow-sm">
            Loading walkthrough preview…
          </div>
        </div>
      )}

      {frameReady && !isPlaying && !loadFailed && (
        <button
          type="button"
          onClick={handlePlayRequest}
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
