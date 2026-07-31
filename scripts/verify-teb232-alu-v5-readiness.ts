#!/usr/bin/env npx tsx
/**
 * Canonical V5 preflight using SERVER-SIDE SSOT imports (functions/src/cbam/*).
 *
 * The live seal function at functions/src/cbam/report/seal-service.ts uses:
 *   functions/src/cbam/schema
 *   functions/src/cbam/validation/readiness-score
 *   functions/src/cbam/validation/evidence-sufficiency
 *   functions/src/cbam/validation/findings-engine
 *
 * Old preflight at lib/cbam/* is stale — this script MUST match the server path exactly.
 *
 * Usage:
 *   Release / acceptance mode (default — a NOT_READY case exits 1):
 *     npx tsx scripts/verify-teb232-alu-v5-readiness.ts
 *
 *   Diagnostic expected-block mode (exit 0 ONLY when the case is blocked AND
 *   the actual seal-blocker IDs exactly match EXPECTED_BLOCKER_IDS):
 *     EXPECT_BLOCKED=1 EXPECTED_BLOCKER_IDS=FND-...-a1,FND-...-b2 \
 *       npx tsx scripts/verify-teb232-alu-v5-readiness.ts
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import admin from "firebase-admin";
import { AuditReadyCaseSchema } from "../functions/src/cbam/schema";
import { assessReadiness } from "../functions/src/cbam/validation/readiness-score";
import { runEvidenceSufficiency } from "../functions/src/cbam/validation/evidence-sufficiency";
import { generateFindingsAndActions } from "../functions/src/cbam/validation/findings-engine";
import {
  decidePreflightExit,
  parseExpectedBlockerIds,
  resolvePreflightMode,
} from "./preflight-semantics";

const EMAIL = "teb232@gmail.com";
const UID = "r3Sv0U5YqEcLLylbw5ndwK1Zg652";
const CASE_ID = "case_73bdb993585bfb8744908fc7bf57fb60ab7a0a81c4116f12bc662a674b03eacd";

// ── Preflight mode ───────────────────────────────────────────────────────────
// Release (default): NOT_READY must exit 1 so CI cannot mistake a blocked case
// for a passing release gate.
// Diagnostic expected-block: explicit EXPECT_BLOCKED=1 with EXPECTED_BLOCKER_IDS
// — exits 0 only on an exact blocker-ID match with no unexpected blockers.
const PREFLIGHT_MODE = resolvePreflightMode(process.env);
const EXPECTED_BLOCKER_IDS = parseExpectedBlockerIds(process.env.EXPECTED_BLOCKER_IDS);

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
  const bucketName =
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucketName) throw new Error("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET_MISSING");

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: "cbam-desk",
      storageBucket: bucketName,
    });
  }

  // ── 1. Verify identity ──────────────────────────────────────────────
  const user = await admin.auth().getUserByEmail(EMAIL);
  if (user.uid !== UID) throw new Error(`UID_MISMATCH:${user.uid}`);

  // ── 2. Read live Firestore record ───────────────────────────────────
  const snapshot = await admin.firestore().collection("cbam_cases").doc(CASE_ID).get();
  if (!snapshot.exists) throw new Error("CASE_NOT_FOUND");
  const firestoreRecord = snapshot.data() || {};
  if (String(firestoreRecord.uid || "") !== UID || String(firestoreRecord.status || "") !== "DRAFT") {
    throw new Error("CASE_IDENTITY_OR_STATUS_INVALID");
  }

  // Helper to flatten Firestore Timestamps for JSON
  const flattenTimestamps = (obj: unknown): unknown => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === "object" && "toDate" in (obj as Record<string, unknown>) && typeof (obj as Record<string, unknown>).toDate === "function") {
      return (obj as { toDate(): Date }).toDate().toISOString();
    }
    if (Array.isArray(obj)) return obj.map(flattenTimestamps);
    if (typeof obj === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
        result[key] = flattenTimestamps(val);
      }
      return result;
    }
    return obj;
  };

  const rawRecord = flattenTimestamps(firestoreRecord) as Record<string, unknown>;

  // Print raw record metadata (no sensitive data)
  console.log("=== RAW FIRESTORE RECORD (top-level keys) ===");
  const meta: Record<string, unknown> = {};
  for (const key of ["projectId", "caseId", "status", "updatedAt", "installationName",
    "evidenceCount", "operatorStatus", "criticalBlockerCount",
    "missingMaterialEvidenceCount", "decisionReasonCodes"]) {
    meta[key] = rawRecord[key] ?? "NOT_IN_RECORD";
  }
  console.log(JSON.stringify(meta, null, 2));

  // Print the data subdocument shape
  const dataDoc = rawRecord.data as Record<string, unknown> | undefined;
  if (dataDoc) {
    console.log("\n=== data subdocument keys ===");
    console.log(JSON.stringify(Object.keys(dataDoc), null, 2));
    console.log("\ninstallation:", JSON.stringify(dataDoc.installation, null, 2));
    console.log("\nreportingPeriod:", JSON.stringify(dataDoc.reportingPeriod, null, 2));
    console.log("\nevidenceRegister count:", (dataDoc.evidenceRegister as unknown[])?.length ?? 0);
    console.log("\ngoods count:", (dataDoc.goods as unknown[])?.length ?? 0);
  }

  // ── 3. Parse with server-side schema ────────────────────────────────
  const caseData = AuditReadyCaseSchema.parse(dataDoc);
  const assessmentTimestamp = new Date().toISOString();

  // ── 4. Run server-side V5 gates (exactly as seal-service.ts does) ───
  const assessment = assessReadiness({ caseData, isDraft: false, assessmentTimestamp });
  const sufficiency = runEvidenceSufficiency(caseData, assessmentTimestamp);
  const { findings } = generateFindingsAndActions(caseData, assessmentTimestamp);

  // ── 5. Storage evidence integrity (bytes + hash) ────────────────────
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

  // ── 6. Compute exact seal gate condition ────────────────────────────
  // Mirror seal-service.ts line 537:
  //   readinessV5.operatorStatus === "NOT_READY" ||
  //   readinessV5.criticalBlockerCount > 0 ||
  //   readinessV5.missingMaterialEvidenceCount > 0
  const sealBlockedByV5 =
    assessment.operatorStatus === "NOT_READY" ||
    assessment.criticalBlockerCount > 0 ||
    assessment.missingMaterialEvidenceCount > 0;

  const blockingSufficiency = sufficiency.filter(
    (row) => row.blocksSealing && row.state !== "SUPPORTED"
  );
  const openBlockingFindings = findings.filter(
    (finding) =>
      finding.status === "OPEN" &&
      (finding.blocksSealing || finding.blocksOperatorReadiness)
  );

  const output = {
    result: sealBlockedByV5 ? "SERVER_V5_PREFLIGHT_FAIL" : "SERVER_V5_PREFLIGHT_PASS",
    projectId: "cbam-desk",
    caseId: CASE_ID,
    assessmentTimestamp,
    firestoreRecord: {
      status: rawRecord.status,
      updatedAt: rawRecord.updatedAt,
      dataDocKeys: dataDoc ? Object.keys(dataDoc) : "NO_DATA",
    },
    installationName: caseData.installation.name.value,
    evidenceCount: caseData.evidenceRegister.length,
    operatorStatus: assessment.operatorStatus,
    recommendedDecision: assessment.recommendedDecision,
    score: assessment.score,
    assessedCoveragePercent: assessment.assessedCoveragePercent,
    criticalBlockerCount: assessment.criticalBlockerCount,
    missingMaterialEvidenceCount: assessment.missingMaterialEvidenceCount,
    decisionReasonCodes: assessment.decisionReasonCodes,
    canSeal: assessment.canSeal,
    // ── Unsupportedsufficiency rows (matches seal-service details) ──
    blockingSufficiency: blockingSufficiency.map((row) => ({
      requirementId: row.requirementId,
      inputPath: row.inputPath,
      state: row.state,
      reasonCodes: row.reasonCodes,
      evidenceIds: row.evidenceIds,
    })),
    // ── Open findings (matches seal-service details) ──
    openBlockingFindings: openBlockingFindings.map((finding) => ({
      findingId: finding.findingId,
      ruleId: finding.ruleId,
      severity: finding.severity,
      category: finding.category,
      title: finding.title,
      description: finding.description,
      status: finding.status,
      blocksSealing: finding.blocksSealing,
    })),
    storageFailures,
    // ── Dimension-level detail ──
    dimensions: assessment.dimensions.map((d) => ({
      dimensionId: d.dimensionId,
      rawScore: d.rawScore,
      weightedScore: d.weightedScore,
      assessmentState: d.assessmentState,
      passedRequirementCount: d.passedRequirementCount,
      applicableRequirementCount: d.applicableRequirementCount,
      blockerFindingIds: d.blockerFindingIds,
      materialFindingIds: d.materialFindingIds,
    })),
  };

  console.log("\n=== V5 READINESS PREFLIGHT ===");
  console.log(JSON.stringify(output, null, 2));

  // Seal-blocker set for diagnostic matching: findings that are OPEN and
  // explicitly block sealing (same predicate the seal service enforces).
  const actualBlockerIds = [...new Set(
    openBlockingFindings
      .filter((finding) => finding.blocksSealing)
      .map((finding) => finding.findingId)
  )].sort();

  console.log(`\nPREFLIGHT_MODE=${PREFLIGHT_MODE}`);

  const exitDecision = decidePreflightExit({
    mode: PREFLIGHT_MODE,
    sealBlockedByV5,
    actualBlockerIds,
    expectedBlockerIds: EXPECTED_BLOCKER_IDS,
  });

  console.log(`PREFLIGHT_RESULT=${exitDecision.result}`);
  console.log(`ACTUAL_BLOCKER_IDS=${actualBlockerIds.join(",")}`);
  console.log(`EXPECTED_BLOCKER_IDS=${EXPECTED_BLOCKER_IDS.join(",")}`);
  console.log(`MISSING_BLOCKER_IDS=${exitDecision.missing.join(",")}`);
  console.log(`UNEXPECTED_BLOCKER_IDS=${exitDecision.unexpected.join(",")}`);

  if (exitDecision.result === "RELEASE_ACCEPTANCE_CASE_NOT_READY") {
    console.log("⛔ SEAL BLOCKED BY V5 READINESS GATES");
    console.log("operatorStatus:", assessment.operatorStatus);
    console.log("criticalBlockerCount:", assessment.criticalBlockerCount);
    console.log("missingMaterialEvidenceCount:", assessment.missingMaterialEvidenceCount);
    console.log("decisionReasonCodes:", assessment.decisionReasonCodes);
  } else if (exitDecision.result === "RELEASE_ACCEPTANCE_CASE_READY") {
    console.log("\n✅ SERVER_V5_PREFLIGHT_PASS — seal gates are clear");
  } else if (exitDecision.result === "DIAGNOSTIC_EXPECTED_BLOCK_MATCHED") {
    console.log("✅ Diagnostic expected-block confirmed: blocker IDs exactly matched.");
  } else if (exitDecision.result === "DIAGNOSTIC_EXPECTED_BLOCK_ACTUAL_PASS") {
    console.error("Expected a blocked case for diagnostics but the V5 seal gates are clear.");
  } else if (exitDecision.result === "DIAGNOSTIC_EXPECTED_BLOCKER_IDS_REQUIRED") {
    console.error("EXPECT_BLOCKED=1 requires EXPECTED_BLOCKER_IDS to be set (comma-separated).");
  } else {
    console.error("Diagnostic blocker-ID mismatch — refusing to report success.");
  }

  process.exitCode = exitDecision.exitCode;
}

void main().catch((error) => {
  console.error(JSON.stringify(
    {
      result: "SERVER_V5_PREFLIGHT_ERROR",
      code: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    },
    null,
    2
  ));
  process.exitCode = 1;
});
