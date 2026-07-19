import crypto from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { AuditReadyCaseSchema } from "../functions/build/cbam/schema.js";
import { sealReport } from "../functions/build/cbam/report/seal-service.js";

// Configure environment variables for KMS signing
process.env.GCLOUD_PROJECT = "cbam-desk";
process.env.CBAM_KMS_KEY_VERSION = "projects/cbam-desk/locations/europe-west1/keyRings/cbam/cryptoKeys/signing/cryptoKeyVersions/1";

initializeApp({
  projectId: "cbam-desk",
  storageBucket: "cbam-desk.firebasestorage.app"
});

const db = getFirestore();
const auth = getAuth();
const bucket = getStorage().bucket("cbam-desk.firebasestorage.app");

const USER_EMAIL = "teb232@gmail.com";
const CASE_ID = "case_teb232_test_ready";
const EVIDENCE_ID = "11111111-1111-4111-8111-111111111111";
const EVIDENCE_BYTES = Buffer.from(
  "CBAMValid verifier-grade fixture evidence: monitored production, emissions, electricity, customs classification and allocation records.",
  "utf8"
);
const EVIDENCE_HASH = crypto.createHash("sha256").update(EVIDENCE_BYTES).digest("hex");

function datum(value, canonicalUnit, evidenceId = EVIDENCE_ID) {
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

async function main() {
  console.log(`Starting process for user: ${USER_EMAIL}...`);

  // 1. Resolve UID or create user if they don't exist
  let uid;
  try {
    const userRecord = await auth.getUserByEmail(USER_EMAIL);
    uid = userRecord.uid;
    console.log(`Found existing user with UID: ${uid}`);
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      const newUser = await auth.createUser({
        email: USER_EMAIL,
        emailVerified: true,
        displayName: "TEB232 Test User"
      });
      uid = newUser.uid;
      console.log(`Created new test user with UID: ${uid}`);
    } else {
      throw error;
    }
  }

  // 2. Define the complete, V5 passing case data
  const mockCase = {
    caseId: CASE_ID,
    status: "DRAFT",
    version: 1,
    ownerId: uid,
    importerIdentity: {
      legalName: datum("CBAMValid Importer B.V.", undefined, undefined),
      eoriNumber: datum("NL123456789AB"),
      address: null, // nullable optional field
    },
    exporterIdentity: {
      legalName: datum("Verified Steel Operator GmbH", undefined, undefined),
      address: datum("Duisburg, Germany", undefined, EVIDENCE_ID),
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
        evidenceId: EVIDENCE_ID,
        documentType: "PRIMARY_MONITORING_AND_CUSTOMS_PACKAGE",
        fileName: "verified-monitoring-package.txt",
        storagePath: `evidence/${uid}/${CASE_ID}/${EVIDENCE_ID}/verified-monitoring-package.txt`,
        mimeType: "text/plain",
        sizeBytes: EVIDENCE_BYTES.byteLength,
        issuer: "Independent Monitoring Auditor",
        issueDate: "2026-03-31",
        reportingPeriod: "2026-Q1",
        pageReference: "Controlled package pages 1-48",
        fileHash: EVIDENCE_HASH,
        uploadTimestamp: "2026-04-01T00:00:00.000Z",
        uploader: uid,
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
        evidenceIds: [EVIDENCE_ID],
        reviewStatus: "ACCEPTED",
        rulesetVersion: "EU-CBAM-DEFINITIVE-2026",
      },
      {
        decisionId: "33333333-3333-4333-8333-333333333333",
        topic: "GOODS_EMISSIONS_ALLOCATION",
        selectedMethod: "Allocate installation emissions using documented product mass shares of 0.6 and 0.4.",
        reason: "The two goods are produced in the same controlled period and the reconciled product ledger provides complete mass shares summing to one.",
        legalOrTechnicalBasis: "Commission Implementing Regulation (EU) 2025/2547 allocation and monitoring-plan requirements; controlled production ledger.",
        evidenceIds: [EVIDENCE_ID],
        reviewStatus: "ACCEPTED",
        rulesetVersion: "EU-CBAM-DEFINITIVE-2026",
      },
    ],
    auditEvents: [
      {
        eventId: "44444444-4444-4444-8444-444444444444",
        timestamp: "2026-04-01T00:00:00.000Z",
        actor: uid,
        action: "CASE_CREATED",
      },
    ],
  };

  const parsed = AuditReadyCaseSchema.parse(mockCase);

  // 3. Upload evidence to GCS
  console.log("Uploading evidence with metadata to GCS...");
  const evidenceFile = bucket.file(parsed.evidenceRegister[0].storagePath);
  await evidenceFile.save(EVIDENCE_BYTES, {
    contentType: "text/plain",
    metadata: {
      metadata: {
        ownerId: uid,
        caseId: CASE_ID,
        evidenceId: EVIDENCE_ID,
        sha256: EVIDENCE_HASH
      }
    }
  });
  console.log("Evidence uploaded successfully!");

  // 4. Save case to Firestore
  console.log("Saving case to Firestore...");
  await db.collection("cbam_cases").doc(CASE_ID).set({
    caseId: CASE_ID,
    uid: uid,
    data: parsed,
    status: parsed.status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  console.log("Case saved successfully!");

  // 5. Create or reset entitlement to AVAILABLE
  const entitlementId = `ent_teb232_${CASE_ID}`;
  console.log("Creating/refreshing available entitlement in Firestore...");
  await db.collection("entitlements").doc(entitlementId).set({
    entitlementId,
    uid: uid,
    orderId: `ord_teb232_${CASE_ID}`,
    productCode: "pack_premium_dossier",
    status: "AVAILABLE",
    quantity: 1,
    maxReleases: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    releasesCount: 4, // Sets release version to 5 (V5 path)
    releasesList: []
  });
  console.log("Entitlement created successfully!");

  // 6. Run sealReport
  const requestId = crypto.randomUUID();
  console.log("Executing sealReport...");
  const sealResult = await sealReport({
    uid,
    caseId: CASE_ID,
    entitlementId,
    requestId,
    inputData: parsed,
    correctionReason: "TEB232 test environment validation"
  });
  console.log("Sealing completed successfully!");
  console.log(`Report ID: ${sealResult.reportId}`);

  // 7. Download the generated PDF and ZIP files locally
  const pdfPath = `reports/${uid}/${sealResult.reportId}/dossier.pdf`;
  const zipPath = `reports/${uid}/${sealResult.reportId}/dossier.zip`;

  console.log("Downloading sealed PDF and ZIP files from GCS...");
  const [pdfBytes] = await bucket.file(pdfPath).download();
  const [zipBytes] = await bucket.file(zipPath).download();

  const fs = await import("node:fs");
  const path = await import("node:path");

  const artifactDir = "/Users/macair1/.gemini/antigravity/brain/760cb14f-eecd-4f18-a19e-35e8e34ad72a";
  const localPdfPath = path.join(artifactDir, "teb232_dossier.pdf");
  const localZipPath = path.join(artifactDir, "teb232_dossier.zip");

  fs.writeFileSync(localPdfPath, pdfBytes);
  fs.writeFileSync(localZipPath, zipBytes);

  console.log("\n========================================================");
  console.log("✓ SUCCESS: TEST ENVIRONMENT CASE CONFIGURED AND SEALED!");
  console.log(`User: ${USER_EMAIL} (UID: ${uid})`);
  console.log(`Case ID: ${CASE_ID}`);
  console.log(`Report ID: ${sealResult.reportId}`);
  console.log("\n--- LOCAL FILES CREATED ---");
  console.log(`PDF RAPORU: ${localPdfPath}`);
  console.log(`ZIP DOSSIER PAKETI: ${localZipPath}`);
  console.log("========================================================\n");
}

main().catch(err => {
  console.error("FAILED to configure user test case:", err);
  process.exit(1);
});
