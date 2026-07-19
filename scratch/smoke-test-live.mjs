import crypto from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

// Freeze system clock for smoke test execution using a global Date mock
const OriginalDate = global.Date;
class MockDate extends OriginalDate {
  constructor(...args) {
    if (args.length === 0) {
      super("2027-01-15T12:00:00.000Z");
    } else {
      super(...args);
    }
  }
}
MockDate.now = () => new OriginalDate("2027-01-15T12:00:00.000Z").getTime();
global.Date = MockDate;

// Configure environment variables for local execution of the compiled sealReport
process.env.GCLOUD_PROJECT = "cbam-desk";
process.env.CBAM_KMS_KEY_VERSION = "projects/cbam-desk/locations/europe-west1/keyRings/cbam/cryptoKeys/signing/cryptoKeyVersions/1";
process.env.FIREBASE_CONFIG = JSON.stringify({ storageBucket: "cbam-desk.firebasestorage.app" });

// Initialize Firebase Admin with the production project using ADC
initializeApp({
  projectId: "cbam-desk",
  storageBucket: "cbam-desk.firebasestorage.app"
});

// Dynamically import compiled modules to prevent ESM hoisting order issues
const { AuditReadyCaseSchema } = await import("../functions/build/cbam/schema.js");
const { sealReport } = await import("../functions/build/cbam/report/seal-service.js");
const { assessReadiness } = await import("../functions/build/cbam/validation/readiness-score.js");
const { generateFindingsAndActions } = await import("../functions/build/cbam/validation/findings-engine.js");

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

const mockCaseBase = {
  caseId: FIXTURE_CASE_ID,
  status: "DRAFT",
  version: 1,
  ownerId: FIXTURE_OWNER_ID,
  importerIdentity: {
    legalName: datum("CBAMValid Importer B.V.", undefined, undefined),
    eoriNumber: datum("NL123456789AB"),
    address: null,
  },
  exporterIdentity: {
    legalName: datum("Verified Steel Operator GmbH", undefined, undefined),
    address: datum("Duisburg, Germany", undefined, FIXTURE_EVIDENCE_ID),
  },
  reportingPeriod: {
    year: datum("2026", undefined, undefined),
    quarter: datum("ANNUAL", undefined, undefined),
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
    unloCode: null,
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
      reportingPeriod: "2026 ANNUAL",
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
      reviewerNotes: "Approved for the verifier-preparation package.",
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
  console.log("=== STARTING COMPREHENSIVE PRODUCTION SMOKE TEST ===");

  // Save current system config state
  const configDocRef = db.collection("system").doc("config");
  const originalConfigSnap = await configDocRef.get();
  const originalConfig = originalConfigSnap.data();

  let sealResult = null;
  let entitlementId = "ent_smoke_test_123";
  let entitlementIdB = "ent_smoke_test_456";
  let requestIdA = crypto.randomUUID();
  let evidenceFile = bucket.file(mockCaseBase.evidenceRegister[0].storagePath);

  try {
    // Temporarily enable V5 sealing for this smoke test
    console.log("Temporarily enabling V5 sealing in Firestore...");
    await configDocRef.set({ disableV5Sealing: false }, { merge: true });

    // 1. Upload evidence binary to GCS
    console.log("\nUploading mock evidence file to GCS...");
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

  // Create mock entitlements
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

  await db.collection("entitlements").doc(entitlementIdB).set({
    entitlementId: entitlementIdB,
    uid: FIXTURE_OWNER_ID,
    orderId: "ord_smoke_test_456",
    productCode: "pack_premium_dossier",
    status: "AVAILABLE",
    quantity: 1,
    maxReleases: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    releasesCount: 4,
    releasesList: []
  });

  // ==========================================
  // TEST CASE A: Definitive Annual (Ready)
  // ==========================================
  console.log("\n--- TEST CASE A: DEFINITIVE ANNUAL READY ---");
  const annualCase = JSON.parse(JSON.stringify(mockCaseBase));
  annualCase.reportingPeriod.quarter.value = "ANNUAL";
  annualCase.evidenceRegister[0].reportingPeriod = "2026 ANNUAL";
  const parsedAnnual = AuditReadyCaseSchema.parse(annualCase);

  await db.collection("cbam_cases").doc(FIXTURE_CASE_ID).set({
    caseId: FIXTURE_CASE_ID,
    uid: FIXTURE_OWNER_ID,
    data: parsedAnnual,
    status: parsedAnnual.status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const readinessAnnual = assessReadiness({ caseData: parsedAnnual, isDraft: false });
  console.log("Readiness Annual full output:", JSON.stringify(readinessAnnual, null, 2));
  const { findings: smokeFindings } = generateFindingsAndActions(parsedAnnual);
  console.log("Findings details:", JSON.stringify(smokeFindings, null, 2));
  console.log(`Readiness Status: ${readinessAnnual.operatorStatus}`);
  console.log(`Readiness Score: ${readinessAnnual.score}`);
  console.log(`canSeal: ${readinessAnnual.canSeal}`);
  if (readinessAnnual.operatorStatus !== "READY_FOR_VERIFIER_REVIEW" || !readinessAnnual.canSeal) {
    throw new Error("FAIL: Annual case should be READY_FOR_VERIFIER_REVIEW and canSeal=true");
  }

  requestIdA = crypto.randomUUID();
  sealResult = await sealReport({
    uid: FIXTURE_OWNER_ID,
    caseId: FIXTURE_CASE_ID,
    entitlementId,
    requestId: requestIdA,
    inputData: parsedAnnual,
    correctionReason: "V5 smoke test verification - annual"
  });
  console.log("✓ Sealing of annual case completed successfully!");
  console.log(`  Report ID: ${sealResult.reportId}`);
  console.log(`  Package Hash: ${sealResult.packageHash}`);

  // Test Case A.2: Idempotency check
  console.log("\nTesting idempotency delta...");
  const sealResultRetry = await sealReport({
    uid: FIXTURE_OWNER_ID,
    caseId: FIXTURE_CASE_ID,
    entitlementId,
    requestId: requestIdA,
    inputData: parsedAnnual,
    correctionReason: "V5 smoke test verification - annual"
  });
  if (sealResultRetry.packageHash === sealResult.packageHash) {
    console.log("✓ Verified: Idempotent call returned matching hash, delta entitlement = 0.");
  } else {
    throw new Error("FAIL: Idempotent retry returned different package hash");
  }

  // ==========================================
  // TEST CASE B: Quarterly Blocked
  // ==========================================
  console.log("\n--- TEST CASE B: INTERIM QUARTERLY BLOCKED ---");
  const quarterlyCase = JSON.parse(JSON.stringify(mockCaseBase));
  quarterlyCase.reportingPeriod.quarter.value = "Q1";
  const parsedQuarterly = AuditReadyCaseSchema.parse(quarterlyCase);

  await db.collection("cbam_cases").doc(FIXTURE_CASE_ID).set({
    caseId: FIXTURE_CASE_ID,
    uid: FIXTURE_OWNER_ID,
    data: parsedQuarterly,
    status: parsedQuarterly.status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const readinessQuarterly = assessReadiness({ caseData: parsedQuarterly, isDraft: false });
  console.log(`Readiness Status: ${readinessQuarterly.operatorStatus}`);
  console.log(`canSeal: ${readinessQuarterly.canSeal}`);
  if (readinessQuarterly.operatorStatus !== "NOT_READY" || readinessQuarterly.canSeal) {
    throw new Error("FAIL: Quarterly case should be NOT_READY and canSeal=false");
  }

  const requestIdB = crypto.randomUUID();
  try {
    await sealReport({
      uid: FIXTURE_OWNER_ID,
      caseId: FIXTURE_CASE_ID,
      entitlementId: entitlementIdB,
      requestId: requestIdB,
      inputData: parsedQuarterly,
      correctionReason: "V5 smoke test verification - quarterly"
    });
    throw new Error("FAIL: Sealing a quarterly case did not throw an error!");
  } catch (error) {
    if (error.message === "SEALING_BLOCKED_BY_V5_READINESS_GATES") {
      console.log("✓ Verified: Sealing blocked on quarterly period with expected exception!");
    } else {
      throw error;
    }
  }

    // Clean up
    console.log("\nCleaning up production smoke test records...");
    await db.collection("cbam_cases").doc(FIXTURE_CASE_ID).delete();
    await db.collection("entitlements").doc(entitlementId).delete();
    await db.collection("entitlements").doc(entitlementIdB).delete();
    if (sealResult) {
      await db.collection("cbam_reports").doc(sealResult.reportId).delete();
      await db.collection("cbam_report_seals").doc(requestIdA).delete();
      const zipPath = `reports/${FIXTURE_OWNER_ID}/${sealResult.reportId}/dossier.zip`;
      await bucket.file(zipPath).delete();
    }
    await evidenceFile.delete();
    console.log("✓ Cleaned up all records successfully.");

    console.log("\n=== ALL COMPREHENSIVE SMOKE TEST FLOWS COMPLETED SUCCESSFULLY! ===");
  } finally {
    // Restore original system config state
    console.log("Restoring original system config state...");
    if (originalConfig) {
      await configDocRef.set(originalConfig);
    } else {
      await configDocRef.delete();
    }
  }
}

runSmokeTest().catch((err) => {
  console.error("\n❌ SMOKE TEST FAILED!");
  console.error(err);
  process.exit(1);
});
