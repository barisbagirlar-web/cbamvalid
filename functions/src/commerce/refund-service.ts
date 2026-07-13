import { adminDb } from "../firebase-admin";
import { CommerceOrder } from "./order-service";
import { revokeEntitlement, Entitlement } from "./entitlement-service";
import { writeLedgerEntry } from "./ledger-service";

/**
 * Handles approved Paddle refunds as a retryable saga.
 *
 * Each entitlement revocation is its own idempotent transaction. The final
 * refund-ledger entry and order transition are committed together. This avoids
 * Firestore's prohibited read-after-write pattern while allowing webhook
 * retries to resume safely after a partial infrastructure failure.
 */
export async function processRefund(params: {
  uid: string;
  orderId: string;
  transactionId: string;
  eventId: string;
  adjustmentId: string;
  amountMinor: number;
  currency: string;
}): Promise<void> {
  const orderRef = adminDb.collection("commerce_orders").doc(params.orderId);
  const orderSnapshot = await orderRef.get();
  if (!orderSnapshot.exists) {
    throw new Error(`REFUND_ORDER_NOT_FOUND:${params.orderId}`);
  }

  const order = orderSnapshot.data() as CommerceOrder;
  if (order.uid !== params.uid || order.paddleTransactionId !== params.transactionId) {
    throw new Error("REFUND_ORDER_PAYLOAD_MISMATCH");
  }

  const entitlementSnapshot = await adminDb
    .collection("entitlements")
    .where("orderId", "==", params.orderId)
    .get();
  const entitlements = entitlementSnapshot.docs.map((doc) => doc.data() as Entitlement);
  const hasSealedReports = entitlements.some((entitlement) => entitlement.status === "CONSUMED");

  for (const entitlement of entitlements) {
    if (entitlement.status === "CONSUMED" || entitlement.status === "REVOKED") continue;
    await adminDb.runTransaction(async (dbTransaction) => {
      await revokeEntitlement(dbTransaction, {
        entitlementId: entitlement.entitlementId,
        eventId: params.eventId,
      });
    });
  }

  const finalStatus: CommerceOrder["status"] = hasSealedReports
    ? "REFUNDED_AFTER_DELIVERY"
    : "REFUNDED_UNUSED";

  await adminDb.runTransaction(async (dbTransaction) => {
    const latestOrderSnapshot = await dbTransaction.get(orderRef);
    if (!latestOrderSnapshot.exists) throw new Error(`REFUND_ORDER_NOT_FOUND:${params.orderId}`);
    const latestOrder = latestOrderSnapshot.data() as CommerceOrder;

    if (latestOrder.status === finalStatus) return;
    if (
      latestOrder.uid !== params.uid ||
      latestOrder.paddleTransactionId !== params.transactionId
    ) {
      throw new Error("REFUND_ORDER_PAYLOAD_MISMATCH");
    }

    await writeLedgerEntry(dbTransaction, {
      uid: params.uid,
      orderId: params.orderId,
      transactionId: params.transactionId,
      eventId: params.eventId,
      type: "REFUND_APPROVED",
      quantity: 1,
      currency: params.currency,
      amountMinor: params.amountMinor,
      idempotencyKey: `refund:${params.adjustmentId}`,
    });

    dbTransaction.update(orderRef, {
      status: finalStatus,
      updatedAt: new Date().toISOString(),
    });
  });

  console.log(`[REFUND] Order ${params.orderId} transitioned to ${finalStatus}.`);
}
