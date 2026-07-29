import admin from "firebase-admin";
import { adminDb } from "../firebase-admin";
import { transitionOrderStatus } from "./order-service";
import { ledgerEntryId, writeLedgerEntry, type LedgerEntry } from "./ledger-service";
import { OrderNotFoundError } from "./commerce-errors";
import type { CommerceOrder } from "./order-service";

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
  const orderRef = adminDb.collection("commerce_orders").doc(params.orderId);
  const orderSnapshot = await dbTransaction.get(orderRef);

  if (!orderSnapshot.exists) {
    throw new OrderNotFoundError(params.orderId);
  }
  const order = orderSnapshot.data() as CommerceOrder;
  if (order.uid !== params.uid) throw new Error("REFUND_ORDER_OWNERSHIP_MISMATCH");
  if (order.paddleTransactionId && order.paddleTransactionId !== params.transactionId) {
    throw new Error("REFUND_TRANSACTION_MISMATCH");
  }
  if (params.currency !== order.currency) {
    throw new Error("REFUND_CURRENCY_MISMATCH");
  }
  if (
    !Number.isFinite(params.amountMinor) ||
    !Number.isInteger(params.amountMinor) ||
    Math.abs(params.amountMinor) !== order.amountMinor
  ) {
    throw new Error("PARTIAL_OR_INVALID_REFUND_AMOUNT");
  }


  // Read the complete mutation set before queuing any Firestore writes.
  const entitlementsQuery = await dbTransaction.get(
    adminDb.collection("entitlements").where("orderId", "==", params.orderId)
  );
  const unusedEntitlements = entitlementsQuery.docs.filter((document) => {
    const entitlement = document.data();
    return !(
      entitlement.status === "CONSUMED" ||
      Number(entitlement.releasesCount || 0) > 0 ||
      typeof entitlement.consumedReportId === "string"
    );
  });
  const hasSealedReports = unusedEntitlements.length !== entitlementsQuery.docs.length;
  const refundKey = `refund:${params.adjustmentId}`;
  const revokeKeys = unusedEntitlements.map((document) =>
    `revoke:${document.data().entitlementId || document.id}:${params.eventId}`
  );
  const ledgerCollection = adminDb.collection("commerce_ledger");
  const [refundLedgerSnapshot, latestLedgerSnapshot, ...revokeLedgerSnapshots] =
    await Promise.all([
      dbTransaction.get(ledgerCollection.doc(ledgerEntryId(refundKey))),
      dbTransaction.get(ledgerCollection.orderBy("createdAt", "desc").limit(1)),
      ...revokeKeys.map((key) => dbTransaction.get(ledgerCollection.doc(ledgerEntryId(key)))),
    ]);
  let previousEntryHash = latestLedgerSnapshot.empty
    ? ""
    : String((latestLedgerSnapshot.docs[0].data() as LedgerEntry).entryHash || "");

  // 1. Log payment capture reversal in the ledger.
  const refundEntry = await writeLedgerEntry(dbTransaction, {
    uid: params.uid,
    orderId: params.orderId,
    transactionId: params.transactionId,
    eventId: params.eventId,
    type: "REFUND_APPROVED",
    quantity: 1,
    currency: params.currency,
    amountMinor: params.amountMinor,
    idempotencyKey: refundKey,
  }, {
    existingEntry: refundLedgerSnapshot.exists
      ? refundLedgerSnapshot.data() as LedgerEntry
      : null,
    previousEntryHash,
  });
  previousEntryHash = refundEntry.entryHash;

  // 2. Revoke only never-used entitlements. Prior sealed releases remain immutable.
  for (const [index, doc] of unusedEntitlements.entries()) {
    const entitlement = doc.data();
    const revokeEntry = await writeLedgerEntry(dbTransaction, {
      uid: String(entitlement.uid || params.uid),
      orderId: params.orderId,
      transactionId: params.transactionId,
      eventId: params.eventId,
      type: "ENTITLEMENT_REVOKED",
      quantity: 1,
      idempotencyKey: revokeKeys[index],
    }, {
      existingEntry: revokeLedgerSnapshots[index].exists
        ? revokeLedgerSnapshots[index].data() as LedgerEntry
        : null,
      previousEntryHash,
    });
    previousEntryHash = revokeEntry.entryHash;
    dbTransaction.update(doc.ref, {
      status: "REVOKED",
      reservedReportId: null,
      reservationExpiresAt: null,
      updatedAt: new Date().toISOString(),
    });
  }

  // 3. Update order state based on delivery
  const finalStatus = hasSealedReports ? "REFUNDED_AFTER_DELIVERY" : "REFUNDED_UNUSED";
  await transitionOrderStatus(dbTransaction, params.orderId, finalStatus, undefined, order);

  console.log(`[REFUND] Order ${params.orderId} transitioned to ${finalStatus} due to refund approval.`);
}
