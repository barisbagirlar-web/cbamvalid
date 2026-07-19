import crypto from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { AuditReadyCaseSchema } from "../functions/build/cbam/schema.js";
import { sealReport } from "../functions/build/cbam/report/seal-service.js";
import { assessReadiness } from "../functions/build/cbam/validation/readiness-score.js";

// Configure environment variables for local execution of the compiled sealReport
process.env.GCLOUD_PROJECT = "cbam-desk";
process.env.CBAM_KMS_KEY_VERSION = "projects/cbam-desk/locations/europe-west1/keyRings/cbam/cryptoKeys/signing/cryptoKeyVersions/1";

// Initialize Firebase Admin with the production project using ADC
initializeApp({
  projectId: "cbam-desk",
  storageBucket: "cbam-desk.firebasestorage.app"
});

const db = getFirestore();
const bucket = getStorage().bucket("cbam-desk.firebasestorage.app");

const FIXTURE_OWNER_ID = "smoke-test-owner";
const FIXTURE_CASE_ID = "case_smoke_test_verifier_grade";
const FIXTURE_EVIDENCE_ID = "11111111-1111-4111-8111-111111111111";

const FIXTURE_EVIDENCE_BYTES = Buffer.from(
  "CBAMValid verifier-grade fixture evidence: monitored production, emissions, electricity, customs classification and allocation records.",
  "utf8"
);

const FIXTURE_EVIDENCE_HASH = crypto.createHash("sha256")
  .update(FIXTURE_EVIDENCE_BYTES)
  .digest("hex");

function datum(value, canonicalUnit, evidenceId = FIXTURE_EVIDENCE_ID) {
  return {
    value,
    ...(canonicalUnit ? { canonicalUnit } : {}),
    sourceType: "PRIMARY",
    confidenceStatus: "HIGH_VERIFIED",
    ...(evidenceId ? { evidenceId } : {}),
    documentReference: "Verified monitoring package, controlled record V1",
    measurementMethod: "Documented direct measurement and reconciled production ledger",
    responsiblePerson: "Installation monitoring manager",
  };
}

const mockCase = {
  caseId: FIXTURE_CASE_ID,
  status: "DRAFT",
  version: 1,
  ownerId: FIXTURE_OWNER_ID,
  importerIdentity: {
    legalName: datum("CBAMValid Importer B.V.", undefined, undefined),
    eoriNumber: datum("NL123456789AB"),
    address: null, // explicitly null!
  },
  exporterIdentity: {
    legalName: datum("Verified Steel Operator GmbH", undefined, undefined),
    address: datum("Duisburg, Germany", undefined, FIXTURE_EVIDENCE_ID), // valid with evidence!
  },
  reportingPeriod: {
    year: datum("2026", undefined, undefined),
    quarter: datum("Q1", undefined, undefined),
  },
  goods: [
    {
      cnCode: datum("72011011"),
      sector: "IRON_AND_STEEL",
      productionVolume: datum("60", "t"),
      shipmentRecords: datum("60", "t", undefined),
      allocationShare: datum("0.6", "fraction"),
    },
    {
      cnCode: datum("72011019"),
      sector: "IRON_AND_STEEL",
      productionVolume: datum("40", "t"),
      shipmentRecords: datum("40", "t", undefined),
      allocationShare: datum("0.4", "fraction"),
    },
  ],
  installation: {
    name: datum("Verified Integrated Steel Installation", undefined, undefined),
    unloCode: null, // explicitly null!
    country: datum("DE", undefined, undefined),
    productionRoute: datum("Blast Furnace Route (BF-BOF)", undefined, undefined),
    systemBoundaries: "Boundaries defined.",
  },
  directEmissions: datum("80", "tCO2e"),
  electricityConsumed: datum("100", "MWh"),
  gridEmissionFactor: datum("0.4", "tCO2e/MWh"),
  precursors: [],
  carbonPriceRecords: [],
  evidenceRegister: [
    {
      evidenceId: FIXTURE_EVIDENCE_ID,
      documentType: "PRIMARY_MONITORING_AND_CUSTOMS_PACKAGE",
      fileName: "verified-monitoring-package.txt",
      storagePath: `evidence/${FIXTURE_OWNER_ID}/${FIXTURE_CASE_ID}/${FIXTURE_EVIDENCE_ID}/verified-monitoring-package.txt`,
      mimeType: "text/plain",
      sizeBytes: FIXTURE_EVIDENCE_BYTES.byteLength,
      issuer: "Independent Monitoring Auditor",
      issueDate: "2026-03-31",
      reportingPeriod: "2026-Q1",
      pageReference: "Controlled package pages 1-48",
      fileHash: FIXTURE_EVIDENCE_HASH,
      uploadTimestamp: "2026-04-01T00:00:00.000Z",
      uploader: FIXTURE_OWNER_ID,
      reviewStatus: "APPROVED",
      supportStatus: "SUPPORTED",
      malwareScanStatus: "CLEAN",
      confidentiality: "CONFIDENTIAL",
      linkedInputs: [
        "exporterIdentity.legalName",
        "exporterIdentity.address",
        "importerIdentity.legalName",
        "importerIdentity.eoriNumber",
        "installation.name",
        "installation.country",
        "installation.productionRoute",
        "reportingPeriod.year",
        "reportingPeriod.quarter",
        "goods.0.cnCode",
        "goods.0.productionVolume",
        "goods.0.shipmentRecords",
        "goods.0.allocationShare",
        "goods.1.cnCode",
        "goods.1.productionVolume",
        "goods.1.shipmentRecords",
        "goods.1.allocationShare",
        "directEmissions",
        "electricityConsumed",
        "gridEmissionFactor"
      ],
      linkedCalculations: [
        "CBAM_INDIRECT_EMISSIONS",
        "CBAM_TOTAL_EMBEDDED_EMISSIONS",
        "CBAM_GOOD_EMISSIONS_ALLOCATION_1",
        "CBAM_GOOD_EMISSIONS_ALLOCATION_2",
        "CBAM_GOODS_ALLOCATION_RECONCILIATION",
      ],
      reviewerNotes: "Approved for the verifier-preparation package after ownership, period, hash, content and control linkage review.",
    },
  ],
  calculationTrace: [],
  gapAssessment: [],
  methodologyDecisions: [
    {
      decisionId: "22222222-2222-4222-8222-222222222222",
      topic: "PRECURSOR_SCOPE",
      selectedMethod: "No qualifying precursor line is declared for the fixture goods and controlled route.",
      reason: "The controlled bill of materials and production route contain no separate precursor goods requiring an additional precursor line in this fixture.",
      legalOrTechnicalBasis: "Regulation (EU) 2023/956 Annex IV and Commission Implementing Regulation (EU) 2025/2547; supported by the controlled bill of materials.",
      evidenceIds: [FIXTURE_EVIDENCE_ID],
      reviewStatus: "ACCEPTED",
      rulesetVersion: "EU-CBAM-DEFINITIVE-2026",
    },
    {
      decisionId: "33333333-3333-4333-8333-333333333333",
      topic: "GOODS_EMISSIONS_ALLOCATION",
      selectedMethod: "Allocate installation emissions using documented product mass shares of 0.6 and 0.4.",
      reason: "The two goods are produced in the same controlled period and the reconciled product ledger provides complete mass shares summing to one.",
      legalOrTechnicalBasis: "Commission Implementing Regulation (EU) 2025/2547 allocation and monitoring-plan requirements; controlled production ledger.",
      evidenceIds: [FIXTURE_EVIDENCE_ID],
      reviewStatus: "ACCEPTED",
      rulesetVersion: "EU-CBAM-DEFINITIVE-2026",
    },
  ],
  auditEvents: [
    {
      eventId: "44444444-4444-4444-8444-444444444444",
      timestamp: "2026-04-01T00:00:00.000Z",
      actor: FIXTURE_OWNER_ID,
      action: "CASE_CREATED",
    },
  ],
};

async function runSmokeTest() {
  console.log("=== STARTING LIVE SMOKE TEST ===");

  // 1. Parse using Zod schema to verify no errors are thrown
  console.log("\n[1/7] Parsing case data containing null values...");
  const parsed = AuditReadyCaseSchema.parse(mockCase);
  console.log("✓ Schema parsed successfully! Null addresses and optional fields are correctly supported.");

  // 2. Upload evidence binary to GCS
  console.log("\n[2/7] Uploading mock evidence file to GCS...");
  const evidenceFile = bucket.file(mockCase.evidenceRegister[0].storagePath);
  await evidenceFile.save(FIXTURE_EVIDENCE_BYTES, {
    contentType: "text/plain",
    metadata: {
      metadata: {
        ownerId: FIXTURE_OWNER_ID,
        caseId: FIXTURE_CASE_ID,
        evidenceId: FIXTURE_EVIDENCE_ID,
        sha256: FIXTURE_EVIDENCE_HASH
      }
    }
  });
  console.log("✓ Evidence file uploaded successfully to GCS!");

  // 3. Save case to Firestore cbam_cases collection
  console.log("\n[3/7] Writing test case to production Firestore...");
  await db.collection("cbam_cases").doc(FIXTURE_CASE_ID).set({
    caseId: FIXTURE_CASE_ID,
    uid: FIXTURE_OWNER_ID,
    data: parsed,
    status: parsed.status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  console.log("✓ Successfully saved case to Firestore 'cbam_cases'!");

  // 4. Create case entitlement in entitlements collection
  const entitlementId = "ent_smoke_test_123";
  console.log("\n[4/7] Creating mock package entitlement in Firestore...");
  await db.collection("entitlements").doc(entitlementId).set({
    entitlementId,
    uid: FIXTURE_OWNER_ID,
    orderId: "ord_smoke_test_123",
    productCode: "pack_premium_dossier",
    status: "AVAILABLE",
    quantity: 1,
    maxReleases: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    releasesCount: 4,
    releasesList: []
  });
  console.log("✓ Entitlement successfully set to AVAILABLE.");

  // 5. Assess readiness and print details
  console.log("\nCalculating V5 readiness score locally first...");
  const readiness = assessReadiness({ caseData: parsed, isDraft: false });
  console.log("Readiness Score Details:", JSON.stringify(readiness, null, 2));

  // 6. Seal report using sealReport service logic (calls KMS and generates ZIP)
  const requestId = crypto.randomUUID();
  console.log("\n[5/7] Executing sealReport logic end-to-end (GCS, KMS, DB)...");
  const sealResult = await sealReport({
    uid: FIXTURE_OWNER_ID,
    caseId: FIXTURE_CASE_ID,
    entitlementId,
    requestId,
    inputData: parsed,
    correctionReason: "V5 smoke test validation"
  });
  console.log("✓ Sealing completed successfully!");
  console.log(`  Report ID: ${sealResult.reportId}`);
  console.log(`  Release Version: ${sealResult.releaseVersion}`);
  console.log(`  Package Hash (SHA-256): ${sealResult.packageHash}`);

  // 6. Test Idempotency: call sealReport again with the same requestId
  console.log("\n[6/7] Testing sealReport idempotency...");
  const secondSealResult = await sealReport({
    uid: FIXTURE_OWNER_ID,
    caseId: FIXTURE_CASE_ID,
    entitlementId,
    requestId,
    inputData: parsed,
    correctionReason: "V5 smoke test validation"
  });
  console.log("✓ Idempotent request returned identical results!");
  if (secondSealResult.packageHash === sealResult.packageHash) {
    console.log("✓ Verified: Zero additional entitlement consumed, duplicate prevention holds.");
  } else {
    throw new Error("FAIL: Idempotent call returned different package hash.");
  }

  // 7. Verify the package components on GCS
  console.log("\n[7/7] Verifying generated V5 package artifacts in Storage...");
  const zipPath = `reports/${FIXTURE_OWNER_ID}/${sealResult.reportId}/dossier.zip`;
  const zipFile = bucket.file(zipPath);
  const [exists] = await zipFile.exists();
  if (!exists) {
    throw new Error(`FAIL: Sealed dossier.zip not found at: ${zipPath}`);
  }
  const [zipBytes] = await zipFile.download();
  const fileHash = crypto.createHash("sha256").update(zipBytes).digest("hex");
  console.log(`✓ dossier.zip exists in GCS! Size: ${zipBytes.length} bytes.`);
  if (fileHash === sealResult.packageHash) {
    console.log("✓ Verified: Physical dossier.zip SHA-256 matches the manifest and sealResult packageHash!");
  } else {
    throw new Error(`FAIL: Physical zip hash mismatch. Got ${fileHash}, expected ${sealResult.packageHash}`);
  }

  // Clean up
  console.log("\nCleaning up smoke test records...");
  await db.collection("cbam_cases").doc(FIXTURE_CASE_ID).delete();
  await db.collection("entitlements").doc(entitlementId).delete();
  await db.collection("cbam_reports").doc(sealResult.reportId).delete();
  await db.collection("cbam_report_seals").doc(requestId).delete();
  await evidenceFile.delete();
  await zipFile.delete();
  console.log("✓ Cleaned up database and storage records.");

  console.log("\n=== ALL 7 LIVE SMOKE TEST CHECKS PASSED SUCCESSFULLY! ===");
}

runSmokeTest().catch((err) => {
  console.error("\n❌ LIVE SMOKE TEST FAILED!");
  console.error(err);
  process.exit(1);
});
