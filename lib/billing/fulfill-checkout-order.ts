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
    txn.totals?.grand_total;
  return raw === undefined ? Number.NaN : Number(raw);
}

function readItemPriceId(item: NonNullable<PaddleTransaction["items"]>[number]): string {
  return String(item.priceId || item.price_id || item.price?.id || "");
}

function deterministicId(prefix: "led" | "ent", identity: string): string {
  return `${prefix}_${crypto.createHash("sha256").update(identity).digest("hex")}`;
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

  if (order.status === "ENTITLED") {
    const existingEntitlement = await adminDb
      .collection("entitlements")
      .where("orderId", "==", orderId)
      .where("uid", "==", uid)
      .limit(1)
      .get();
    if (existingEntitlement.empty) {
      throw new Error("ENTITLED_ORDER_MISSING_ENTITLEMENT");
    }
    return {
      orderId,
      transactionId: String(order.paddleTransactionId || transactionId),
      entitlementId: existingEntitlement.docs[0].id,
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
  if (!currency || currency !== order.currency) {
    throw new Error("CURRENCY_MISMATCH");
  }

  const amountMinor = readGrandTotalMinor(txn);
  const expectedAmountMinor = Number(order.amountMinor);
  if (
    !Number.isFinite(amountMinor) ||
    !Number.isInteger(amountMinor) ||
    expectedAmountMinor !== CASE_COMMERCIAL.amountMinor ||
    amountMinor !== expectedAmountMinor
  ) {
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

  const entitlementId = deterministicId("ent", `${orderId}\u0000${productCode}`);
  const paymentIdempotency = `payment:${transactionId}`;
  const entitlementIdempotency = `entitlement:${transactionId}:${productCode}`;
  const paymentLedgerRef = adminDb
    .collection("commerce_ledger")
    .doc(deterministicId("led", paymentIdempotency));
  const entitlementLedgerRef = adminDb
    .collection("commerce_ledger")
    .doc(deterministicId("led", entitlementIdempotency));
  const entitlementRef = adminDb.collection("entitlements").doc(entitlementId);

  const fulfillment = await adminDb.runTransaction(async (dbTx) => {
    const [freshOrder, paymentLedgerSnap, entitlementSnap, entitlementLedgerSnap] =
      await Promise.all([
        dbTx.get(orderRef),
        dbTx.get(paymentLedgerRef),
        dbTx.get(entitlementRef),
        dbTx.get(entitlementLedgerRef),
      ]);
    const fresh = freshOrder.data() || {};
    if (!freshOrder.exists) throw new Error("ORDER_NOT_FOUND");
    if (fresh.uid !== uid) throw new Error("ORDER_OWNERSHIP_MISMATCH");
    if (fresh.status === "ENTITLED") {
      if (!entitlementSnap.exists) throw new Error("ENTITLED_ORDER_MISSING_ENTITLEMENT");
      return { entitlementId: entitlementRef.id, alreadyFulfilled: true };
    }

    const now = new Date().toISOString();
    const ledgerPayload = {
      entryId: paymentLedgerRef.id,
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
      entryHash: crypto.createHash("sha256").update(`${paymentIdempotency}:${paymentLedgerRef.id}`).digest("hex"),
    };
    if (!paymentLedgerSnap.exists) dbTx.set(paymentLedgerRef, ledgerPayload);

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
    if (entitlementSnap.exists) {
      const existing = entitlementSnap.data() || {};
      if (
        existing.uid !== uid ||
        existing.orderId !== orderId ||
        existing.productCode !== productCode ||
        existing.scopeCaseId !== scopeCaseId
      ) {
        throw new Error("ENTITLEMENT_IDENTITY_CONFLICT");
      }
    } else {
      dbTx.set(entitlementRef, entitlementPayload);
    }

    if (!entitlementLedgerSnap.exists) dbTx.set(entitlementLedgerRef, {
      entryId: entitlementLedgerRef.id,
      uid,
      orderId,
      transactionId,
      eventId,
      type: "ENTITLEMENT_ISSUED",
      quantity: MAX_RELEASES_PER_PAID_CASE,
      createdAt: now,
      idempotencyKey: entitlementIdempotency,
      previousEntryHash: ledgerPayload.entryHash,
      entryHash: crypto
        .createHash("sha256")
        .update(`${entitlementIdempotency}:${entitlementLedgerRef.id}`)
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

    return { entitlementId: entitlementRef.id, alreadyFulfilled: false };
  });

  return {
    orderId,
    transactionId,
    entitlementId: fulfillment.entitlementId,
    alreadyFulfilled: fulfillment.alreadyFulfilled,
  };
}
