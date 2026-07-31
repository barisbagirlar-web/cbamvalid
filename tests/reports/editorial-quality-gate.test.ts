/**
 * FAZ P0 (H) — Editorial quality gate for the four dossiers.
 *
 * The primary PDF must be case-specific (no generic filler), free of
 * NOT_AVAILABLE / placeholder / broken-identifier markers, internally
 * consistent, clear on direct / precursor-direct / indirect and
 * certificate-relevant results, cite the legal basis in the right sections,
 * explain the absence of findings, and never display engineering artifacts
 * (undefined, NaN, replacement characters, STRESS markers) in commercial copy.
 */

import { describe, expect, it } from "vitest";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { FOUR_DOSSIER_KEYS } from "../fixtures/four-dossiers";
import {
  buildDossierSealedPackage,
  dossierPackageCode,
  type DossierSealedPackage,
} from "../fixtures/four-dossier-package";

async function pdfText(pkg: DossierSealedPackage): Promise<{
  text: string;
  pages: number;
}> {
  const document = await pdfjsLib.getDocument({
    data: new Uint8Array(pkg.finalized.primaryPdf),
    disableFontFace: true,
    standardFontDataUrl: "node_modules/pdfjs-dist/standard_fonts/",
  }).promise;
  let text = "";
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    text += content.items.map((item) => ("str" in item ? item.str : "")).join(" ") + " ";
  }
  return { text, pages: document.numPages };
}

const PLACEHOLDER_MARKERS = [
  "Lorem ipsum",
  "lorem ipsum",
  "TODO",
  "TBD",
  "XXX",
  "[placeholder]",
  "[PLACEHOLDER]",
  "FILL_ME",
  "NOT_AVAILABLE",
  "NOT AVAILABLE",
  "undefined",
  "NaN",
  "\uFFFD",
];

describe("editorial quality gate", () => {
  for (const key of FOUR_DOSSIER_KEYS) {
    it(`${key} — case-specific, no placeholders, consistent results and correct legal citations`, async () => {
      const pkg = await buildDossierSealedPackage(key);
      const { text } = await pdfText(pkg);

      // Case-specific content: installation and operator names must appear.
      expect(text).toContain(String(pkg.caseData.installation.name.value));
      expect(text).toContain(String(pkg.caseData.exporterIdentity.legalName.value));
      expect(text).toContain(String(pkg.caseData.importerIdentity.legalName.value));
      expect(text).toContain(String(pkg.caseData.reportingPeriod.year.value));

      // No generic filler or placeholder markers.
      for (const marker of PLACEHOLDER_MARKERS) {
        expect(text, `${key} must not contain ${marker}`).not.toContain(marker);
      }

      // Direct, precursor-direct, indirect and certificate-relevant clarity.
      expect(text).toContain("direct");
      expect(text).toContain("indirect");
      expect(text).toMatch(/certificate/i);

      // Legal basis in the report.
      expect(text).toContain("2023/956");
      expect(text).toContain("2025/2547");

      // Internally consistent installation totals (same value repeated or
      // present at least once in the results sections).
      const direct = String(pkg.caseData.directEmissions.value);
      expect(text).toContain(direct);
      const electricity = String(pkg.caseData.electricityConsumed.value);
      expect(text).toContain(electricity);

      // Precursor results surface explicitly when the case declares precursors.
      for (const precursor of pkg.caseData.precursors) {
        expect(text).toContain(String(precursor.quantity.value));
      }

      // No engineering artifacts in commercial copy (beyond the synthetic
      // evidence watermark which lives in evidence PDFs, not this report).
      expect(text).not.toContain("STRESS TEST");
      expect(text).not.toContain("SYNTHETIC TEST EVIDENCE");

      // Package identity is concrete (ISS-05): the allocated package code
      // appears on the cover and no "assigned at seal" or "—" stand-in is used.
      const packageCode = dossierPackageCode(key);
      expect(text).toContain(packageCode);
      expect(text).not.toContain("ASSIGNED_AT_SEAL");
      expect(text).not.toContain("Package ID: —");
      expect(text).not.toContain("Package ID:—");

      // Metering consistency (ISS-06): the report lists the calibration
      // certificate and never claims a calibration DATA GAP when E-03 is
      // complete. The METER_CALIBRATION_CERTIFICATE document type must be
      // recognised by Section 34.
      expect(text).not.toContain("No approved calibration certificates found");

      // Premium contract closure (ISS-04): no premium chapter gap and no E-09
      // precursor-scope DATA GAP in any of the four sealed reports — including
      // FERTILISER_TR whose decision is worded in natural operator language.
      expect(text).not.toContain("PREMIUM CONTRACT GAP");
      expect(text).not.toContain("precursor scope decision required but not accepted");
    }, 45_000);
  }
});
