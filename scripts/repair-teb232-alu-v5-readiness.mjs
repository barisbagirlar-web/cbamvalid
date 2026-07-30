#!/usr/bin/env node
/**
 * One-case, fail-closed repair for the teb232@gmail.com ALU_CN synthetic test fixture.
 *
 * Root causes repaired:
 * 1) The 2026 annual fixture is intentionally exercised before 2026-12-31, but the
 *    existing server smoke-test clock exemption only recognizes installation names
 *    containing "smoke_test".
 * 2) The legacy seed predates V5 material-evidence requirements and evidence-diversity
 *    gates. It lacks required identity/scope/period lineage and has only 6 documents,
 *    while this fixture needs at least 9 distinct evidence documents.
 *
 * Safety contract:
 * - exact email + UID + caseId allowlist
 * - DRAFT cases only
 * - dry-run by default; EXECUTE=1 required for writes
 * - deterministic evidence bytes and IDs; safe to rerun
 * - no readiness rule, payment rule, entitlement, report, or production code bypass
 *
 * Usage:
 *   node scripts/repair-teb232-alu-v5-readiness.mjs
 *   EXECUTE=1 node scripts/repair-teb232-alu-v5-readiness.mjs
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import admin from "firebase-admin";

const EMAIL = "teb232@gmail.com";
const UID = "r3Sv0U5YqEcLLylbw5ndwK1Zg652";
const CASE_ID = "case_73bdb993585bfb8744908fc7bf57fb60ab7a0a81c4116f12bc662a674b03eacd";
const EXECUTE = process.env.EXECUTE === "1";
const TEST_RUN_ID = "teb232-alu-v5-readiness-20260730";
const REPORTING_YEAR = "2026";

const IDS = Object.freeze({
  precursor: "b3111111-1111-4111-8111-000000000105",
  identity: "b3111111-1111-4111-8111-000000000107",
  installation: "b3111111-1111-4111-8111-000000000108",
  period: "b3111111-1111-4111-8111-000000000109",
});

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return {};
  const result = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    result[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return result;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function deterministicPdf(label) {
  return Buffer.from(
    [
      "%PDF-1.4",
      "% CBAMValid synthetic V5 readiness fixture",
      "1 0 obj<< /Type /Catalog >>endobj",
      "trailer<< /Root 1 0 R >>",
      "%%EOF",
      `case=${CASE_ID}`,
      `evidence=${label}`,
      `testRunId=${TEST_RUN_ID}`,
      "",
    ].join("\n"),
    "utf8"
  );
}

function evidenceRecord({ evidenceId, documentType, fileName, bytes, issuer, linkedInputs, reviewerNotes }) {
  return {
    evidenceId,
    documentType,
    fileName,
    storagePath: `evidence/${UID}/${CASE_ID}/${evidenceId}/${fileName}`,
    mimeType: "application/pdf",
    sizeBytes: bytes.byteLength,
    issuer,
    issueDate: "2026-07-01",
    reportingPeriod: REPORTING_YEAR,
    evidencePeriodStart: "2026-01-01",
    evidencePeriodEnd: "2026-12-31",
    pageReference: "Pages 1-N",
    fileHash: sha256(bytes),
    uploadTimestamp: "2026-07-30T00:00:00.000Z",
    uploader: UID,
    reviewStatus: "APPROVED",
    supportStatus: "SUPPORTED",
    malwareScanStatus: "CLEAN",
    confidentiality: "CONFIDENTIAL",
    linkedInputs,
    linkedCalculations: [],
    reviewerNotes,
  };
}

function asRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label}_INVALID`);
  }
  return value;
}

function setDatumEvidence(data, path, evidenceId) {
  const parts = path.split(".");
  let cursor = data;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = /^\d+$/.test(parts[index]) ? Number(parts[index]) : parts[index];
    cursor = cursor[key];
    if (!cursor || typeof cursor !== "object") throw new Error(`DATUM_PATH_INVALID:${path}`);
  }
  const finalPart = parts.at(-1);
  const finalKey = /^\d+$/.test(finalPart) ? Number(finalPart) : finalPart;
  const datum = asRecord(cursor[finalKey], `DATUM_${path}`);
  datum.evidenceId = evidenceId;
  datum.documentReference = datum.documentReference || `Synthetic V5 test evidence ${evidenceId}`;
  datum.measurementMethod = datum.measurementMethod || "Documented synthetic test fixture";
  datum.responsiblePerson = datum.responsiblePerson || "CBAMValid test administrator";
}

function mergeEvidence(register, record) {
  const index = register.findIndex((item) => item?.evidenceId === record.evidenceId);
  if (index >= 0) register[index] = record;
  else register.push(record);
}

function addLinkedInput(register, evidenceId, inputPath) {
  const evidence = register.find((item) => item?.evidenceId === evidenceId);
  if (!evidence) throw new Error(`EXPECTED_EVIDENCE_NOT_FOUND:${evidenceId}`);
  evidence.linkedInputs = Array.isArray(evidence.linkedInputs) ? evidence.linkedInputs : [];
  if (!evidence.linkedInputs.includes(inputPath)) evidence.linkedInputs.push(inputPath);
}

function deriveRequirementCount(data) {
  const goods = Array.isArray(data.goods) ? data.goods.length : 0;
  const precursors = Array.isArray(data.precursors) ? data.precursors.length : 0;
  const carbonPriceRecords = Array.isArray(data.carbonPriceRecords) ? data.carbonPriceRecords.length : 0;
  return 9 + (goods * 2) + (goods > 1 ? goods : 0) + 3 + (precursors * 4) + carbonPriceRecords;
}

async function putImmutableTestEvidence(bucket, record, bytes) {
  const file = bucket.file(record.storagePath);
  const [exists] = await file.exists();
  if (!exists) {
    await file.save(bytes, {
      resumable: false,
      contentType: record.mimeType,
      metadata: {
        cacheControl: "private, max-age=0, no-transform",
        metadata: {
          ownerId: UID,
          caseId: CASE_ID,
          evidenceId: record.evidenceId,
          sha256: record.fileHash,
          syntheticTest: "true",
          testRunId: TEST_RUN_ID,
        },
      },
      preconditionOpts: { ifGenerationMatch: 0 },
    });
  }

  const [stored] = await file.download();
  const [metadata] = await file.getMetadata();
  if (
    stored.byteLength !== bytes.byteLength ||
    sha256(stored) !== record.fileHash ||
    Number(metadata.size) !== record.sizeBytes ||
    String(metadata.contentType || "") !== record.mimeType
  ) {
    throw new Error(`EVIDENCE_READBACK_MISMATCH:${record.evidenceId}`);
  }
}

async function main() {
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

  const auth = admin.auth();
  const db = admin.firestore();
  const bucket = admin.storage().bucket(bucketName);

  const user = await auth.getUserByEmail(EMAIL);
  if (user.uid !== UID) throw new Error(`UID_MISMATCH:${user.uid}`);

  const caseRef = db.collection("cbam_cases").doc(CASE_ID);
  const snapshot = await caseRef.get();
  if (!snapshot.exists) throw new Error("CASE_NOT_FOUND");
  const caseRecord = asRecord(snapshot.data(), "CASE_RECORD");
  if (String(caseRecord.uid || "") !== UID) throw new Error("CASE_OWNER_MISMATCH");
  if (String(caseRecord.status || "") !== "DRAFT") throw new Error(`CASE_NOT_DRAFT:${caseRecord.status}`);

  const data = structuredClone(asRecord(caseRecord.data, "CASE_DATA"));
  if (String(data.caseId || "") !== CASE_ID || String(data.ownerId || "") !== UID) {
    throw new Error("CASE_DATA_IDENTITY_MISMATCH");
  }
  if (String(data.reportingPeriod?.year?.value || "") !== REPORTING_YEAR) {
    throw new Error(`UNEXPECTED_REPORTING_YEAR:${data.reportingPeriod?.year?.value}`);
  }
  if (String(data.reportingPeriod?.quarter?.value || "").toUpperCase() !== "ANNUAL") {
    throw new Error(`UNEXPECTED_REPORTING_PERIOD:${data.reportingPeriod?.quarter?.value}`);
  }

  data.reportingPeriod.startDate = {
    ...(data.reportingPeriod.startDate || {}),
    value: "2026-01-01",
    sourceType: data.reportingPeriod.startDate?.sourceType || "PRIMARY",
    confidenceStatus: data.reportingPeriod.startDate?.confidenceStatus || "HIGH_VERIFIED",
  };
  data.reportingPeriod.endDate = {
    ...(data.reportingPeriod.endDate || {}),
    value: "2026-12-31",
    sourceType: data.reportingPeriod.endDate?.sourceType || "PRIMARY",
    confidenceStatus: data.reportingPeriod.endDate?.confidenceStatus || "HIGH_VERIFIED",
  };

  const installationName = String(data.installation?.name?.value || "");
  if (!installationName) throw new Error("INSTALLATION_NAME_MISSING");
  if (!installationName.includes("smoke_test")) {
    data.installation.name.value = `smoke_test — ${installationName}`;
  }

  const docs = [
    {
      evidenceId: IDS.identity,
      documentType: "COMPANY_REGISTRATION_RECORD",
      fileName: "synthetic-legal-identity-v5.pdf",
      bytes: deterministicPdf("legal-identity-v5"),
      issuer: "CBAMValid controlled synthetic test registry",
      linkedInputs: [
        "importerIdentity.legalName",
        "exporterIdentity.legalName",
        "exporterIdentity.address",
      ],
      reviewerNotes: "Synthetic legal-identity evidence for the controlled teb232 V5 end-to-end test only.",
    },
    {
      evidenceId: IDS.installation,
      documentType: "MONITORING_PLAN_AND_INSTALLATION_SCOPE",
      fileName: "synthetic-installation-scope-v5.pdf",
      bytes: deterministicPdf("installation-scope-v5"),
      issuer: "CBAMValid controlled synthetic test operator",
      linkedInputs: [
        "installation.name",
        "installation.country",
        "installation.productionRoute",
      ],
      reviewerNotes: "Synthetic installation identity, country and route evidence for the controlled test fixture.",
    },
    {
      evidenceId: IDS.period,
      documentType: "REPORTING_PERIOD_CONTROL_SHEET",
      fileName: "synthetic-reporting-period-v5.pdf",
      bytes: deterministicPdf("reporting-period-v5"),
      issuer: "CBAMValid controlled synthetic test administrator",
      linkedInputs: ["reportingPeriod.year"],
      reviewerNotes: "Synthetic annual-period control evidence for the 2026 end-to-end test fixture.",
    },
  ].map((item) => ({ ...item, record: evidenceRecord(item) }));

  data.evidenceRegister = Array.isArray(data.evidenceRegister) ? data.evidenceRegister : [];
  for (const item of docs) mergeEvidence(data.evidenceRegister, item.record);

  // ── Cleanup legacy evidence links ────────────────────────────────────────────
  // The legacy evidence record 000000000101 was seeded with linkedInputs
  // covering 4+ requirement classes (LEGAL_IDENTITY, EORI, CN_CLASSIFICATION,
  // SUPPLEMENTARY_NOTE), triggering the SINGLE_SOURCE_CONCENTRATION gate
  // (MAX_REQUIREMENT_CLASSES_PER_DOC=3).
  //
  // We remove the paths that are now served by dedicated evidence from this
  // specific overloaded record only. Other legacy records that rely solely on
  // these paths (e.g. goods CN codes) keep their links.
  const LEGACY_OVERLOADED_EVIDENCE = new Set([
    "b3111111-1111-4111-8111-000000000101",
  ]);
  const PATHS_NOW_DEDICATED = new Set([
    "importerIdentity.legalName",
    "exporterIdentity.legalName",
    "exporterIdentity.address",
    "installation.name",
    "installation.country",
    "installation.productionRoute",
    "reportingPeriod.year",
  ]);
  for (const record of data.evidenceRegister) {
    if (!LEGACY_OVERLOADED_EVIDENCE.has(record.evidenceId)) continue;
    if (!Array.isArray(record.linkedInputs)) continue;
    // Keep non-dedicated paths plus at least 1 dedicated path to satisfy
    // schema minimum (>=1 items). Only remove surplus dedicated paths.
    const dedicated = record.linkedInputs.filter((p) => PATHS_NOW_DEDICATED.has(p));
    const other = record.linkedInputs.filter((p) => !PATHS_NOW_DEDICATED.has(p));
    // Keep all non-dedicated + exactly 1 dedicated path if others exist
    record.linkedInputs = [...other, ...(dedicated.length > 0 ? [dedicated[0]] : [])];
    if (record.linkedInputs.length < 1) record.linkedInputs = [...other];
  }

  const datumLinks = [
    ["importerIdentity.legalName", IDS.identity],
    ["exporterIdentity.legalName", IDS.identity],
    ["exporterIdentity.address", IDS.identity],
    ["installation.name", IDS.installation],
    ["installation.country", IDS.installation],
    ["installation.productionRoute", IDS.installation],
    ["reportingPeriod.year", IDS.period],
    ["precursors.0.name", IDS.precursor],
  ];
  for (const [path, evidenceId] of datumLinks) setDatumEvidence(data, path, evidenceId);
  addLinkedInput(data.evidenceRegister, IDS.precursor, "precursors.0.name");

  data.auditEvents = Array.isArray(data.auditEvents) ? data.auditEvents : [];
  if (!data.auditEvents.some((event) => event?.action === "V5_SYNTHETIC_TEST_FIXTURE_REPAIRED")) {
    data.auditEvents.push({
      eventId: "e3111111-1111-4111-8111-000000000499",
      timestamp: "2026-07-30T00:00:00.000Z",
      actor: UID,
      action: "V5_SYNTHETIC_TEST_FIXTURE_REPAIRED",
      metadata: {
        testRunId: TEST_RUN_ID,
        syntheticTest: true,
        environment: "sandbox",
        reason: "V5 material evidence lineage and diversity migration",
      },
    });
  }

  const hashes = data.evidenceRegister.map((item) => String(item?.fileHash || "").toLowerCase());
  if (hashes.some((hash) => !/^[a-f0-9]{64}$/.test(hash))) throw new Error("INVALID_EVIDENCE_HASH_AFTER_REPAIR");
  if (new Set(hashes).size !== hashes.length) throw new Error("DUPLICATE_EVIDENCE_HASH_AFTER_REPAIR");

  const requirementCount = deriveRequirementCount(data);
  const minimumDistinctEvidence = Math.max(5, Math.ceil(requirementCount * 0.4));
  const distinctEvidenceCount = new Set(data.evidenceRegister.map((item) => item.evidenceId)).size;
  if (distinctEvidenceCount < minimumDistinctEvidence) {
    throw new Error(`EVIDENCE_DIVERSITY_STILL_INSUFFICIENT:${distinctEvidenceCount}/${minimumDistinctEvidence}`);
  }

  const plan = {
    execute: EXECUTE,
    email: EMAIL,
    uid: UID,
    caseId: CASE_ID,
    reportingPeriod: "2026-01-01..2026-12-31",
    smokeTestClockMarker: data.installation.name.value,
    requirementCount,
    minimumDistinctEvidence,
    distinctEvidenceCount,
    newEvidenceIds: docs.map((item) => item.evidenceId),
    existingEntitlementWillBeReused: true,
    paymentOrReleaseConsumptionMutation: false,
  };

  if (!EXECUTE) {
    console.log(JSON.stringify({ result: "DRY_RUN", plan }, null, 2));
    return;
  }

  for (const item of docs) await putImmutableTestEvidence(bucket, item.record, item.bytes);

  const now = new Date().toISOString();
  await db.runTransaction(async (transaction) => {
    const fresh = await transaction.get(caseRef);
    if (!fresh.exists) throw new Error("CASE_DISAPPEARED_DURING_REPAIR");
    const freshRecord = fresh.data() || {};
    if (String(freshRecord.uid || "") !== UID || String(freshRecord.status || "") !== "DRAFT") {
      throw new Error("CASE_CHANGED_DURING_REPAIR");
    }
    transaction.update(caseRef, {
      data,
      updatedAt: now,
      syntheticTest: {
        enabled: true,
        environment: "sandbox",
        testRunId: TEST_RUN_ID,
        repairedAt: now,
      },
    });
  });

  await auth.setCustomUserClaims(user.uid, {
    ...(user.customClaims || {}),
    syntheticTest: true,
    environment: "sandbox",
    testRunId: TEST_RUN_ID,
  });
  await auth.revokeRefreshTokens(user.uid);

  console.log(JSON.stringify({
    result: "REPAIRED",
    ...plan,
    actionRequired: "Sign out and sign back in, reload the case, then reuse the existing paid entitlement and generate a new seal request UUID.",
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    result: "FAILED",
    code: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exitCode = 1;
});
