"use client";

import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, ShieldCheck, AlertCircle } from "lucide-react";
import Image from "next/image";

export default function SampleViewerClient() {
  const [manifest, setManifest] = useState<{ pageCount: number; version: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    fetch("/api/sample-dossier/manifest")
      .then(res => res.json())
      .then(data => {
        if (data.error) setError(data.error);
        else setManifest(data);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex-1 flex items-center justify-center">Loading sample dossier...</div>;
  }

  if (error || !manifest) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">Sample Dossier Unavailable</h2>
        <p className="text-muted">{error || "The sample dossier has not been generated yet."}</p>
      </div>
    );
  }

  const pages = Array.from({ length: manifest.pageCount }, (_, i) => {
    const pageNum = (i + 1).toString().padStart(3, "0");
    return `/api/sample-dossier/pages/${pageNum}`;
  });

  return (
    <div className="flex-1 flex h-full">
      {/* Sidebar Thumbnails */}
      <div className="w-64 bg-surface border-r border-border overflow-y-auto hidden md:block shrink-0">
        <div className="p-4 border-b border-border sticky top-0 bg-surface/90 backdrop-blur z-10">
          <h3 className="font-semibold text-sm">Document Pages</h3>
          <p className="text-xs text-muted">{manifest.pageCount} pages</p>
        </div>
        <div className="p-4 space-y-4">
          {pages.map((src, i) => (
            <div 
              key={i} 
              onClick={() => setCurrentPage(i + 1)}
              className={`cursor-pointer rounded border-2 transition-all overflow-hidden ${currentPage === i + 1 ? "border-primary shadow-sm" : "border-transparent hover:border-border"}`}
            >
              <div className="relative aspect-[1/1.414] w-full bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Page ${i + 1}`} className="object-contain w-full h-full" loading="lazy" />
              </div>
              <div className="text-center py-1 text-xs text-muted">Page {i + 1}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Viewer */}
      <div className="flex-1 flex flex-col bg-slate-100 relative overflow-hidden">
        {/* Viewer Toolbar */}
        <div className="h-12 bg-surface border-b border-border flex items-center justify-between px-4 shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 hover:bg-slate-100 rounded disabled:opacity-50"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-medium">Page {currentPage} of {manifest.pageCount}</span>
            <button 
              onClick={() => setCurrentPage(p => Math.min(manifest.pageCount, p + 1))}
              disabled={currentPage === manifest.pageCount}
              className="p-1.5 hover:bg-slate-100 rounded disabled:opacity-50"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="p-1.5 hover:bg-slate-100 rounded">
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs w-12 text-center">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale(s => Math.min(3, s + 0.25))} className="p-1.5 hover:bg-slate-100 rounded">
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Viewport */}
        <div className="flex-1 overflow-auto p-4 md:p-8 flex items-start justify-center">
          <div 
            className="bg-surface shadow-xl transition-transform origin-top"
            style={{ 
              transform: `scale(${scale})`, 
              width: "100%", 
              maxWidth: "800px", 
              aspectRatio: "1/1.414"
            }}
          >
            {/* Using standard img instead of Next Image to ensure unoptimized rendering of the raster buffer */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={pages[currentPage - 1]} 
              alt={`Page ${currentPage}`} 
              className="w-full h-full object-contain select-none"
              onContextMenu={e => e.preventDefault()}
              draggable={false}
            />
          </div>
        </div>
      </div>

      {/* Right Context Panel */}
      <div className="w-80 bg-surface border-l border-border p-6 hidden lg:block overflow-y-auto shrink-0">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold mb-4">
            <ShieldCheck className="w-3.5 h-3.5" /> Commercial Sample
          </div>
          <h2 className="text-xl font-serif font-bold mb-3">Definitive Evidence Dossier</h2>
          <p className="text-sm text-muted">
            This viewer demonstrates the exact structure and cryptographic integrity of a CBAMValid output report. 
            All proprietary data has been redacted and replaced with fictional values on the server.
          </p>
        </div>
        
        <div className="space-y-6">
          <div className="p-4 bg-slate-50 border border-border rounded-lg">
            <h3 className="font-semibold text-sm mb-2">Privacy & Security</h3>
            <ul className="text-xs text-muted space-y-2 list-disc pl-4">
              <li>No underlying text layer exists in this viewer.</li>
              <li>Data redaction is explicitly baked into the pixels.</li>
              <li>Actual reports are encrypted and sealed by the EU KMS.</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-sm mb-3">Want a copy?</h3>
            <p className="text-xs text-muted mb-4">
              Authenticated users can download a watermarked, image-only PDF version of this sample for internal evaluation.
            </p>
            <a 
              href="/login?next=/sample-dossier/download" 
              className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-md hover:bg-primary/90 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
