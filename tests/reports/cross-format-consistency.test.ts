/**
 * FAZ P0 (H) — Cross-format reconciliation.
 *
 * For every sealed dossier the PDF, XLSX and JSON artifacts must tell the same
 * story: totals identical, per-good values identical, allocation identical,
 * evidence IDs identical, readiness state identical and legal/ruleset version
 * identical.
 */

import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { FOUR_DOSSIER_KEYS, FOUR_DOSSIER_RULESET } from "../fixtures/four-dossiers";
import {
  buildDossierSealedPackage,
  type DossierSealedPackage,
} from "../fixtures/four-dossier-package";

async function pdfText(bytes: Buffer): Promise<string> {
  const document = await pdfjsLib.getDocument({
    data: new Uint8Array(bytes),
    disableFontFace: true,
    standardFontDataUrl: "node_modules/pdfjs-dist/standard_fonts/",
  }).promise;
  let text = "";
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    text += content.items.map((item) => ("str" in item ? item.str : "")).join(" ") + " ";
  }
  return text;
}

async function xlsxText(bytes: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const parts: string[] = [];
  const shared = zip.files["xl/sharedStrings.xml"];
  if (shared) {
    const xml = await shared.async("string");
    parts.push(...[...xml.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((match) => match[1]!));
  }
  for (const name of Object.keys(zip.files)) {
    if (/^xl\/worksheets\/sheet\d+\.xml$/.test(name)) {
      const xml = await zip.files[name]!.async("string");
      parts.push(...[...xml.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((match) => match[1]!));
    }
  }
  return parts.join(" | ");
}

function jsonArtifactText(pkg: DossierSealedPackage): string {
  const trace = pkg.artifacts.find((item) => item.path === "Calculation Trace.json");
  return trace ? trace.bytes.toString("utf8") : "";
}

describe("cross-format reconciliation", () => {
  for (const key of FOUR_DOSSIER_KEYS) {
    it(`${key} — totals, per-good, allocation, evidence, readiness and ruleset identical across PDF/XLSX/JSON`, async () => {
      const pkg = await buildDossierSealedPackage(key);

      const pdf = await pdfText(pkg.finalized.primaryPdf);
      const xlsxArtifact = pkg.artifacts.find((item) => item.path.toLowerCase().endsWith(".xlsx"));
      expect(xlsxArtifact).toBeDefined();
      const xlsx = await xlsxText(xlsxArtifact!.bytes);
      const jsonText = jsonArtifactText(pkg);
      expect(jsonText.length).toBeGreaterThan(0);

      // Installation totals identical.
      const direct = String(pkg.caseData.directEmissions.value);
      const electricity = String(pkg.caseData.electricityConsumed.value);
      const gridFactor = String(pkg.caseData.gridEmissionFactor.value);
      expect(pdf).toContain(direct);
      expect(xlsx).toContain(direct);
      expect(jsonText).toContain(direct);
      expect(pdf).toContain(electricity);
      expect(xlsx).toContain(electricity);
      expect(pdf).toContain(gridFactor);
      expect(xlsx).toContain(gridFactor);

      // Per-good values identical.
      for (const good of pkg.caseData.goods) {
        const volume = String(good.productionVolume.value);
        expect(pdf).toContain(volume);
        expect(xlsx).toContain(volume);
        expect(jsonText).toContain(volume);
        const cn = String(good.cnCode.value);
        expect(pdf).toContain(cn);
        expect(xlsx).toContain(cn);
      }

      // Allocation identical.
      for (const good of pkg.caseData.goods) {
        if (!good.allocationShare) continue;
        const share = String(good.allocationShare.value);
        expect(pdf).toContain(share);
        expect(xlsx).toContain(share);
        expect(jsonText).toContain(share);
      }

      // Evidence IDs identical.
      for (const record of pkg.caseData.evidenceRegister) {
        expect(xlsx).toContain(record.evidenceId);
        expect(jsonText).toContain(record.evidenceId);
      }

      // Readiness state identical.
      expect(pdf).toContain("OPERATOR CHECKS PASSED");
      expect(jsonText).toContain("OPERATOR_PREPARATION_COMPLETE");
      expect(jsonText).toContain("READY_FOR_ACCREDITED_VERIFIER_ENGAGEMENT");

      // Legal / ruleset version identical.
      expect(pdf).toContain(FOUR_DOSSIER_RULESET);
      expect(xlsx).toContain(FOUR_DOSSIER_RULESET);
      expect(jsonText).toContain(FOUR_DOSSIER_RULESET);
    }, 45_000);
  }
});
