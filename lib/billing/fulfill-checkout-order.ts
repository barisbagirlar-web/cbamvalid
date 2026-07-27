import "server-only";

import crypto from "crypto";
import { adminDb } from "@/lib/firebase/admin";
import { getPaddleConfig } from "@/lib/billing/paddle-config.server";
import { CASE_COMMERCIAL } from "@/lib/billing/case-commercial-contract";

const MAX_RELEASES_PER_PAID_CASE = CASE_COMMERCIAL.maxReleasesPerPaidCase;
const CANONICAL_PRODUCT = "pack_premium_dossier_v5";

type PaddleTransaction = {
  id: string;
  status: string;
  currency_code?: string;
  currencyCode?: string;
  custom_data?: Record<string, unknown> | null;
  customData?: Record<string, unknown> | null;
  items?: Array<{
    quantity?: number;
    price?: { id?: string };
    price_id?: string;
    priceId?: string;
  }>;
  details?: { totals?: { grand_total?: string; grandTotal?: string } };
  totals?: { grand_total?: string; grandTotal?: string };
};

export type FulfillCheckoutResult = {
  orderId: string;
  transactionId: string;
  entitlementId: string;
  alreadyFulfilled: boolean;
};

function paddleApiBase(isSandbox: boolean): string {
  return isSandbox ? "https://sandbox-api.paddle.com" : "https://api.paddle.com";
}

function readCustomData(txn: PaddleTransaction): Record<string, unknown> {
  return (txn.customData || txn.custom_data || {}) as Record<string, unknown>;
}

function readCurrency(txn: PaddleTransaction): string {
  return String(txn.currencyCode || txn.currency_code || "");
}

function readGrandTotalMinor(txn: PaddleTransaction): number {
  const raw =
    txn.details?.totals?.grandTotal ||
    txn.details?.totals?.grand_total ||
    txn.totals?.grandTotal ||
    txn.totals?.grand_total ||
    0;
  return Math.round(Number(raw));
}

function readItemPriceId(item: NonNullable<PaddleTransaction["items"]>[number]): string {
  return String(item.priceId || item.price_id || item.price?.id || "");
}

async function fetchPaddleTransaction(transactionId: string): Promise<PaddleTransaction> {
  const config = getPaddleConfig();
  const res = await fetch(`${paddleApiBase(config.isSandbox)}/transactions/${transactionId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "Paddle-Version": "1",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PADDLE_TRANSACTION_FETCH_FAILED:${res.status}:${text.slice(0, 240)}`);
  }
  const body = await res.json();
  return body.data as PaddleTransaction;
}

/**
 * Fulfills a paid Paddle transaction into a CBAMValid pack entitlement.
 * Uses transaction.read (GET) — does not require transaction.write.
 * Idempotent on payment:${transactionId} / order status ENTITLED|PAID.
 */
export async function fulfillCheckoutOrder(params: {
  uid: string;
  orderId: string;
  transactionId: string;
  eventId?: string;
}): Promise<FulfillCheckoutResult> {
  const { uid, orderId, transactionId } = params;
  const eventId = params.eventId || `confirm:${transactionId}`;

  const orderRef = adminDb.collection("commerce_orders").doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) {
    throw new Error("ORDER_NOT_FOUND");
  }
  const order = orderSnap.data() as Record<string, unknown>;
  if (order.uid !== uid) {
    throw new Error("ORDER_OWNERSHIP_MISMATCH");
  }

  if (order.status === "ENTITLED" || order.status === "PAID") {
    const existingEntitlement = await adminDb
      .collection("entitlements")
      .where("orderId", "==", orderId)
      .where("uid", "==", uid)
      .limit(1)
      .get();
    return {
      orderId,
      transactionId: String(order.paddleTransactionId || transactionId),
      entitlementId: existingEntitlement.empty ? "" : existingEntitlement.docs[0].id,
      alreadyFulfilled: true,
    };
  }

  const txn = await fetchPaddleTransaction(transactionId);
  if (txn.status !== "completed" && txn.status !== "paid") {
    throw new Error(`TRANSACTION_NOT_PAID:${txn.status}`);
  }

  const custom = readCustomData(txn);
  if (String(custom.orderId || "") !== orderId) {
    throw new Error("ORDER_ID_MISMATCH");
  }

  const items = txn.items || [];
  if (items.length === 0) {
    throw new Error("TRANSACTION_HAS_NO_ITEMS");
  }
  const expectedPriceId = String(order.paddlePriceId || "");
  const matchesPrice = items.some((item) => readItemPriceId(item) === expectedPriceId);
  if (!matchesPrice) {
    throw new Error("PRICE_ID_MISMATCH");
  }

  const currency = readCurrency(txn);
  if (currency && currency !== order.currency) {
    throw new Error("CURRENCY_MISMATCH");
  }

  const amountMinor = readGrandTotalMinor(txn);
  if (amountMinor > 0 && amountMinor !== Number(order.amountMinor)) {
    throw new Error("AMOUNT_MISMATCH");
  }

  const purchasedQuantity = items.reduce((acc, item) => acc + (item.quantity || 1), 0);
  if (purchasedQuantity !== 1) {
    throw new Error("QUANTITY_MISMATCH");
  }

  const productCode =
    typeof order.canonicalProductCode === "string" && order.canonicalProductCode
      ? order.canonicalProductCode
      : CANONICAL_PRODUCT;

  const scopeCaseId = typeof order.caseId === "string" ? order.caseId.trim() : "";
  if (!scopeCaseId) {
    throw new Error("CASE_ID_REQUIRED_FOR_FULFILLMENT");
  }

  const entitlementId = await adminDb.runTransaction(async (dbTx) => {
    const freshOrder = await dbTx.get(orderRef);
    const fresh = freshOrder.data() || {};
    if (fresh.status === "ENTITLED" || fresh.status === "PAID") {
      return "";
    }

    const paymentIdempotency = `payment:${transactionId}`;
    const paymentQuery = await dbTx.get(
      adminDb.collection("commerce_ledger").where("idempotencyKey", "==", paymentIdempotency).limit(1)
    );
    if (!paymentQuery.empty) {
      dbTx.update(orderRef, {
        status: "ENTITLED",
        paddleTransactionId: transactionId,
        updatedAt: new Date().toISOString(),
      });
      return "";
    }

    const now = new Date().toISOString();
    const ledgerRef = adminDb.collection("commerce_ledger").doc();
    const ledgerPayload = {
      entryId: ledgerRef.id,
      uid,
      orderId,
      transactionId,
      eventId,
      type: "PAYMENT_CAPTURED",
      quantity: purchasedQuantity,
      currency: String(order.currency || "USD"),
      amountMinor: Number(order.amountMinor || 0),
      createdAt: now,
      idempotencyKey: paymentIdempotency,
      previousEntryHash: "",
      entryHash: crypto.createHash("sha256").update(`${paymentIdempotency}:${ledgerRef.id}`).digest("hex"),
    };
    dbTx.set(ledgerRef, ledgerPayload);

    const entitlementRef = adminDb.collection("entitlements").doc();
    const entitlementPayload = {
      entitlementId: entitlementRef.id,
      uid,
      orderId,
      productCode,
      status: "AVAILABLE",
      quantity: 1,
      maxReleases: MAX_RELEASES_PER_PAID_CASE,
      scopeCaseId,
      billingModel: CASE_COMMERCIAL.billingModel,
      createdAt: now,
      updatedAt: now,
      releasesCount: 0,
      releasesList: [],
    };
    dbTx.set(entitlementRef, entitlementPayload);

    const entitlementLedgerRef = adminDb.collection("commerce_ledger").doc();
    dbTx.set(entitlementLedgerRef, {
      entryId: entitlementLedgerRef.id,
      uid,
      orderId,
      transactionId,
      eventId,
      type: "ENTITLEMENT_ISSUED",
      quantity: MAX_RELEASES_PER_PAID_CASE,
      createdAt: now,
      idempotencyKey: `entitlement:${transactionId}:${productCode}`,
      previousEntryHash: ledgerPayload.entryHash,
      entryHash: crypto
        .createHash("sha256")
        .update(`entitlement:${transactionId}:${productCode}:${entitlementLedgerRef.id}`)
        .digest("hex"),
    });

    dbTx.update(orderRef, {
      status: "ENTITLED",
      paddleTransactionId: transactionId,
      caseId: scopeCaseId,
      updatedAt: now,
    });

    const caseRef = adminDb.collection("cbam_cases").doc(scopeCaseId);
    dbTx.set(
      caseRef,
      {
        commercial: {
          status: "PAID",
          billingModel: CASE_COMMERCIAL.billingModel,
          orderId,
          paddleTransactionId: transactionId,
          paidAt: now,
        },
        updatedAt: now,
      },
      { merge: true }
    );

    return entitlementRef.id;
  });

  return {
    orderId,
    transactionId,
    entitlementId,
    alreadyFulfilled: !entitlementId,
  };
}
