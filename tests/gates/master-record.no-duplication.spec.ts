/**
 * G-13 — no duplication. INV-01.
 *
 * The Enterprise Compliance Master Record is a distinct operator record, not a
 * copy of the verifier dossier. The proportion of byte-identical paragraphs
 * between the two documents must not exceed 35%.
 */
import { describe, expect, it } from "vitest";
import { buildDossierSealedPackage } from "../fixtures/four-dossier-package";
import { buildV6Package, masterRecordPdfText } from "./gate-helpers";

const DOSSIER_PDF_PATH = "CBAMValid Verification Readiness & Evidence Assurance Dossier.pdf";

function normalizedSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/g)
    .map((sentence) => sentence.replace(/\s+/g, " ").trim().toLowerCase())
    .filter((sentence) => sentence.length >= 25);
}

describe("G-13 master-record.no-duplication", () => {
  it("keeps the Master Record under the 35% identical-paragraph ceiling vs the dossier", async () => {
    const built = await buildV6Package("STEEL_IN");
    const master = await masterRecordPdfText(built.masterRecordModel);

    const sealed = await buildDossierSealedPackage("STEEL_IN");
    const dossierArtifact = sealed.artifacts.find((item) => item.path === DOSSIER_PDF_PATH);
    expect(dossierArtifact).toBeDefined();

    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const dossierDocument = await pdfjs.getDocument({
      data: new Uint8Array(dossierArtifact!.bytes),
      disableFontFace: true,
      standardFontDataUrl: "node_modules/pdfjs-dist/standard_fonts/",
    }).promise;
    let dossierText = "";
    for (let pageNumber = 1; pageNumber <= dossierDocument.numPages; pageNumber += 1) {
      const page = await dossierDocument.getPage(pageNumber);
      const content = await page.getTextContent();
      dossierText += content.items.map((item) => ("str" in item ? item.str : "")).join(" ") + " ";
    }

    const masterSentences = normalizedSentences(master.text);
    const dossierSet = new Set(normalizedSentences(dossierText));
    const identical = masterSentences.filter((sentence) => dossierSet.has(sentence)).length;
    const ratio = masterSentences.length > 0 ? identical / masterSentences.length : 0;

    expect(ratio).toBeLessThanOrEqual(0.35);
  });
});
