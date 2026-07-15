"use client";

import React, { useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from "lucide-react";
import Image from "next/image";

interface PageData {
  page: number;
  src: string;
  width: number;
  height: number;
  sha256: string;
}

interface Manifest {
  version: string;
  title: string;
  language: string;
  pageCount: number;
  canonicalSha256: string;
  pages: PageData[];
}

export default function SampleViewer({ manifest }: { manifest: Manifest }) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const currentPage = manifest.pages[currentPageIndex];

  // Map real pages to section titles based on standard output
  const sectionMapping: Record<number, string> = {
    1: "Cover & Document Identity",
    2: "Executive Decision Summary",
    3: "Reporting Scope",
    4: "Entity and Installation Profile",
    5: "Goods and CN Classification",
    6: "Production Route",
    7: "Data Trust Model",
    8: "Direct Emissions",
    9: "Indirect Emissions",
    10: "Precursors and Adjustments",
    11: "Calculation Trace",
    12: "Quality Controls",
    13: "Evidence Register",
    14: "Ruleset and Sources",
    15: "Integrity Manifest",
    16: "Limitations and Deliverables",
  };

  const handleNext = () => {
    if (currentPageIndex < manifest.pageCount - 1) {
      setCurrentPageIndex((prev) => prev + 1);
      setZoom(1);
    }
  };

  const handlePrev = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex((prev) => prev - 1);
      setZoom(1);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPageIndex]);

  return (
    <div
      className={`flex flex-col md:flex-row border border-border bg-surface rounded-xl overflow-hidden ${isFullscreen ? "fixed inset-0 z-50 rounded-none" : "h-[800px]"}`}
    >
      {/* Left Rail: Thumbnails */}
      <div className="hidden md:flex flex-col w-48 bg-muted/5 border-r border-border overflow-y-auto p-4 gap-4">
        {manifest.pages.map((p, idx) => (
          <button
            key={p.page}
            onClick={() => {
              setCurrentPageIndex(idx);
              setZoom(1);
            }}
            className={`relative w-full aspect-[1/1.4] rounded border-2 transition-all overflow-hidden ${idx === currentPageIndex ? "border-accent ring-2 ring-accent/20" : "border-border/50 hover:border-accent/50"}`}
            aria-label={`Go to page ${p.page}`}
          >
            <Image
              src={p.src}
              alt={`Thumbnail for page ${p.page}`}
              fill
              className="object-contain"
              sizes="150px"
            />
            <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 rounded font-mono">
              {p.page}
            </div>
          </button>
        ))}
      </div>

      {/* Center: Viewer */}
      <div className="flex-1 flex flex-col bg-slate-900/5 dark:bg-black/50 relative overflow-hidden">
        {/* Controls Bar */}
        <div className="h-14 border-b border-border bg-surface flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              Page {currentPage.page} of {manifest.pageCount}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
              className="p-2 hover:bg-muted/10 rounded text-muted hover:text-foreground"
              aria-label="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
              className="p-2 hover:bg-muted/10 rounded text-muted hover:text-foreground"
              aria-label="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-border mx-2" />
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 hover:bg-muted/10 rounded text-muted hover:text-foreground"
              aria-label="Toggle Fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Image Canvas Area */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-4 relative">
          {currentPageIndex > 0 && (
            <button
              onClick={handlePrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-surface/80 backdrop-blur border border-border p-3 rounded-full shadow-lg hover:bg-surface hover:text-accent z-10 transition-all"
              aria-label="Previous Page"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          <div
            className="transition-transform duration-200 origin-center bg-surface shadow-2xl relative"
            style={{
              transform: `scale(${zoom})`,
              width: `${currentPage.width / 2}px`, // scaled down naturally
              height: `${currentPage.height / 2}px`,
              maxWidth: zoom === 1 ? "100%" : "none",
              maxHeight: zoom === 1 ? "100%" : "none",
              aspectRatio: `${currentPage.width} / ${currentPage.height}`,
            }}
          >
            <Image
              src={currentPage.src}
              alt={`Sample Dossier Page ${currentPage.page}: ${sectionMapping[currentPage.page] || "Document"}`}
              fill
              className="object-contain"
              priority={currentPageIndex === 0}
              sizes="(max-width: 768px) 100vw, 800px"
              unoptimized // Rely on the pre-optimized WebP
            />
          </div>

          {currentPageIndex < manifest.pageCount - 1 && (
            <button
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-surface/80 backdrop-blur border border-border p-3 rounded-full shadow-lg hover:bg-surface hover:text-accent z-10 transition-all"
              aria-label="Next Page"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
        </div>
      </div>

      {/* Right Panel: Information */}
      <div className="w-full md:w-64 bg-surface border-t md:border-t-0 md:border-l border-border p-6 overflow-y-auto">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted mb-2">
          Section
        </h3>
        <p className="font-serif text-lg text-foreground font-semibold mb-6">
          {sectionMapping[currentPage.page] || "Dossier Detail"}
        </p>

        <div className="p-4 bg-accent/5 border border-accent/20 rounded text-sm text-accent mb-6">
          <strong>Note:</strong> This sample uses fictional demonstration data.
          It is not an official submission.
        </div>

        <div className="space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
            Dossier Contents
          </h4>
          <ul className="text-sm space-y-2 text-muted h-64 overflow-y-auto pr-2 custom-scrollbar">
            {manifest.pages.map((p) => (
              <li
                key={p.page}
                className={`cursor-pointer hover:text-foreground transition-colors ${p.page === currentPage.page ? "text-foreground font-semibold" : ""}`}
                onClick={() => {
                  setCurrentPageIndex(p.page - 1);
                  setZoom(1);
                }}
              >
                {p.page}. {sectionMapping[p.page] || "Detail"}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
