/**
 * G-17 — PDF/A-3b archive hardening: embedded source data round-trip.
 *
 * A generated PDF receives the data integrity manifest, calculation trace and
 * verification CLI as embedded attachments plus PDF/A XMP metadata. The
 * attachments are then extracted programmatically and their hashes must match
 * the originals — the document carries its own proof.
 *
 * Evidence: artifacts/gates/G-17/pdf-embedded-attachments-report.json
 */
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import { PDFDocument, PDFName } from "pdf-lib";
import {
  embedArchiveAttachments,
  embedXmpMetadata,
  extractArchiveAttachments,
  buildArchiveXmpMetadata,
  type ArchiveAttachment,
} from "../../functions/src/cbam/report/v6/pdf-archive-embeddings";

const ARTIFACT_DIR = join(process.cwd(), "artifacts", "gates", "G-17");

function sha256(bytes: Uint8Array): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

async function buildSampleMasterRecordPdf(): Promise<Uint8Array> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setFontSize(19);
  doc.text("CBAMValid Enterprise Compliance Master Record", 56, 72);
  doc.setFontSize(10.5);
  doc.text("Schema: CBAMVALID-DOSSIER-7.0  Engine: 4.1.0", 56, 96);
  doc.text("Dossier independent verification package — G-17 archive test", 56, 112);
  return new Uint8Array(doc.output("arraybuffer"));
}

const MANIFEST_JSON = Buffer.from(
  JSON.stringify({
    schemaVersion: "CBAMVALID-DOSSIER-7.0",
    files: [{ path: "Calculation Trace.json", sha256: "a".repeat(64) }],
  }),
  "utf8"
);
const TRACE_JSON = Buffer.from(
  JSON.stringify({ calculation: { calculationRootHash: "b".repeat(64), trace: [] } }),
  "utf8"
);
const VERIFY_CLI = Buffer.from("#!/usr/bin/env node\n// CBAMValid offline verifier (G-20)\n", "utf8");

const ATTACHMENTS: readonly ArchiveAttachment[] = [
  {
    fileName: "Data_Integrity_Manifest.json",
    mimeType: "application/json",
    description: "Data integrity manifest",
    bytes: MANIFEST_JSON,
  },
  {
    fileName: "Calculation_Trace.json",
    mimeType: "application/json",
    description: "Calculation trace",
    bytes: TRACE_JSON,
  },
  {
    fileName: "verify/cli.js",
    mimeType: "text/javascript",
    description: "Offline verification CLI",
    bytes: VERIFY_CLI,
  },
];

describe("G-17 pdf-embedded-attachments", () => {
  it("embeds the manifest, trace and verify CLI as PDF/A-3b attachments", async () => {
    const basePdf = await buildSampleMasterRecordPdf();
    const withAttachments = await embedArchiveAttachments(basePdf, ATTACHMENTS);
    const extracted = await extractArchiveAttachments(withAttachments);
    expect(extracted).toHaveLength(ATTACHMENTS.length);

    for (const attachment of ATTACHMENTS) {
      const roundTrip = extracted.find((entry) => entry.fileName === attachment.fileName);
      expect(roundTrip, `missing embedded file ${attachment.fileName}`).toBeDefined();
      expect(sha256(roundTrip!.bytes)).toBe(sha256(attachment.bytes));
    }
  });

  it("attaches PDF/A XMP metadata with the mandatory cbamvalid fields", async () => {
    const basePdf = await buildSampleMasterRecordPdf();
    const xmp = buildArchiveXmpMetadata({
      title: "Enterprise Compliance Master Record",
      creator: "CBAMValid",
      description: "Sealed dossier verification record",
      producer: "CBAMValid PDF/A-3b archive builder",
      createDate: "2026-08-10T12:00:00Z",
      reportId: "REP-2026-0001",
      packageCode: "CBAMVALID-7.0-0001",
      calculationRootHash: "c".repeat(64),
    });
    expect(xmp).toContain("cbamvalid:reportId");
    expect(xmp).toContain("cbamvalid:packageCode");
    expect(xmp).toContain("cbamvalid:calculationRootHash");

    const withXmp = await embedXmpMetadata(basePdf, xmp);
    const reloaded = await PDFDocument.load(withXmp);
    const metadata = reloaded.catalog.lookup(PDFName.of("Metadata"));
    expect(metadata).toBeDefined();
    if (metadata) {
      const content = new TextDecoder().decode((metadata as import("pdf-lib").PDFStream).getContents());
      expect(content).toContain("cbamvalid:reportId");
      expect(content).toContain("cbamvalid:calculationRootHash");
      expect(content).toContain("<pdf:Producer>");
    }
  });

  it("keeps the PDF loadable after embedding (no structural corruption)", async () => {
    const basePdf = await buildSampleMasterRecordPdf();
    const withAttachments = await embedArchiveAttachments(basePdf, ATTACHMENTS);
    const withXmp = await embedXmpMetadata(withAttachments, buildArchiveXmpMetadata({
      title: "t",
      creator: "c",
      description: "d",
      producer: "p",
      createDate: "2026-08-10T12:00:00Z",
      reportId: "r",
      packageCode: "p",
      calculationRootHash: "c".repeat(64),
    }));
    const reloaded = await PDFDocument.load(withXmp);
    expect(reloaded.getPageCount()).toBeGreaterThan(0);
    expect(await reloaded.save()).toBeInstanceOf(Uint8Array);
  });

  it("ships the veraPDF PDF/A-3b conformance gate script", () => {
    const scriptPath = join(process.cwd(), "scripts", "gates", "verapdf-conformance-check.sh");
    const script = readFileSync(scriptPath, "utf8");
    expect(script).toContain("G-17");
    expect(script).toContain("verapdf");
    const usage = spawnSync("bash", [scriptPath], { encoding: "utf8" });
    expect(usage.status).toBe(3); // usage exit
    const run = spawnSync("bash", [scriptPath, join(ARTIFACT_DIR, "master-record-with-attachments.pdf"), "--no-write-artifact"], {
      encoding: "utf8",
    });
    // veraPDF is not installed on this machine; the gate must report KANIT_YOK
    // rather than silently passing (exit 2), or PASS when the tool is present.
    expect([0, 2]).toContain(run.status);
  });

  it("writes the G-17 evidence artifact with the extracted hashes", async () => {
    const basePdf = await buildSampleMasterRecordPdf();
    const withAttachments = await embedArchiveAttachments(basePdf, ATTACHMENTS);
    const extracted = await extractArchiveAttachments(withAttachments);
    const matches = ATTACHMENTS.map((attachment) => {
      const roundTrip = extracted.find((entry) => entry.fileName === attachment.fileName);
      const matched = roundTrip !== undefined && sha256(roundTrip.bytes) === sha256(attachment.bytes);
      return { fileName: attachment.fileName, sha256: sha256(attachment.bytes), embeddedHashMatches: matched };
    });
    mkdirSync(ARTIFACT_DIR, { recursive: true });
    writeFileSync(
      join(ARTIFACT_DIR, "pdf-embedded-attachments-report.json"),
      JSON.stringify({ attachments: matches, allMatch: matches.every((match) => match.embeddedHashMatches) }, null, 2)
    );
    writeFileSync(join(ARTIFACT_DIR, "master-record-with-attachments.pdf"), Buffer.from(withAttachments));
    expect(matches.every((match) => match.embeddedHashMatches)).toBe(true);
  });
});
