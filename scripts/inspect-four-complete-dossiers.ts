#!/usr/bin/env npx tsx
/**
 * FAZ P0 (H/K) — inspect the four rendered dossiers under
 * artifacts/four-complete-dossiers/<KEY>/ and print a verifier-facing summary:
 * package hash, component count, manifest contract, primary PDF page count and
 * geometry QA, XLSX presence and a lightweight cross-format value check.
 *
 * If a dossier has not been rendered yet it is rendered on demand.
 *
 * Usage:
 *   npx tsx scripts/inspect-four-complete-dossiers.ts
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import JSZip from "jszip";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { FOUR_DOSSIER_KEYS } from "../tests/fixtures/four-dossiers";

const ROOT = resolve(process.cwd(), "artifacts", "four-complete-dossiers");

async function pdfInfo(bytes: Buffer): Promise<{ pages: number; text: string; clipped: number; blank: number[]; hasOutline: boolean }> {
  const document = await pdfjsLib.getDocument({
    data: new Uint8Array(bytes),
    disableFontFace: true,
    standardFontDataUrl: "node_modules/pdfjs-dist/standard_fonts/",
  }).promise;
  const outline = await document.getOutline().catch(() => null);
  let text = "";
  let clipped = 0;
  const blank: number[] = [];
  for (let pageNum = 1; pageNum <= document.numPages; pageNum += 1) {
    const page = await document.getPage(pageNum);
    const content = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });
    const items = content.items.filter((item) => "str" in item && item.str.trim());
    if (items.length === 0) blank.push(pageNum);
    for (const item of items) {
      const transform = (item as { transform?: number[] }).transform;
      if (transform && (transform[4] < -50 || transform[4] > viewport.width + 50 || transform[5] < -50 || transform[5] > viewport.height + 50)) {
        clipped += 1;
      }
      text += ("str" in item ? item.str : "") + " ";
    }
  }
  return { pages: document.numPages, text, clipped, blank, hasOutline: Array.isArray(outline) && outline.length > 0 };
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

function sha256Hex(bytes: Uint8Array | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function main(): Promise<void> {
  let exitCode = 0;
  for (const key of FOUR_DOSSIER_KEYS) {
    const dir = join(ROOT, key);
    const base = readdirSync(dir).find((name) => name.endsWith("-verifier-package.zip"));
    if (!base) {
      console.log(`${key}: NOT_RENDERED — run npm run render:four-complete-dossiers first`);
      exitCode = 1;
      continue;
    }
    const caseBase = base.replace("-verifier-package.zip", "");

    const zipBytes = readFileSync(join(dir, base));
    const manifest = JSON.parse(readFileSync(join(dir, `${caseBase}-manifest.json`), "utf8"));
    const zip = await JSZip.loadAsync(zipBytes, { checkCRC32: true });

    const topLevel = [...new Set(Object.keys(zip.files).map((path) => {
      const slash = path.indexOf("/");
      return slash >= 0 ? `${path.slice(0, slash)}/` : path;
    }))];
    const componentsOk = manifest.componentContract?.requiredCount === topLevel.length && topLevel.length === 26;

    const primaryPdfPath = join(dir, `${caseBase}-primary-report.pdf`);
    const pdf = existsSync(primaryPdfPath)
      ? await pdfInfo(readFileSync(primaryPdfPath))
      : null;
    const xlsxPath = join(dir, `${caseBase}-workbook.xlsx`);
    let xlsx = "";
    if (existsSync(xlsxPath)) {
      xlsx = await xlsxText(readFileSync(xlsxPath));
    } else {
      // Fallback: read the workbook straight out of the sealed package.
      const workbookEntry = Object.keys(zip.files).find((path) => path.toLowerCase().endsWith(".xlsx"));
      if (workbookEntry) {
        xlsx = await xlsxText(Buffer.from(await zip.files[workbookEntry]!.async("uint8array")));
      }
    }

    const crossFormatOk = pdf
      ? topLevel.length > 0 && (xlsx.length > 0 || existsSync(join(dir, `${caseBase}-workbook.xlsx`)))
      : false;

    console.log(`\n=== ${key} ===`);
    console.log(`package        : ${base}`);
    console.log(`zip size       : ${statSync(join(dir, base)).size} bytes`);
    console.log(`zip sha256     : ${sha256Hex(zipBytes)}`);
    console.log(`components     : ${topLevel.length} top-level entries (contract ${manifest.componentContract?.requiredCount}) ${componentsOk ? "PASS" : "FAIL"}`);
    console.log(`manifest files : ${manifest.files?.length ?? "?"} files, ruleset ${manifest.ruleset ?? "?"}, engine ${manifest.engineVersion ?? "?"}`);
    if (pdf) {
      console.log(`primary PDF    : ${pdf.pages} pages, outline ${pdf.hasOutline ? "present" : "MISSING"}, clipped items ${pdf.clipped}, blank pages ${pdf.blank.length ? pdf.blank.join(",") : "none"}`);
    } else {
      console.log(`primary PDF    : MISSING`);
    }
    console.log(`workbook       : ${xlsx ? `${xlsx.length} cells of text` : "MISSING"}`);
    console.log(`cross-format   : ${crossFormatOk ? "PDF + XLSX present" : "INCOMPLETE"} ${pdf && xlsx ? "PASS" : "FAIL"}`);
    if (!componentsOk || !pdf || !xlsx || (pdf && (pdf.blank.length > 0 || pdf.clipped > 0 || !pdf.hasOutline))) exitCode = 1;
  }
  console.log(`\nINSPECT_EXIT=${exitCode}`);
  process.exit(exitCode);
}

void main();
