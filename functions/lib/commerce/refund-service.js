"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processRefund = processRefund;
const firebase_admin_1 = require("@/firebase-admin");
const order_service_1 = require("./order-service");
const entitlement_service_1 = require("./entitlement-service");
const ledger_service_1 = require("./ledger-service");
/**
 * Handles payment adjustments and refunds asynchronously in a single Firestore transaction
 */
async function processRefund(dbTransaction, params) {
    const orderRef = firebase_admin_1.adminDb.collection("commerce_orders").doc(params.orderId);
    const orderSnapshot = await dbTransaction.get(orderRef);
    if (!orderSnapshot.exists) {
        console.error(`[REFUND] Order ${params.orderId} not found during refund processing.`);
        return;
    }
    // 1. Log payment capture reversal in the ledger
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
    // 2. Fetch all entitlements linked to this order to revoke them
    const entitlementsQuery = await dbTransaction.get(firebase_admin_1.adminDb.collection("entitlements").where("orderId", "==", params.orderId));
    let hasSealedReports = false;
    for (const doc of entitlementsQuery.docs) {
        const entitlement = doc.data();
        if (entitlement.status === "CONSUMED") {
            hasSealedReports = true;
        }
        else {
            // Revoke the active or reserved entitlement
            await (0, entitlement_service_1.revokeEntitlement)(dbTransaction, {
                entitlementId: entitlement.entitlementId,
                eventId: params.eventId,
            });
        }
    }
    // 3. Update order state based on delivery
    const finalStatus = hasSealedReports ? "REFUNDED_AFTER_DELIVERY" : "REFUNDED_UNUSED";
    await (0, order_service_1.transitionOrderStatus)(dbTransaction, params.orderId, finalStatus);
    console.log(`[REFUND] Order ${params.orderId} transitioned to ${finalStatus} due to refund approval.`);
}
//# sourceMappingURL=refund-service.js.map