import admin from "firebase-admin";
import { adminDb } from "../firebase-admin";
import { transitionOrderStatus } from "./order-service";
import { revokeEntitlement } from "./entitlement-service";
import { writeLedgerEntry, LedgerEntry } from "./ledger-service";

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
  // Firestore requires all reads to precede all writes in a transaction.
  // Fetch every document/query up front, then run writes against prefetched data.
  await adminDb.runTransaction(async (dbTransaction: admin.firestore.Transaction) => {
    const orderRef = adminDb.collection("commerce_orders").doc(params.orderId);
    const ledgerCollection = adminDb.collection("commerce_ledger");

    // ---- READ PHASE (all reads before any write) ----
    const orderSnapshot = await dbTransaction.get(orderRef);
    if (!orderSnapshot.exists) {
      console.error(`[REFUND] Order ${params.orderId} not found during refund processing.`);
      return;
    }

    const existingRefundQuery = await dbTransaction.get(
      ledgerCollection.where("idempotencyKey", "==", `refund:${params.adjustmentId}`).limit(1)
    );
    const existingRefundEntry = existingRefundQuery.empty
      ? null
      : (existingRefundQuery.docs[0].data() as LedgerEntry);

    const latestLedgerQuery = await dbTransaction.get(
      ledgerCollection.orderBy("createdAt", "desc").limit(1)
    );
    const previousEntryHash = latestLedgerQuery.empty
      ? ""
      : (latestLedgerQuery.docs[0].data() as { entryHash: string }).entryHash;

    const entitlementsQuery = await dbTransaction.get(
      adminDb.collection("entitlements").where("orderId", "==", params.orderId)
    );
    const entitlementDocs = entitlementsQuery.docs.map((doc) => ({
      id: doc.id,
      ref: doc.ref,
      data: doc.data() as { entitlementId: string; status: string },
    }));

    // Prefetch the existing revoke ledger entry for each entitlement so the
    // write phase never needs a read (Firestore read-after-write prohibition).
    const revokeExistingByEntitlement = new Map<string, { entryHash: string } | null>();
    for (const doc of entitlementDocs) {
      const entId = doc.data.entitlementId || doc.id;
      const revokeQuery = await dbTransaction.get(
        ledgerCollection.where("idempotencyKey", "==", `revoke:${entId}:${params.eventId}`).limit(1)
      );
      revokeExistingByEntitlement.set(
        entId,
        revokeQuery.empty ? null : (revokeQuery.docs[0].data() as { entryHash: string })
      );
    }

    // ---- WRITE PHASE (writes only; no reads after this point) ----
    // 1. Log payment capture reversal in the ledger
    const refundEntry = await writeLedgerEntry(dbTransaction, {
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

    // 2. Revoke entitlements linked to this order
    let hasSealedReports = false;
    for (const doc of entitlementDocs) {
      const entId = doc.data.entitlementId || doc.id;
      if (doc.data.status === "CONSUMED") {
        hasSealedReports = true;
      } else {
        // Revoke the active or reserved entitlement (prefetched to avoid read-after-write)
        await revokeEntitlement(dbTransaction, {
          entitlementId: entId,
          eventId: params.eventId,
        }, {
          entitlement: doc.data as never,
          existingEntry: revokeExistingByEntitlement.get(entId) as LedgerEntry | null,
          previousEntryHash: refundEntry.entryHash,
        });
      }
    }

    // 3. Update order state based on delivery
    const finalStatus = hasSealedReports ? "REFUNDED_AFTER_DELIVERY" : "REFUNDED_UNUSED";
    await transitionOrderStatus(dbTransaction, params.orderId, finalStatus, undefined, orderSnapshot as never);

    console.log(`[REFUND] Order ${params.orderId} transitioned to ${finalStatus} due to refund approval.`);
  });
}
