import admin from "firebase-admin";
import { adminDb } from "../firebase-admin";
import { transitionOrderStatus } from "./order-service";
import { revokeEntitlement } from "./entitlement-service";
import { writeLedgerEntry } from "./ledger-service";

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
  const orderSnapshot: any = await dbTransaction.get(orderRef as any);

  if (!orderSnapshot.exists) {
    console.error(`[REFUND] Order ${params.orderId} not found during refund processing.`);
    return;
  }


  // 1. Log payment capture reversal in the ledger
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

  // 2. Fetch all entitlements linked to this order to revoke them
  const entitlementsQuery = await dbTransaction.get(
    adminDb.collection("entitlements").where("orderId", "==", params.orderId)
  );

  let hasSealedReports = false;

  for (const doc of entitlementsQuery.docs) {
    const entitlement = doc.data() as any;
    if (entitlement.status === "CONSUMED") {
      hasSealedReports = true;
    } else {
      // Revoke the active or reserved entitlement
      await revokeEntitlement(dbTransaction, {
        entitlementId: entitlement.entitlementId,
        eventId: params.eventId,
      });
    }
  }

  // 3. Update order state based on delivery
  const finalStatus = hasSealedReports ? "REFUNDED_AFTER_DELIVERY" : "REFUNDED_UNUSED";
  await transitionOrderStatus(dbTransaction, params.orderId, finalStatus);

  console.log(`[REFUND] Order ${params.orderId} transitioned to ${finalStatus} due to refund approval.`);
}
