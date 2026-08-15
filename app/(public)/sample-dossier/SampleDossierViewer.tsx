"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useClassReveal } from "@/components/marketing/MarketingUi";
import { PUBLIC_SAMPLE_DOSSIER } from "@/lib/sample/public-sample-dossier";

const SECTION_TITLES: Record<number, string> = {
  1: "Cover & Document Identity",
  2: "Executive Decision Summary",
  3: "Reporting Scope",
  4: "Entity & Installation Profile",
  5: "Goods & CN Classification",
  6: "Production Route",
  7: "Data Trust Model",
  8: "Direct Emissions",
  9: "Indirect Emissions",
  10: "Precursors & Adjustments",
  11: "Calculation Trace",
  12: "Quality Controls",
  13: "Evidence Register",
  14: "Ruleset & Sources",
  15: "Integrity Manifest",
  16: "Limitations & Deliverables",
};

const PAGE_COUNT = PUBLIC_SAMPLE_DOSSIER.pageCount;

function pageSrc(page: number): string {
  return `/sample-dossier/v1/pages/page-${String(page).padStart(3, "0")}.webp`;
}

export default function SampleDossierViewer() {
  const [activeIndex, setActiveIndex] = useState(0);
  useClassReveal();

  const goTo = useCallback((index: number) => {
    setActiveIndex(Math.max(0, Math.min(PAGE_COUNT - 1, index)));
  }, []);

  const goPrev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);
  const goNext = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") goPrev();
      if (event.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext]);

  const pageNumber = activeIndex + 1;

  return (
    <div className="viewer-grid" id="dossier-viewer" aria-label="Sample dossier viewer">
      <div className="viewer-thumbs" role="tablist" aria-label="Dossier pages">
        {Array.from({ length: PAGE_COUNT }, (_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={activeIndex === i}
            aria-controls="sample-dossier-stage"
            className={`vthumb${activeIndex === i ? " on" : ""}`}
            onClick={() => goTo(i)}
          >
            <span className="pg">{i + 1}</span>
            <span>Page</span>
          </button>
        ))}
      </div>

      <div className="viewer-stage" id="sample-dossier-stage" role="tabpanel">
        <div className="viewer-stage-bar">
          <button
            type="button"
            className="viewer-nav-btn"
            onClick={goPrev}
            disabled={activeIndex === 0}
            aria-label="Previous page"
          >
            ← Prev
          </button>
          <p className="mono viewer-page-label">
            Page {pageNumber} of {PAGE_COUNT} · {SECTION_TITLES[pageNumber] ?? "Sample page"}
          </p>
          <button
            type="button"
            className="viewer-nav-btn"
            onClick={goNext}
            disabled={activeIndex === PAGE_COUNT - 1}
            aria-label="Next page"
          >
            Next →
          </button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={pageSrc(pageNumber)}
          alt={`Sample dossier page ${pageNumber}`}
          style={{ width: "100%", height: "auto", display: "block", background: "#ffffff" }}
        />
      </div>

      <aside className="viewer-side">
        <div className="panel">
          <h3>Integrity</h3>
          <p style={{ fontSize: "0.8rem", color: "var(--muted)", margin: "0 0 12px" }}>
            Verify the published PDF hash live on /verify. No account required.
          </p>
          <a
            className="btn btn-ghost"
            href={`/verify?hash=${PUBLIC_SAMPLE_DOSSIER.primaryDocumentSha256}&try=sample`}
            style={{ width: "100%", justifyContent: "center" }}
          >
            Try it on /verify
          </a>
        </div>
        <div className="panel">
          <h3>Downloads</h3>
          <ul className="toc-list">
            <li>
              <a href={PUBLIC_SAMPLE_DOSSIER.downloads.pdf} download>
                PDF
              </a>
            </li>
            <li>
              <a href={PUBLIC_SAMPLE_DOSSIER.downloads.json} download>
                JSON
              </a>
            </li>
            <li>
              <a href={PUBLIC_SAMPLE_DOSSIER.downloads.xlsx} download>
                XLSX
              </a>
            </li>
            <li>
              <a href={PUBLIC_SAMPLE_DOSSIER.downloads.registryXml} download>
                Registry XML <span className="mono">(preparation)</span>
              </a>
            </li>
            <li>
              <a href={PUBLIC_SAMPLE_DOSSIER.downloads.manifest} download>
                Integrity manifest
              </a>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
