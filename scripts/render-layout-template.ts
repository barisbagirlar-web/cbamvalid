#!/usr/bin/env npx tsx
/**
 * Layout template sync — CBAMValid_Master_Record_LAYOUT_TEMPLATE.pdf.
 *
 * The layout template is the operator's committed visual reference for the
 * Enterprise Compliance Master Record (14-page representative of the 30-section
 * A1-H4 map). It is a tracked fixture, not a generated artifact, so this script
 * no longer renders the PDF itself; it regenerates the binding section map used
 * by the G-13 structure gate:
 *
 *   tests/fixtures/CBAMValid_Master_Record_LAYOUT_TEMPLATE.pdf   (tracked)
 *   tests/fixtures/master-record-template-sections.json          (regenerated)
 *
 * The gate test (tests/gates/master-record.structure.spec.ts) reads the JSON
 * map and requires every rendered Master Record to carry the identical
 * section id/title sequence. Re-run this script whenever the section map or
 * the committed template PDF changes, then commit both files together.
 *
 * Usage:
 *   npm run render:layout-template
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildV6Package } from "../tests/gates/gate-helpers";
import { buildMasterRecordSections } from "../functions/src/cbam/report/v6/master-record-pdf";

const OUT_DIR = resolve(process.cwd(), "tests", "fixtures");
const TEMPLATE_NAME = "CBAMValid_Master_Record_LAYOUT_TEMPLATE.pdf";
const SECTION_MAP_NAME = "master-record-template-sections.json";

async function main(): Promise<void> {
  const templatePath = join(OUT_DIR, TEMPLATE_NAME);
  if (!existsSync(templatePath)) {
    throw new Error(
      `Missing layout template: ${templatePath}. The operator's visual reference must be committed before running this script.`
    );
  }
  const templateBytes = readFileSync(templatePath);
  const built = await buildV6Package("STEEL_IN");
  const sections = buildMasterRecordSections(built.masterRecordModel);
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    join(OUT_DIR, SECTION_MAP_NAME),
    JSON.stringify(sections.map((section) => ({ id: section.id, title: section.title })), null, 2)
  );
  console.log(
    `Layout template: ${sections.length} sections, template ${templateBytes.byteLength} bytes → ${templatePath}`
  );
}

void main();
