import admin from "firebase-admin";
import crypto from "crypto";
import { adminDb } from "../firebase-admin";
import { transitionOrderStatus } from "./order-service";
import { revokeEntitlement } from "./entitlement-service";
import { writeLedgerEntry, LedgerEntry } from "./ledger-service";

function checkoutLockDocId(uid: string, caseId: string): string {
  return crypto.createHash("sha256").update(`${uid}\u0000${caseId}`).digest("hex");
}

/**
 * Handles payment adjustments and refunds asynchronously in a single Firestore transaction
 */
export async function processRefund(
  dbTransaction: admin.firestore.Transaction,
  params: {
    uid: string;
    orderId: string;
    transactionId: string;
    eventId: string;
    adjustmentId: string;
    amountMinor: number;
    currency: string;
  }
): Promise<void> {
  let reopenCaseId: string | null = null;
  let reopenUid: string | null = null;
  let reopenAfterUnusedRefund = false;

  // Firestore requires all reads to precede all writes in a transaction.
  // Fetch every document/query up front, then run writes against prefetched data.
  await adminDb.runTransaction(async (tx: admin.firestore.Transaction) => {
    const orderRef = adminDb.collection("commerce_orders").doc(params.orderId);
    const ledgerCollection = adminDb.collection("commerce_ledger");

    // ---- READ PHASE (all reads before any write) ----
    const orderSnapshot = await tx.get(orderRef);
    if (!orderSnapshot.exists) {
      console.error(`[REFUND] Order ${params.orderId} not found during refund processing.`);
      return;
    }

    const orderData = orderSnapshot.data() as { caseId?: string; uid?: string };
    reopenCaseId = typeof orderData.caseId === "string" ? orderData.caseId : null;
    reopenUid = params.uid;

    const existingRefundQuery = await tx.get(
      ledgerCollection.where("idempotencyKey", "==", `refund:${params.adjustmentId}`).limit(1)
    );
    const existingRefundEntry = existingRefundQuery.empty
      ? null
      : (existingRefundQuery.docs[0].data() as LedgerEntry);

    const latestLedgerQuery = await tx.get(
      ledgerCollection.orderBy("createdAt", "desc").limit(1)
    );
    const previousEntryHash = latestLedgerQuery.empty
      ? ""
      : (latestLedgerQuery.docs[0].data() as { entryHash: string }).entryHash;

    const entitlementsQuery = await tx.get(
      adminDb.collection("entitlements").where("orderId", "==", params.orderId)
    );
    const entitlementDocs = entitlementsQuery.docs.map((doc) => ({
      id: doc.id,
      ref: doc.ref,
      data: doc.data() as { entitlementId: string; status: string },
    }));

    const revokeExistingByEntitlement = new Map<string, { entryHash: string } | null>();
    for (const doc of entitlementDocs) {
      const entId = doc.data.entitlementId || doc.id;
      const revokeQuery = await tx.get(
        ledgerCollection.where("idempotencyKey", "==", `revoke:${entId}:${params.eventId}`).limit(1)
      );
      revokeExistingByEntitlement.set(
        entId,
        revokeQuery.empty ? null : (revokeQuery.docs[0].data() as { entryHash: string })
      );
    }

    // ---- WRITE PHASE ----
    const refundEntry = await writeLedgerEntry(tx, {
      uid: params.uid,
      orderId: params.orderId,
      transactionId: params.transactionId,
      eventId: params.eventId,
      type: "REFUND_APPROVED",
      quantity: 1,
      currency: params.currency,
      amountMinor: params.amountMinor,
      idempotencyKey: `refund:${params.adjustmentId}`,
    }, {
      existingEntry: existingRefundEntry as LedgerEntry | null,
      previousEntryHash,
    });

    let hasSealedReports = false;
    for (const doc of entitlementDocs) {
      const entId = doc.data.entitlementId || doc.id;
      if (doc.data.status === "CONSUMED") {
        hasSealedReports = true;
      } else {
        await revokeEntitlement(tx, {
          entitlementId: entId,
          eventId: params.eventId,
        }, {
          entitlement: doc.data as never,
          existingEntry: revokeExistingByEntitlement.get(entId) as LedgerEntry | null,
          previousEntryHash: refundEntry.entryHash,
        });
      }
    }

    const finalStatus = hasSealedReports ? "REFUNDED_AFTER_DELIVERY" : "REFUNDED_UNUSED";
    reopenAfterUnusedRefund = finalStatus === "REFUNDED_UNUSED";
    await transitionOrderStatus(tx, params.orderId, finalStatus, undefined, orderSnapshot as never);

    console.log(`[REFUND] Order ${params.orderId} transitioned to ${finalStatus} due to refund approval.`);
  });

  if (reopenAfterUnusedRefund && reopenUid && reopenCaseId) {
    await adminDb
      .collection("commerce_checkout_locks")
      .doc(checkoutLockDocId(reopenUid, reopenCaseId))
      .set(
        {
          status: "SUPERSEDED",
          uid: reopenUid,
          caseId: reopenCaseId,
          updatedAt: new Date().toISOString(),
          clearedReason: "REFUNDED_UNUSED",
        },
        { merge: true },
      );
  }
}
