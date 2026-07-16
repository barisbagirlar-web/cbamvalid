import type admin from "firebase-admin";
import { adminDb } from "../firebase-admin";
import { PREPARATION_PACK } from "./preparation-pack";
import type { CommerceOrder } from "./order-service";
import { assertOrderTransition } from "./order-state";
import { normalizeCreditSummary } from "./credit-service";
import { writeLedgerEntry } from "./ledger-service";
import type { Entitlement } from "./entitlement-service";

export async function processRefund(
  transaction: admin.firestore.Transaction,
  params: {
    uid: string;
    orderId: string;
    transactionId: string;
    eventId: string;
    adjustmentId: string;
    amountMinor: number;
    currency: string;
  }
): Promise<{ status: "REFUNDED_UNUSED" | "REFUNDED_AFTER_DELIVERY"; creditsReversed: number; idempotent: boolean }> {
  if (params.currency !== PREPARATION_PACK.currency) throw new Error("REFUND_CURRENCY_MISMATCH");
  if (params.amountMinor !== PREPARATION_PACK.priceMinor) {
    throw new Error("PARTIAL_REFUND_REQUIRES_MANUAL_REVIEW");
  }

  const orderRef = adminDb.collection("commerce_orders").doc(params.orderId);
  const entitlementQuery = adminDb.collection("entitlements").where("orderId", "==", params.orderId);
  const creditSummaryRef = adminDb.collection("users").doc(params.uid).collection("creditSummary").doc("current");
  const refundMarkerRef = adminDb.collection("credit_events").doc(`refund_${params.adjustmentId}`);
  const [orderSnapshot, entitlementSnapshot, creditSummarySnapshot, markerSnapshot] = await Promise.all([
    transaction.get(orderRef),
    transaction.get(entitlementQuery),
    transaction.get(creditSummaryRef),
    transaction.get(refundMarkerRef),
  ]);

  if (!orderSnapshot.exists) throw new Error("REFUND_ORDER_NOT_FOUND");
  const order = orderSnapshot.data() as CommerceOrder;
  if (
    order.uid !== params.uid ||
    order.orderId !== params.orderId ||
    order.paddleTransactionId !== params.transactionId ||
    order.currency !== params.currency ||
    order.amountMinor !== params.amountMinor ||
    order.productCode !== PREPARATION_PACK.productCode
  ) throw new Error("REFUND_ORDER_CONTRACT_MISMATCH");

  if (markerSnapshot.exists) {
    if (order.status !== "REFUNDED_UNUSED" && order.status !== "REFUNDED_AFTER_DELIVERY") {
      throw new Error("REFUND_PARTIAL_STATE");
    }
    const marker = markerSnapshot.data() as Record<string, unknown>;
    const creditsReversed = Number(marker.creditsReversed || 0);
    if (!Number.isSafeInteger(creditsReversed) || creditsReversed < 0) throw new Error("REFUND_MARKER_INVALID");
    return { status: order.status, creditsReversed, idempotent: true };
  }
  if (order.status === "REFUNDED_UNUSED" || order.status === "REFUNDED_AFTER_DELIVERY") {
    throw new Error("REFUND_TERMINAL_ORDER_WITHOUT_MARKER");
  }

  const entitlements = entitlementSnapshot.docs
    .map((document) => ({ entitlementId: document.id, ...document.data() } as Entitlement))
    .filter((item) => item.uid === params.uid && item.productCode === PREPARATION_PACK.productCode);
  if (entitlements.length !== 1) throw new Error(`REFUND_ENTITLEMENT_CARDINALITY_INVALID:${entitlements.length}`);
  const entitlement = entitlements[0];
  if (entitlement.status === "REVOKED") throw new Error("REFUND_ENTITLEMENT_ALREADY_REVOKED_WITHOUT_MARKER");
  if (entitlement.status === "RESERVED") throw new Error("REFUND_BLOCKED_BY_ACTIVE_SEAL_RESERVATION");
  const releasesCount = Number(entitlement.releasesCount || 0);
  const expectedCreditsRemaining = (PREPARATION_PACK.maxReleases - releasesCount) * PREPARATION_PACK.creditsPerRelease;
  if (
    !Number.isSafeInteger(releasesCount) ||
    releasesCount < 0 ||
    releasesCount > PREPARATION_PACK.maxReleases ||
    entitlement.creditsRemaining !== expectedCreditsRemaining
  ) throw new Error("REFUND_ENTITLEMENT_CONSERVATION_INVALID");

  const reportsSnapshot = await transaction.get(
    adminDb.collection("cbam_reports").where("entitlementId", "==", entitlement.entitlementId)
  );
  const sealedReports = reportsSnapshot.docs.filter((document) => document.data()?.status === "SEALED");
  if (sealedReports.length !== releasesCount) {
    throw new Error(`REFUND_REPORT_RECONCILIATION_INVALID:${releasesCount}:${sealedReports.length}`);
  }

  const summary = normalizeCreditSummary(creditSummarySnapshot.data());
  if (summary.availableCredits < entitlement.creditsRemaining) {
    throw new Error("REFUND_ACCOUNT_BALANCE_CONSERVATION_INVALID");
  }
  const status = releasesCount > 0 ? "REFUNDED_AFTER_DELIVERY" : "REFUNDED_UNUSED";
  assertOrderTransition(order.status, status);
  const balanceAfter = summary.availableCredits - entitlement.creditsRemaining;
  const now = new Date().toISOString();

  transaction.update(orderRef, {
    status,
    refundedAt: now,
    refundAdjustmentId: params.adjustmentId,
    updatedAt: now,
  });
  transaction.update(adminDb.collection("entitlements").doc(entitlement.entitlementId), {
    status: "REVOKED",
    creditsRemaining: 0,
    reservedReportId: null,
    reservationExpiresAt: null,
    refundAdjustmentId: params.adjustmentId,
    updatedAt: now,
  });
  for (const report of sealedReports) {
    const data = report.data() as Record<string, unknown>;
    const documentHash = typeof data.documentHash === "string" ? data.documentHash : "";
    if (!/^[a-f0-9]{64}$/i.test(documentHash)) throw new Error("REFUND_SEALED_REPORT_HASH_INVALID");
    transaction.update(adminDb.collection("document_seals").doc(documentHash), {
      commercialStatus: "REFUNDED_AFTER_DELIVERY",
      refundAdjustmentId: params.adjustmentId,
      refundedAt: now,
    });
  }
  transaction.set(creditSummaryRef, {
    ...summary,
    availableCredits: balanceAfter,
    lifetimeRefunded: summary.lifetimeRefunded + entitlement.creditsRemaining,
    updatedAt: now,
  }, { merge: true });
  transaction.create(
    adminDb.collection("users").doc(params.uid).collection("creditLedger").doc(`refund_${params.adjustmentId}`),
    {
      uid: params.uid,
      type: "REFUND_REVERSAL",
      amount: -entitlement.creditsRemaining,
      reason: "PADDLE_REFUND",
      orderId: params.orderId,
      entitlementId: entitlement.entitlementId,
      adjustmentId: params.adjustmentId,
      createdAt: now,
      balanceAfter,
    }
  );
  transaction.create(refundMarkerRef, {
    uid: params.uid,
    orderId: params.orderId,
    transactionId: params.transactionId,
    adjustmentId: params.adjustmentId,
    creditsReversed: entitlement.creditsRemaining,
    orderStatus: status,
    createdAt: now,
  });
  await writeLedgerEntry(transaction, {
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
  await writeLedgerEntry(transaction, {
    uid: params.uid,
    orderId: params.orderId,
    transactionId: params.transactionId,
    eventId: params.eventId,
    type: "ENTITLEMENT_REVOKED",
    quantity: 1,
    idempotencyKey: `revoke:${entitlement.entitlementId}:${params.adjustmentId}`,
  });

  return { status, creditsReversed: entitlement.creditsRemaining, idempotent: false };
}
