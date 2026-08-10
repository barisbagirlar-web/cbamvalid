#!/usr/bin/env npx tsx
/**
 * Layout template renderer — CBAMValid_Master_Record_LAYOUT_TEMPLATE.pdf.
 *
 * Produces the reference layout for the Enterprise Compliance Master Record
 * from the sealed V6 renderer, alongside the binding section map used by the
 * G-13 structure gate:
 *
 *   tests/fixtures/CBAMValid_Master_Record_LAYOUT_TEMPLATE.pdf
 *   tests/fixtures/master-record-template-sections.json
 *
 * The gate test (tests/gates/master-record.structure.spec.ts) reads the JSON
 * map and requires every rendered Master Record to carry the identical
 * section id/title sequence, so the template is the single reference for the
 * A1-H4 page map. Re-run this script whenever the section map changes.
 *
 * Usage:
 *   npm run render:layout-template
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildV6Package } from "../tests/gates/gate-helpers";
import {
  buildMasterRecordPdf,
  buildMasterRecordSections,
} from "../functions/src/cbam/report/v6/master-record-pdf";

const OUT_DIR = resolve(process.cwd(), "tests", "fixtures");
const TEMPLATE_NAME = "CBAMValid_Master_Record_LAYOUT_TEMPLATE.pdf";
const SECTION_MAP_NAME = "master-record-template-sections.json";

async function main(): Promise<void> {
  const built = await buildV6Package("STEEL_IN");
  const sections = buildMasterRecordSections(built.masterRecordModel);
  const bytes = buildMasterRecordPdf(built.masterRecordModel);
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, TEMPLATE_NAME), bytes);
  writeFileSync(
    join(OUT_DIR, SECTION_MAP_NAME),
    JSON.stringify(sections.map((section) => ({ id: section.id, title: section.title })), null, 2)
  );
  console.log(
    `Layout template: ${sections.length} sections (${bytes.byteLength} bytes) → ${join(OUT_DIR, TEMPLATE_NAME)}`
  );
}

void main();
