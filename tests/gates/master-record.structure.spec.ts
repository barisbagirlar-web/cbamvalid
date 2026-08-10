/**
 * G-13 — Enterprise Compliance Master Record existence and structure. D-12.
 *
 * Every sealed package carries Enterprise Compliance Master Record.pdf with
 * the complete A1-H4 section map. The rendered document stays within 30-44
 * pages, prints the mandated footer on every page and contains none of the
 * forbidden expressions. Section F4 carries at least six numbered steps.
 *
 * Evidence: section presence checklist under artifacts/gates/G-13/.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MASTER_RECORD_FILE_NAME } from "../../functions/src/cbam/report/v6/master-record-model";
import { buildMasterRecordSections } from "../../functions/src/cbam/report/v6/master-record-pdf";
import { REQUIRED_TOP_LEVEL_COMPONENTS_V6 } from "../../functions/src/cbam/report/package-components";
import { scanForbiddenStrings } from "../../functions/src/cbam/report/v6/forbidden-strings";
import { buildV6Package, masterRecordPdfText } from "./gate-helpers";

const ARTIFACT_DIR = join(process.cwd(), "artifacts", "gates", "G-13");

const MANDATED_SECTION_IDS = [
  "A1", "A2", "A3", "A4", "A5",
  "B1", "B2", "B3",
  "C1", "C2", "C3", "C4", "C5",
  "D1", "D2", "D3", "D4", "D5",
  "E1", "E2", "E3", "E4", "E5", "E6",
  "F1", "F2", "F3", "F4", "F5", "F6",
  "G1", "G2", "G3", "G4", "G5",
  "H1", "H2", "H3", "H4",
];

describe("G-13 master-record.structure", () => {
  it("is a mandatory 27th component in the sealed contract", () => {
    expect(REQUIRED_TOP_LEVEL_COMPONENTS_V6).toContain(MASTER_RECORD_FILE_NAME);
  });

  it("emits every A1-H4 section in binding order and renders within 30-44 pages", async () => {
    const built = await buildV6Package("FERTILISER_TR");
    const sections = buildMasterRecordSections(built.masterRecordModel);
    const ids = sections.map((section) => section.id);

    for (const mandated of MANDATED_SECTION_IDS) {
      expect(ids).toContain(mandated);
    }
    const mandatedIndexes = MANDATED_SECTION_IDS.map((id) => ids.indexOf(id));
    for (let index = 1; index < mandatedIndexes.length; index += 1) {
      expect(mandatedIndexes[index]!).toBeGreaterThan(mandatedIndexes[index - 1]!);
    }

    const { text, pages, bytes } = await masterRecordPdfText(built.masterRecordModel);
    expect(pages).toBeGreaterThanOrEqual(30);
    expect(pages).toBeLessThanOrEqual(44);

    // The mandated footer appears on every page.
    const footer = "Operator record. No independent verification opinion is implied.";
    expect(text.split(footer).length - 1).toBe(pages);

    // None of the forbidden expressions appear.
    expect(scanForbiddenStrings(text)).toEqual([]);

    // Section F4 carries at least six numbered steps.
    const f4 = sections.find((section) => section.id === "F4");
    const stepBlock = f4?.blocks.find((block) => block.kind === "steps");
    expect(stepBlock?.kind === "steps" ? stepBlock.steps.length : 0).toBeGreaterThanOrEqual(6);

    mkdirSync(ARTIFACT_DIR, { recursive: true });
    writeFileSync(
      join(ARTIFACT_DIR, "structure-check.json"),
      JSON.stringify(
        {
          fileName: MASTER_RECORD_FILE_NAME,
          sectionCount: ids.length,
          pages,
          bytes: bytes.byteLength,
          allMandatedPresent: MANDATED_SECTION_IDS.every((id) => ids.includes(id)),
          footerPerPage: text.split(footer).length - 1 === pages,
          forbiddenMatches: scanForbiddenStrings(text),
        },
        null,
        2
      )
    );
  });
});
