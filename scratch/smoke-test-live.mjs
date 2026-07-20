import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAuth } from "firebase-admin/auth";

// Read and parse .env.local to load credentials
const envLocalPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, "utf8");
  envContent.split("\n").forEach(line => {
    const match = line.match(/^\s*([\w_]+)\s*=\s*["']?(.*?)["']?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2];
      // Unescape \n in private key
      if (key === "FIREBASE_ADMIN_PRIVATE_KEY") {
        value = value.replace(/\\n/g, "\n");
      }
      process.env[key] = value;
    }
  });
}

process.env.GCLOUD_PROJECT = "cbam-desk";
process.env.FIREBASE_CONFIG = JSON.stringify({ storageBucket: "cbam-desk.firebasestorage.app" });

const credential = process.env.FIREBASE_ADMIN_PRIVATE_KEY && process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  ? cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || "cbam-desk",
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY,
    })
  : undefined;

initializeApp({
  ...(credential ? { credential } : {}),
  projectId: "cbam-desk",
  storageBucket: "cbam-desk.firebasestorage.app"
});

const db = getFirestore();
const bucket = getStorage().bucket("cbam-desk.firebasestorage.app");
const auth = getAuth();

const FIREBASE_API_KEY = "AIzaSyD719QlNheW-iiRLbCU9TGk0yymm3QS90Q";

async function getIdToken(uid) {
  const customToken = await auth.createCustomToken(uid);
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  const data = await response.json();
  if (!data.idToken) {
    throw new Error(`Failed to get ID token: ${JSON.stringify(data)}`);
  }
  return data.idToken;
}

async function callCallableFunction(functionName, data, idToken) {
  const url = `https://europe-west1-cbam-desk.cloudfunctions.net/${functionName}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`,
    },
    body: JSON.stringify({ data }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status} calling ${functionName}: ${text}`);
  }

  const body = await response.json();
  if (body.error) {
    throw new Error(`Firebase Function error: ${JSON.stringify(body.error)}`);
  }
  return body.result;
}

function getCanonicalCaseId(uid, requestId) {
  const normalizedUid = uid.trim();
  const normalizedRequestId = requestId.trim();
  const digest = crypto.createHash("sha256")
    .update(`${normalizedUid}\u0000${normalizedRequestId}`)
    .digest("hex");
  return `case_${digest}`;
}

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

async function runSmokeTest() {
  console.log("=== STARTING LIVE PRODUCTION DEPLOYED SMOKE TEST ===");

  // Resolve user teb232@gmail.com
  let user;
  try {
    user = await auth.getUserByEmail("teb232@gmail.com");
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      console.log("Creating test user teb232@gmail.com...");
      user = await auth.createUser({
        email: "teb232@gmail.com",
        emailVerified: true,
        password: "password123",
      });
    } else {
      throw error;
    }
  }
  const uid = user.uid;
  const idToken = await getIdToken(uid);
  console.log(`Resolved teb232@gmail.com UID: ${uid}`);

  const creationRequestId = crypto.randomUUID();
  const caseId = getCanonicalCaseId(uid, creationRequestId);

  const mockCaseBase = {
    caseId,
    status: "DRAFT",
    version: 1,
    ownerId: uid,
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
      startDate: datum("2026-01-01", undefined, FIXTURE_EVIDENCE_ID),
      endDate: datum("2026-12-31", undefined, FIXTURE_EVIDENCE_ID),
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
        storagePath: `evidence/${uid}/${caseId}/${FIXTURE_EVIDENCE_ID}/verified-monitoring-package.txt`,
        mimeType: "text/plain",
        sizeBytes: FIXTURE_EVIDENCE_BYTES.byteLength,
        issuer: "Independent Monitoring Auditor",
        issueDate: "2026-03-31",
        reportingPeriod: "2026 ANNUAL",
        pageReference: "Controlled package pages 1-48",
        fileHash: FIXTURE_EVIDENCE_HASH,
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
          "reportingPeriod.startDate",
          "reportingPeriod.endDate",
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
        actor: uid,
        action: "CASE_CREATED",
      },
    ],
  };

  // Create the case on Firebase live function to obtain a canonical caseId
  console.log("Creating case via live function...");
  const createRes = await callCallableFunction("saveCbamCase", {
    requestId: creationRequestId,
    data: mockCaseBase
  }, idToken);
  console.log(`✓ Case created successfully via live function. Case ID: ${createRes.caseId}`);

  // Save current system config state
  const configDocRef = db.collection("system").doc("config");
  const originalConfigSnap = await configDocRef.get();
  const originalConfig = originalConfigSnap.data();

  let sealResult = null;
  const entitlementId = "ent_smoke_test_teb232";
  const requestId = crypto.randomUUID();
  const evidenceFile = bucket.file(`evidence/${uid}/${caseId}/${FIXTURE_EVIDENCE_ID}/verified-monitoring-package.txt`);

  try {
    // Temporarily enable V5 sealing in Firestore
    console.log("Temporarily enabling V5 sealing in Firestore...");
    await configDocRef.set({ disableV5Sealing: false }, { merge: true });

    // Upload mock evidence file to GCS
    console.log("\nUploading mock evidence file to GCS...");
    await evidenceFile.save(FIXTURE_EVIDENCE_BYTES, {
      contentType: "text/plain",
      metadata: {
        metadata: {
          ownerId: uid,
          caseId,
          evidenceId: FIXTURE_EVIDENCE_ID,
          sha256: FIXTURE_EVIDENCE_HASH
        }
      }
    });
    console.log("✓ Evidence file uploaded successfully to GCS!");

    // Create mock entitlement
    await db.collection("entitlements").doc(entitlementId).set({
      entitlementId,
      uid,
      orderId: "ord_smoke_test_teb232",
      productCode: "pack_premium_dossier",
      status: "AVAILABLE",
      quantity: 1,
      maxReleases: 5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      releasesCount: 0,
      releasesList: []
    });

    // ==========================================
    // EXECUTE SMOKE TEST MATRIX (Cases A - I)
    // ==========================================

    const makePeriodCase = (year, quarter, startDate, endDate) => {
      const c = JSON.parse(JSON.stringify(mockCaseBase));
      c.reportingPeriod.year = datum(year, undefined, undefined);
      c.reportingPeriod.quarter = datum(quarter, undefined, undefined);
      if (startDate !== undefined) {
        c.reportingPeriod.startDate = datum(startDate, undefined, FIXTURE_EVIDENCE_ID);
      } else {
        delete c.reportingPeriod.startDate;
      }
      if (endDate !== undefined) {
        c.reportingPeriod.endDate = datum(endDate, undefined, FIXTURE_EVIDENCE_ID);
      } else {
        delete c.reportingPeriod.endDate;
      }
      return c;
    };

    const cases = {
      "Case A (2026-Q1)": makePeriodCase("2026", "Q1", "2026-01-01", "2026-03-31"),
      "Case B (2026-Q2)": makePeriodCase("2026", "Q2", "2026-04-01", "2026-06-30"),
      "Case C (one month M01)": makePeriodCase("2026", "M01", "2026-01-01", "2026-01-31"),
      "Case D (six months CUSTOM)": makePeriodCase("2026", "CUSTOM", "2026-01-01", "2026-06-30"),
      "Case E (2026 full year ANNUAL)": makePeriodCase("2026", "ANNUAL", "2026-01-01", "2026-12-31"),
      "Case F (leap-year full year ANNUAL)": makePeriodCase("2024", "ANNUAL", "2024-01-01", "2024-12-31"),
      "Case G (missing start date)": makePeriodCase("2026", "ANNUAL", undefined, "2026-12-31"),
      "Case H (missing end date)": makePeriodCase("2026", "ANNUAL", "2026-01-01", undefined),
      "Case I (end before start)": makePeriodCase("2026", "ANNUAL", "2026-12-31", "2026-01-01")
    };

    for (const [name, caseData] of Object.entries(cases)) {
      console.log(`\n--- Running validation on ${name} ---`);
      
      // Save case via live endpoint
      const saveRes = await callCallableFunction("saveCbamCase", {
        caseId,
        data: caseData
      }, idToken);
      console.log(`✓ Case saved via live function. Case ID: ${saveRes.caseId}`);

      // Retrieve case via live endpoint to verify it retrieves correctly
      const getRes = await callCallableFunction("getCbamCase", { caseId }, idToken);
      const retrieved = getRes.case;
      console.log(`✓ Case retrieved via live function. Status: ${retrieved.status}`);

      if (name === "Case E (2026 full year ANNUAL)") {
        // Case E is ready for sealing. Let's call sealCbamReport on the live API!
        console.log("Sealing Case E via live function...");
        sealResult = await callCallableFunction("sealCbamReport", {
          caseId,
          entitlementId,
          requestId,
          correctionReason: "V5 smoke test verification - Case E"
        }, idToken);
        console.log("✓ Case E sealed successfully!");
        console.log(`  Report ID: ${sealResult.report.reportId}`);
        console.log(`  Package Hash: ${sealResult.report.packageHash}`);

        // Verify credit/entitlement decrement
        const entitlementDoc = await db.collection("entitlements").doc(entitlementId).get();
        const entitlementData = entitlementDoc.data();
        console.log(`  Releases count: ${entitlementData.releasesCount} / ${entitlementData.maxReleases}`);
        if (entitlementData.releasesCount !== 1) {
          throw new Error(`FAIL: Releases count should be 1, found ${entitlementData.releasesCount}`);
        }
        console.log("✓ Verified: releasesCount decremented/incremented to 1!");

        // Assert ledger record exists
        const ledgerQuery = await db.collection("credit_ledger")
          .where("uid", "==", uid)
          .where("type", "==", "ENTITLEMENT_CONSUMED")
          .get();
        if (ledgerQuery.empty) {
          throw new Error("FAIL: No ledger record of type ENTITLEMENT_CONSUMED found");
        }
        console.log(`✓ Verified: Credit ledger recorded ENTITLEMENT_CONSUMED entry!`);

        // Test Idempotency: call sealCbamReport again with the same requestId
        console.log("Testing sealing idempotency...");
        const sealResultRetry = await callCallableFunction("sealCbamReport", {
          caseId,
          entitlementId,
          requestId,
          correctionReason: "V5 smoke test verification - Case E"
        }, idToken);
        if (sealResultRetry.report.packageHash !== sealResult.report.packageHash) {
          throw new Error("FAIL: Idempotent retry returned different package hash");
        }
        const entitlementDocRetry = await db.collection("entitlements").doc(entitlementId).get();
        if (entitlementDocRetry.data().releasesCount !== 1) {
          throw new Error(`FAIL: Releases count should remain 1 on retry, found ${entitlementDocRetry.data().releasesCount}`);
        }
        console.log("✓ Verified: Idempotent call returned matching hash, releasesCount = 1.");
      } else {
        // All other cases are blocked. sealCbamReport should fail closed and NOT consume credit!
        console.log(`Asserting sealing is blocked for ${name}...`);
        const blockRequestId = crypto.randomUUID();
        try {
          await callCallableFunction("sealCbamReport", {
            caseId,
            entitlementId,
            requestId: blockRequestId,
            correctionReason: "Blocked case sealing attempt"
          }, idToken);
          throw new Error(`FAIL: Sealing ${name} did not throw an error!`);
        } catch (error) {
          if (error.message.includes("SEALING_BLOCKED_BY_V5_READINESS_GATES")) {
            console.log(`✓ Verified: Sealing blocked for ${name} as expected.`);
          } else {
            throw error;
          }
        }
      }
    }

    // Clean up
    console.log("\nCleaning up live production smoke test records...");
    await db.collection("cbam_cases").doc(caseId).delete();
    await db.collection("entitlements").doc(entitlementId).delete();
    if (sealResult) {
      await db.collection("cbam_reports").doc(sealResult.report.reportId).delete();
      await db.collection("cbam_report_seals").doc(requestId).delete();
      const zipPath = `reports/${uid}/${sealResult.report.reportId}/dossier.zip`;
      await bucket.file(zipPath).delete();
    }
    const ledgerEntries = await db.collection("credit_ledger").where("uid", "==", uid).get();
    for (const doc of ledgerEntries.docs) {
      await doc.ref.delete();
    }
    await evidenceFile.delete();
    console.log("✓ Cleaned up all records successfully.");

    console.log("\n=== ALL COMPREHENSIVE LIVE SMOKE TEST FLOWS PASSED PERFECTLY! ===");
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
  console.error("\n❌ LIVE SMOKE TEST FAILED!");
  console.error(err);
  process.exit(1);
});
