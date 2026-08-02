/**
 * Four-dossier render QA.
 *
 * Every primary PDF must:
 *  - be a real, renderable multi-page document
 *  - keep every text item inside page geometry
 *  - expose a working table of contents / bookmarks outline
 *  - contain no replacement characters or blank pages
 *  - use the current four-indicator honest scoreboard, never the legacy single
 *    diagnostic score card
 */

import { describe, expect, it } from "vitest";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { FOUR_DOSSIER_KEYS } from "../fixtures/four-dossiers";
import { buildDossierSealedPackage } from "../fixtures/four-dossier-package";

interface PdfReport {
  pages: number;
  text: string;
  hasOutline: boolean;
  blankPages: number[];
  clippedItems: number;
  textItemCount: number;
}

async function analyzePdf(bytes: Buffer): Promise<PdfReport> {
  const document = await pdfjsLib.getDocument({
    data: new Uint8Array(bytes),
    disableFontFace: true,
    standardFontDataUrl: "node_modules/pdfjs-dist/standard_fonts/",
  }).promise;

  const outline = await document.getOutline().catch(() => null);
  const blankPages: number[] = [];
  let clippedItems = 0;
  let textItemCount = 0;
  let text = "";

  for (let pageNum = 1; pageNum <= document.numPages; pageNum += 1) {
    const page = await document.getPage(pageNum);
    const content = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });
    const width = viewport.width;
    const height = viewport.height;

    const pageItems = content.items.filter((item) => "str" in item && item.str.trim());
    if (pageItems.length === 0) blankPages.push(pageNum);

    for (const item of pageItems) {
      const tx = (item as { transform?: number[] }).transform;
      if (!tx) continue;
      const x = tx[4];
      const y = tx[5];
      if (x < -50 || x > width + 50 || y < -50 || y > height + 50) clippedItems += 1;
      text += ("str" in item ? item.str : "") + " ";
      textItemCount += 1;
    }
  }

  return {
    pages: document.numPages,
    text,
    hasOutline: Array.isArray(outline) && outline.length > 0,
    blankPages,
    clippedItems,
    textItemCount,
  };
}

describe("four-dossier render QA", () => {
  for (const key of FOUR_DOSSIER_KEYS) {
    it(`${key} — primary PDF renders cleanly with honest scoreboard`, async () => {
      const pkg = await buildDossierSealedPackage(key);
      const report = await analyzePdf(pkg.finalized.primaryPdf);

      expect(report.pages).toBeGreaterThanOrEqual(5);
      expect(report.blankPages).toEqual([]);
      expect(report.clippedItems).toBe(0);
      expect(report.textItemCount).toBeGreaterThan(100);
      expect(report.hasOutline).toBe(true);
      expect(report.text).not.toContain("\uFFFD");

      expect(report.text).toContain("OPERATOR PREPARATION");
      expect(report.text).toContain("EVIDENCE ASSURANCE");
      expect(report.text).toContain("PACKAGE INTEGRITY");
      expect(report.text).toContain("External verifier completion");
      expect(report.text).toContain("PENDING");
      expect(report.text).not.toContain("DIAGNOSTIC SCORE");

      const pdfBytes = pkg.finalized.primaryPdf.toString("latin1");
      expect(pdfBytes).toMatch(/\/Type\s*\/Font/);
      expect(pdfBytes).toMatch(/\/BaseFont\s*\/Helvetica/);
    }, 45_000);
  }
});
