#!/usr/bin/env npx tsx
/**
 * Canonical V5 preflight for the exact teb232 ALU synthetic test case.
 * Read-only: Firestore/Storage are never mutated.
 *
 * Usage:
 *   npx tsx scripts/verify-teb232-alu-v5-readiness.ts
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import admin from "firebase-admin";
import { AuditReadyCaseSchema } from "../lib/cbam/schema";
import { assessReadiness } from "../lib/cbam/validation/readiness-score";
import { runEvidenceSufficiency } from "../lib/cbam/validation/evidence-sufficiency";
import { generateFindingsAndActions } from "../lib/cbam/validation/findings-engine";

const EMAIL = "teb232@gmail.com";
const UID = "r3Sv0U5YqEcLLylbw5ndwK1Zg652";
const CASE_ID = "case_73bdb993585bfb8744908fc7bf57fb60ab7a0a81c4116f12bc662a674b03eacd";

function loadEnvLocal(): Record<string, string> {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return {};
  const result: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    result[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return result;
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

async function main(): Promise<void> {
  const env = loadEnvLocal();
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucketName) throw new Error("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET_MISSING");

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: "cbam-desk",
      storageBucket: bucketName,
    });
  }

  const user = await admin.auth().getUserByEmail(EMAIL);
  if (user.uid !== UID) throw new Error(`UID_MISMATCH:${user.uid}`);

  const snapshot = await admin.firestore().collection("cbam_cases").doc(CASE_ID).get();
  if (!snapshot.exists) throw new Error("CASE_NOT_FOUND");
  const record = snapshot.data() || {};
  if (String(record.uid || "") !== UID || String(record.status || "") !== "DRAFT") {
    throw new Error("CASE_IDENTITY_OR_STATUS_INVALID");
  }

  const caseData = AuditReadyCaseSchema.parse(record.data);
  const assessmentTimestamp = new Date().toISOString();
  const assessment = assessReadiness({ caseData, isDraft: false, assessmentTimestamp });
  const sufficiency = runEvidenceSufficiency(caseData, assessmentTimestamp);
  const { findings } = generateFindingsAndActions(caseData, assessmentTimestamp);

  const storageFailures: Array<Record<string, unknown>> = [];
  const bucket = admin.storage().bucket(bucketName);
  for (const evidence of caseData.evidenceRegister) {
    try {
      const file = bucket.file(evidence.storagePath);
      const [metadata] = await file.getMetadata();
      const [bytes] = await file.download();
      const actualHash = sha256(bytes);
      if (
        Number(metadata.size) !== evidence.sizeBytes ||
        String(metadata.contentType || "") !== evidence.mimeType ||
        bytes.byteLength !== evidence.sizeBytes ||
        actualHash !== evidence.fileHash.toLowerCase()
      ) {
        storageFailures.push({
          evidenceId: evidence.evidenceId,
          code: "EVIDENCE_STORAGE_METADATA_OR_HASH_MISMATCH",
          expectedSize: evidence.sizeBytes,
          actualSize: bytes.byteLength,
          expectedHash: evidence.fileHash,
          actualHash,
        });
      }
    } catch (error) {
      storageFailures.push({
        evidenceId: evidence.evidenceId,
        code: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const blockingSufficiency = sufficiency.filter((row) => row.blocksSealing && row.state !== "SUPPORTED");
  const openBlockingFindings = findings.filter(
    (finding) => finding.status === "OPEN" && (finding.blocksSealing || finding.blocksOperatorReadiness)
  );

  const passed =
    assessment.operatorStatus === "OPERATOR_PREPARATION_COMPLETE" &&
    assessment.recommendedDecision === "READY_FOR_ACCREDITED_VERIFIER_ENGAGEMENT" &&
    assessment.criticalBlockerCount === 0 &&
    assessment.missingMaterialEvidenceCount === 0 &&
    blockingSufficiency.length === 0 &&
    openBlockingFindings.length === 0 &&
    storageFailures.length === 0;

  const output = {
    result: passed ? "V5_PREFLIGHT_PASS" : "V5_PREFLIGHT_FAIL",
    assessmentTimestamp,
    caseId: CASE_ID,
    installationName: caseData.installation.name.value,
    evidenceCount: caseData.evidenceRegister.length,
    operatorStatus: assessment.operatorStatus,
    recommendedDecision: assessment.recommendedDecision,
    score: assessment.score,
    assessedCoveragePercent: assessment.assessedCoveragePercent,
    criticalBlockerCount: assessment.criticalBlockerCount,
    missingMaterialEvidenceCount: assessment.missingMaterialEvidenceCount,
    decisionReasonCodes: assessment.decisionReasonCodes,
    blockingSufficiency: blockingSufficiency.map((row) => ({
      requirementId: row.requirementId,
      inputPath: row.inputPath,
      state: row.state,
      reasonCodes: row.reasonCodes,
      evidenceIds: row.evidenceIds,
    })),
    openBlockingFindings: openBlockingFindings.map((finding) => ({
      findingId: finding.findingId,
      ruleId: finding.ruleId,
      severity: finding.severity,
      title: finding.title,
      description: finding.description,
    })),
    storageFailures,
  };

  console.log(JSON.stringify(output, null, 2));
  if (!passed) process.exitCode = 1;
}

void main().catch((error) => {
  console.error(JSON.stringify({
    result: "V5_PREFLIGHT_ERROR",
    code: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exitCode = 1;
});
