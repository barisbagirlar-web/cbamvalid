/**
 * Premium 101 report contract.
 *
 * This gate evaluates the customer-facing primary dossier rather than merely
 * checking that a PDF file exists. The report must remain honest about the
 * operator / independent-verifier boundary while presenting a complete,
 * premium, decision-ready and reproducible assurance package.
 */

import { describe, expect, it } from "vitest";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { FOUR_DOSSIER_KEYS } from "../fixtures/four-dossiers";
import { buildDossierSealedPackage } from "../fixtures/four-dossier-package";

type PageReview = {
  page: number;
  text: string;
  textItems: number;
  clippedItems: number;
};

async function reviewPdf(bytes: Buffer): Promise<{
  pages: PageReview[];
  text: string;
  hasOutline: boolean;
}> {
  const document = await pdfjsLib.getDocument({
    data: new Uint8Array(bytes),
    disableFontFace: true,
    standardFontDataUrl: "node_modules/pdfjs-dist/standard_fonts/",
  }).promise;
  const outline = await document.getOutline().catch(() => null);
  const pages: PageReview[] = [];
  let fullText = "";

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });
    const items = content.items.filter((item) => "str" in item && item.str.trim());
    let clippedItems = 0;
    let pageText = "";

    for (const item of items) {
      const tx = (item as { transform?: number[] }).transform;
      if (tx) {
        const x = tx[4];
        const y = tx[5];
        if (x < -50 || x > viewport.width + 50 || y < -50 || y > viewport.height + 50) {
          clippedItems += 1;
        }
      }
      pageText += `${"str" in item ? item.str : ""} `;
    }

    pages.push({
      page: pageNumber,
      text: pageText,
      textItems: items.length,
      clippedItems,
    });
    fullText += pageText;
  }

  return {
    pages,
    text: fullText,
    hasOutline: Array.isArray(outline) && outline.length >= 10,
  };
}

const REQUIRED_SECTIONS = [
  "Executive assurance dashboard",
  "Controlled identity and reporting period",
  "Emissions result and A-H reconciliation",
  "Goods allocation and materiality",
  "Evidence assurance and data provenance",
  "Calculation reproducibility and audit trail",
  "Findings and corrective actions",
  "Regulatory and registry crosswalk",
  "Premium chapter contract",
  "Independent verifier handover",
  "Package integrity and release control",
  "Annex index and legal boundary",
];

const FORBIDDEN_MARKERS = [
  "DIAGNOSTIC SCORE",
  "NOT_AVAILABLE",
  "UNAVAILABLE",
  "NOT_PROVIDED",
  "sandbox.cbamvalid.com",
  "case_alu_cn_fixture",
  "case_steel_in_fixture",
  "case_cement_eg_fixture",
  "case_fertiliser_tr_fixture",
  "READY_FOR_ACCREDITED_VERIFIER_ENGAGEMENT",
  "PENDING_EXTERNAL_VERIFIER",
  "SECURE TRUST STAMP",
  "SYNTHETIC TEST EVIDENCE",
  "STRESS TEST",
  "undefined",
  "NaN",
  "\uFFFD",
];

describe("premium 101 report contract", () => {
  for (const key of FOUR_DOSSIER_KEYS) {
    it(`${key} — renders a premium, honest and verifier-reproducible primary dossier`, async () => {
      const pkg = await buildDossierSealedPackage(key);
      const review = await reviewPdf(pkg.finalized.primaryPdf);

      expect(review.pages.length).toBeGreaterThanOrEqual(12);
      expect(review.pages.length).toBeLessThanOrEqual(45);
      expect(review.hasOutline).toBe(true);
      expect(review.pages.filter((page) => page.textItems === 0)).toEqual([]);
      expect(review.pages.reduce((sum, page) => sum + page.clippedItems, 0)).toBe(0);
      expect(review.pages.every((page) => page.textItems >= 5)).toBe(true);

      expect(review.text).toContain("OPERATOR PREPARATION");
      expect(review.text).toContain("EVIDENCE ASSURANCE");
      expect(review.text).toContain("PACKAGE INTEGRITY");
      expect(review.text).toContain("External verifier completion");
      expect(review.text).toContain("NOT REVIEWED - PENDING");
      expect(review.text).toContain("Certificate-relevant direct total");
      expect(review.text).toContain("Total informational embedded emissions");
      expect(review.text).toContain("Allocation reconciliation delta");
      expect(review.text).toContain("5% verifier planning reference");
      expect(review.text).toContain("Data Integrity Manifest.json");
      expect(review.text).toContain("Verifier Workspace.xlsx");
      expect(review.text).toContain("Regulation (EU) 2023/956");
      expect(review.text).toContain("2025/2547");

      for (const section of REQUIRED_SECTIONS) expect(review.text).toContain(section);
      for (const marker of FORBIDDEN_MARKERS) {
        expect(review.text, `${key} must not expose ${marker}`).not.toContain(marker);
      }

      expect(review.text).toContain(String(pkg.caseData.exporterIdentity.legalName.value));
      expect(review.text).toContain(String(pkg.caseData.importerIdentity.legalName.value));
      expect(review.text).toContain(String(pkg.caseData.installation.name.value));
      expect(review.text).toContain(String(pkg.caseData.directEmissions.value));
      expect(review.text).toContain(String(pkg.caseData.electricityConsumed.value));
      for (const precursor of pkg.caseData.precursors) {
        expect(review.text).toContain(String(precursor.quantity.value));
      }

      const rawPdf = pkg.finalized.primaryPdf.toString("latin1");
      expect(rawPdf).toMatch(/\/Type\s*\/Font/);
      expect(rawPdf).toMatch(/\/BaseFont\s*\/Helvetica/);
      expect(rawPdf).toMatch(/\/FontFile2/);
    }, 60_000);
  }
});
