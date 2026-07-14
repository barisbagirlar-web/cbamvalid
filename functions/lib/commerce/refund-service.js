"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processRefund = processRefund;
const firebase_admin_1 = require("../firebase-admin");
const entitlement_service_1 = require("./entitlement-service");
const ledger_service_1 = require("./ledger-service");
/**
 * Handles approved Paddle refunds as a retryable saga.
 *
 * Each entitlement revocation is its own idempotent transaction. The final
 * refund-ledger entry and order transition are committed together. This avoids
 * Firestore's prohibited read-after-write pattern while allowing webhook
 * retries to resume safely after a partial infrastructure failure.
 */
async function processRefund(params) {
    const orderRef = firebase_admin_1.adminDb.collection("commerce_orders").doc(params.orderId);
    const orderSnapshot = await orderRef.get();
    if (!orderSnapshot.exists) {
        throw new Error(`REFUND_ORDER_NOT_FOUND:${params.orderId}`);
    }
    const order = orderSnapshot.data();
    if (order.uid !== params.uid || order.paddleTransactionId !== params.transactionId) {
        throw new Error("REFUND_ORDER_PAYLOAD_MISMATCH");
    }
    const entitlementSnapshot = await firebase_admin_1.adminDb
        .collection("entitlements")
        .where("orderId", "==", params.orderId)
        .get();
    const entitlements = entitlementSnapshot.docs.map((doc) => doc.data());
    const hasSealedReports = entitlements.some((entitlement) => entitlement.status === "CONSUMED");
    for (const entitlement of entitlements) {
        if (entitlement.status === "CONSUMED" || entitlement.status === "REVOKED")
            continue;
        await firebase_admin_1.adminDb.runTransaction(async (dbTransaction) => {
            await (0, entitlement_service_1.revokeEntitlement)(dbTransaction, {
                entitlementId: entitlement.entitlementId,
                eventId: params.eventId,
            });
        });
    }
    const finalStatus = hasSealedReports
        ? "REFUNDED_AFTER_DELIVERY"
        : "REFUNDED_UNUSED";
    await firebase_admin_1.adminDb.runTransaction(async (dbTransaction) => {
        const latestOrderSnapshot = await dbTransaction.get(orderRef);
        if (!latestOrderSnapshot.exists)
            throw new Error(`REFUND_ORDER_NOT_FOUND:${params.orderId}`);
        const latestOrder = latestOrderSnapshot.data();
        if (latestOrder.status === finalStatus)
            return;
        if (latestOrder.uid !== params.uid ||
            latestOrder.paddleTransactionId !== params.transactionId) {
            throw new Error("REFUND_ORDER_PAYLOAD_MISMATCH");
        }
        await (0, ledger_service_1.writeLedgerEntry)(dbTransaction, {
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
//# sourceMappingURL=refund-service.js.map