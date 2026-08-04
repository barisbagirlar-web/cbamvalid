#!/usr/bin/env npx tsx

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const ROOT = resolve(process.cwd(), "artifacts", "499-usd-release");
const EVIDENCE_PATH = resolve(ROOT, "release-evidence.json");
const EVIDENCE_HASH_PATH = resolve(ROOT, "release-evidence.sha256");
const REPORT_DIRS = [
  "STEEL_IN",
  "CEMENT_EG",
  "ALU_CN",
  "FERTILISER_TR",
  "FUTURE_WORKING_FILE_ALU_CN",
] as const;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

async function pdfText(path: string): Promise<string> {
  const bytes = readFileSync(path);
  const document = await pdfjsLib.getDocument({
    data: new Uint8Array(bytes),
    disableFontFace: true,
    standardFontDataUrl: "node_modules/pdfjs-dist/standard_fonts/",
  }).promise;
  let text = "";
  for (let page = 1; page <= document.numPages; page += 1) {
    const content = await (await document.getPage(page)).getTextContent();
    text += " " + content.items
      .filter((item) => "str" in item)
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
  }
  return normalize(text);
}

/**
 * The section title also appears in the table of contents. Use the last title
 * occurrence so the guard inspects the rendered handover page, not the TOC.
 */
function finalSection(text: string, start: string, end: string): string {
  const startIndex = text.lastIndexOf(start);
  if (startIndex < 0) return "";
  const endIndex = text.indexOf(end, startIndex + start.length);
  return text.slice(startIndex, endIndex < 0 ? undefined : endIndex);
}

async function main(): Promise<void> {
  const failures: string[] = [];
  const passes: string[] = [];

  for (const directory of REPORT_DIRS) {
    const text = await pdfText(resolve(ROOT, directory, "primary-report.pdf"));
    const pending = /NOT REVIEWED\s*-\s*PENDING/i.test(text);
    const handover = finalSection(
      text,
      "Independent verifier handover",
      "Package integrity and release control"
    );

    if (!pending) {
      passes.push(`${directory}: independent-verifier status is not pending`);
      continue;
    }

    if (!/External verifier completion\s+0\/7/i.test(text)) {
      failures.push(`${directory}: NOT REVIEWED - PENDING but external completion is not 0/7`);
    } else {
      passes.push(`${directory}: pending external completion = 0/7`);
    }

    if (!handover) {
      failures.push(`${directory}: verifier handover section missing`);
    } else {
      if (/\bRecorded\b/i.test(handover)) {
        failures.push(`${directory}: pending verifier handover contains Recorded status`);
      } else {
        passes.push(`${directory}: pending handover contains no Recorded status`);
      }
      const pendingCount = (handover.match(/\bPENDING\b/gi) ?? []).length;
      if (pendingCount !== 7) {
        failures.push(`${directory}: pending handover rows ${pendingCount}/7`);
      } else {
        passes.push(`${directory}: all 7 handover rows pending`);
      }
    }
  }

  const evidence = JSON.parse(readFileSync(EVIDENCE_PATH, "utf8")) as {
    gates: Array<{
      id: string;
      status: "PASS" | "FAIL";
      evidence: string[];
      failures: string[];
    }>;
    releaseP0DefectCount: number;
    releaseReady: boolean;
  };
  const verifierGate = evidence.gates.find(
    (gate) => gate.id === "G04_VERIFIER_BOUNDARY"
  );
  const p0Gate = evidence.gates.find((gate) => gate.id === "G10_P0");
  if (!verifierGate || !p0Gate) {
    throw new Error("RELEASE_EVIDENCE_GATE_MISSING");
  }

  verifierGate.evidence.push(...passes);
  if (failures.length > 0) {
    verifierGate.status = "FAIL";
    verifierGate.failures.push(...failures);
    p0Gate.status = "FAIL";
    p0Gate.failures.push(
      ...failures.map((failure) => `G04_VERIFIER_BOUNDARY:${failure}`)
    );
    evidence.releaseP0DefectCount += failures.length;
    evidence.releaseReady = false;
  }

  const json = `${JSON.stringify(evidence, null, 2)}\n`;
  writeFileSync(EVIDENCE_PATH, json);
  writeFileSync(
    EVIDENCE_HASH_PATH,
    `${sha256(json)}  release-evidence.json\n`
  );

  for (const pass of passes) console.log(`PASS: ${pass}`);
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  console.log(
    `VERIFIER_STATUS_SINGLE_TRUTH=${failures.length === 0 ? "PASS" : "FAIL"}`
  );
  if (failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
