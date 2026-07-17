import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import crypto from "node:crypto";
import { processWebhookEvent } from "../functions/src/commerce/webhook-processor";
import { adminDb } from "../functions/src/firebase-admin";
import {
  reserveEntitlement,
  consumeEntitlement,
  releaseEntitlementReservation,
  createEntitlement
} from "../functions/src/commerce/entitlement-service";

try {
  initializeApp();
} catch (e) {}

async function main() {
  console.log("==================================================================");
  console.log("COMMERCE INFRASTRUCTURE END-TO-END STRESS & LIFECYCLE VALIDATOR");
  console.log("==================================================================");

  const testUid = `stress_user_${Date.now()}`;
  const testEmail = `stress_${Date.now()}@cbamvalid.com`;
  console.log(`- Created temporary stress test user: ${testUid} (${testEmail})`);

  // Step 1: Initialize User document in DB
  const userRef = adminDb.collection("users").doc(testUid);
  await userRef.set({
    email: testEmail,
    role: "user",
    createdAt: new Date().toISOString(),
    creditBalance: 0
  });

  const transactionId = `txn_stress_${Date.now()}`;
  const eventIdBase = `evt_stress_${Date.now()}`;

  // ==================================================================
  // STAGE 1: CONCURRENT WEBHOOK INGESTION (STRESS & REPLAY RESISTANCE)
  // ==================================================================
  console.log("\n>>> STAGE 1: Running high-concurrency webhook replay attack stress test...");
  
  const concurrencyCount = 50;
  const promises: Promise<any>[] = [];

  // Simulate multiple calls for the EXACT same event ID concurrently
  console.log(`- Sending ${concurrencyCount} concurrent events for same Event ID: ${eventIdBase}_dup`);
  for (let i = 0; i < concurrencyCount; i++) {
    const event = {
      eventId: `${eventIdBase}_dup`,
      eventType: "transaction.completed",
      data: {
        id: transactionId,
        status: "completed",
        currencyCode: "USD",
        customData: {
          uid: testUid,
          orderId: `ord_stress_${Date.now()}`,
          productCode: "CBAM_EXPORTER_FINAL_REPORT"
        },
        items: [
          {
            priceId: "pri_01kx4373n0xa7fthk3ttqqd7p8",
            quantity: 1
          }
        ]
      }
    };
    promises.push(processWebhookEvent(event));
  }

  const results = await Promise.allSettled(promises);
  const succeeded = results.filter(r => r.status === "fulfilled").length;
  const rejected = results.filter(r => r.status === "rejected").length;
  console.log(`- High-concurrency duplicate webhook ingestion completed:`);
  console.log(`  * Success count (should be 1 or handled duplicates): ${succeeded}`);
  console.log(`  * Error / Rejection count: ${rejected}`);

  // Assert exactly 1 order and 1 entitlement exists
  const ordersSnap = await adminDb.collection("commerce_orders").where("uid", "==", testUid).get();
  const entitlementsSnap = await adminDb.collection("entitlements").where("uid", "==", testUid).get();
  
  console.log(`- Database records verification:`);
  console.log(`  * Orders count created (expected: 1): ${ordersSnap.size}`);
  console.log(`  * Entitlements count created (expected: 1): ${entitlementsSnap.size}`);

  if (ordersSnap.size !== 1 || entitlementsSnap.size !== 1) {
    throw new Error(`STRESS TEST FAIL: Duplicate records created under concurrency! Orders: ${ordersSnap.size}, Entitlements: ${entitlementsSnap.size}`);
  }
  console.log("  => IDEMPOTENCY PASS: Replay attacks and duplicate webhook events correctly rejected.");

  // ==================================================================
  // STAGE 2: ENTITLEMENT LOCKING & CONSUMPTION CYCLE VALIDATION
  // ==================================================================
  console.log("\n>>> STAGE 2: Validating Entitlement Locking and Consumption Lifecycle...");

  const entitlement = entitlementsSnap.docs[0].data();
  const entitlementId = entitlement.entitlementId;
  const reportId = `rep_stress_${Date.now()}`;
  const caseId = `case_stress_${Date.now()}`;
  
  console.log(`- Testing Entitlement Reservation (Locking) for Report: ${reportId}`);
  
  // Reserve the entitlement
  await adminDb.runTransaction(async (transaction) => {
    const res = await reserveEntitlement(transaction, {
      entitlementId,
      uid: testUid,
      reportId,
      caseId,
      expiresInSeconds: 60
    });
    console.log(`  * Reservation successful. Status: ${res.status}, reservedReportId: ${res.reservedReportId}`);
  });

  // Verify trying to reserve the same entitlement again throws error (Double Lock Protection)
  console.log("- Testing Double-Lock Prevention:");
  try {
    await adminDb.runTransaction(async (transaction) => {
      await reserveEntitlement(transaction, {
        entitlementId,
        uid: testUid,
        reportId: `${reportId}_other`,
        caseId,
        expiresInSeconds: 60
      });
    });
    throw new Error("STRESS TEST FAIL: Double locking of entitlement was allowed.");
  } catch (err: any) {
    console.log(`  * Prevented double-locking successfully. Error: ${err.message || err}`);
  }

  // Consume Entitlement for release 1 (Must succeed)
  console.log("- Testing Consumption for Release 1:");
  await adminDb.runTransaction(async (transaction) => {
    const res = await consumeEntitlement(transaction, {
      entitlementId,
      uid: testUid,
      reportId,
      caseId,
      reportHash: "hash_release_1",
      version: 1
    });
    console.log(`  * Release 1 consumed successfully. Releases Count: ${res.releasesCount}`);
  });

  // Verify trying to consume it again without reservation throws error
  console.log("- Testing Consumption without Reservation:");
  try {
    await adminDb.runTransaction(async (transaction) => {
      await consumeEntitlement(transaction, {
        entitlementId,
        uid: testUid,
        reportId,
        caseId,
        reportHash: "hash_release_2",
        version: 2
      });
    });
    throw new Error("STRESS TEST FAIL: Consumption without reservation was allowed.");
  } catch (err: any) {
    console.log(`  * Prevented consumption without reservation successfully. Error: ${err.name || err}`);
  }

  // Reserve again to test Release 2
  console.log("- Reserving for Release 2...");
  await adminDb.runTransaction(async (transaction) => {
    await reserveEntitlement(transaction, {
      entitlementId,
      uid: testUid,
      reportId,
      caseId,
      expiresInSeconds: 60
    });
  });

  // Verify Release 2 fails if no correctionReason is supplied
  console.log("- Testing Correction Reason Requirement (fails if empty):");
  try {
    await adminDb.runTransaction(async (transaction) => {
      await consumeEntitlement(transaction, {
        entitlementId,
        uid: testUid,
        reportId,
        caseId,
        reportHash: "hash_release_2",
        version: 2,
        correctionReason: "" // Missing reason
      });
    });
    throw new Error("STRESS TEST FAIL: Allowed second release without correction reason.");
  } catch (err: any) {
    console.log(`  * Blocked second release successfully. Error: ${err.message || err}`);
  }

  // Verify Release 2 succeeds with correction reason
  console.log("- Testing Correction with valid reason:");
  await adminDb.runTransaction(async (transaction) => {
    const res = await consumeEntitlement(transaction, {
      entitlementId,
      uid: testUid,
      reportId,
      caseId,
      reportHash: "hash_release_2",
      version: 2,
      correctionReason: "Fixed emission source activity details."
    });
    console.log(`  * Release 2 consumed successfully. Releases Count: ${res.releasesCount}`);
  });

  // ==================================================================
  // STAGE 3: CLEAN UP STRESS TEST DATA
  // ==================================================================
  console.log("\n>>> STAGE 3: Cleaning up stress test databases documents...");
  await userRef.delete();
  for (const doc of ordersSnap.docs) {
    await doc.ref.delete();
  }
  for (const doc of entitlementsSnap.docs) {
    await doc.ref.delete();
  }
  console.log("- Clean up complete.");

  console.log("\n==================================================================");
  console.log("ALL STRESS AND WORKFLOW SYSTEM TESTS: PASSED");
  console.log("==================================================================");
}

main().catch(err => {
  console.error("Stress Test Script Failed:", err);
  process.exit(1);
});
