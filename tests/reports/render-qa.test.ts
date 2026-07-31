/**
 * FAZ 15 — Render QA gate.
 *
 * Renders every page of the sealed sample dossier PDF to PNG and asserts all
 * automated render-quality checks pass (blank page, page/margin overflow,
 * clipped text, broken Unicode, footer/header overlap, minimum font, missing
 * title, missing page number).
 *
 * A negative control proves the analyzer actually fails on a deliberately
 * broken PDF, so the gate cannot be green by accident.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { jsPDF } from "jspdf";
import { analyzeRenderQa, MIN_READABLE_FONT_PT } from "../../scripts/render-qa/analyze-render-qa";

const SAMPLE_DOSSIER = path.join(
  process.cwd(),
  "artifacts",
  "sample-v5",
  "CBAMValid Verification Readiness & Evidence Assurance Dossier.pdf"
);

async function tempPngDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

describe("FAZ 15 — render QA", () => {
  it("renders every page of the sealed sample dossier to PNG and passes all automated checks", async () => {
    const pdfBytes = await fs.readFile(SAMPLE_DOSSIER);
    expect(pdfBytes.length).toBeGreaterThan(50_000);

    const pngDir = await tempPngDir("render-qa-sample-");
    const result = await analyzeRenderQa(SAMPLE_DOSSIER, { pngDir });

    expect(result.pageCount).toBeGreaterThan(10);
    // Every page must have been rendered to a PNG file.
    const pngs = await fs.readdir(pngDir);
    expect(pngs.length).toBe(result.pageCount);

    for (const page of result.pages) {
      for (const [name, check] of Object.entries(page.checks)) {
        expect(check.pass, `page ${page.page} check ${name}: ${check.detail}`).toBe(true);
      }
    }
    expect(result.allPass).toBe(true);
  }, 120_000);

  it("fails closed on a deliberately broken PDF (right-margin overflow)", async () => {
    // A PDF whose single text line extends far beyond the printable width,
    // plus a body page with ink bleeding into the outer margin band.
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(20);
    doc.text("X".repeat(200), 5, 30);
    doc.addPage();
    doc.setFontSize(12);
    doc.text("margin-bleed-content", 208, 60);
    doc.text("Page 2 of 2 · CONFIDENTIAL · Report broken", 15, 100);
    const brokenPath = path.join(await tempPngDir("render-qa-broken-"), "broken.pdf");
    await fs.writeFile(brokenPath, Buffer.from(doc.output("arraybuffer")));

    const result = await analyzeRenderQa(brokenPath, { pngDir: path.dirname(brokenPath) });
    expect(result.allPass).toBe(false);
    expect(result.pages[0]?.checks.pageOverflow.pass).toBe(false);
    expect(result.pages[1]?.checks.marginOverflow.pass).toBe(false);
  }, 120_000);

  it("keeps the minimum readable font threshold above the layout floor", () => {
    // FAZ 9/15 mandate: the smallest rendered font must stay readable.
    expect(MIN_READABLE_FONT_PT).toBeGreaterThanOrEqual(5);
  });
});
