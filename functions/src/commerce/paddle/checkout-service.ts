import crypto from "crypto";
import { getPriceIdForProduct, PRODUCT_CATALOG } from "../../commerce/catalog";
import { paddle, isSandboxMode } from "../paddle-client";
import { adminDb } from "../../firebase-admin";
import { CommerceOrder } from "../order-service";
import { verifyCaseOwner } from "../../cbam/storage/case-repository";

const PREPARATION_PACK_PRODUCT = "CBAM_CREDIT_PACK_5" as const;

function deterministicOrderId(uid: string, caseId: string): string {
  const digest = crypto
    .createHash("sha256")
    .update(`${uid}:${caseId}:${PREPARATION_PACK_PRODUCT}`)
    .digest("hex")
    .slice(0, 32);
  return `ord_${digest}`;
}

export async function createCheckout(
  uid: string,
  _email: string,
  productCode: string,
  metadata: { caseId: string }
): Promise<string> {
  const { caseId } = metadata;

  if (productCode !== PREPARATION_PACK_PRODUCT) {
    throw new Error("CHECKOUT_PRODUCT_UNSUPPORTED");
  }

  const product = PRODUCT_CATALOG[productCode];
  if (!product || !product.active) {
    throw new Error("CHECKOUT_PRODUCT_INACTIVE");
  }

  const cbamCase = await verifyCaseOwner(caseId, uid);
  if (cbamCase.status !== "DRAFT") {
    throw new Error("CHECKOUT_CASE_NOT_DRAFT");
  }

  const sandbox = isSandboxMode();
  const priceId = getPriceIdForProduct(productCode, sandbox);
  if (!priceId || priceId.includes("...")) {
    throw new Error("CHECKOUT_PRICE_MAPPING_MISSING");
  }

  const orderId = deterministicOrderId(uid, caseId);
  const orderRef = adminDb.collection("commerce_orders").doc(orderId);
  const decision = await adminDb.runTransaction(async (dbTransaction) => {
    const snapshot = await dbTransaction.get(orderRef);
    if (snapshot.exists) {
      const existing = snapshot.data() as CommerceOrder;
      if (
        existing.uid !== uid ||
        existing.caseId !== caseId ||
        existing.productCode !== productCode ||
        existing.currency !== product.currency ||
        existing.amountMinor !== product.expectedUnitAmount
      ) {
        throw new Error("CHECKOUT_ORDER_IDEMPOTENCY_MISMATCH");
      }

      if (existing.status === "PAYMENT_PENDING" && existing.paddleTransactionId) {
        return { create: false as const, transactionId: existing.paddleTransactionId };
      }
      if (["PAID", "ENTITLED", "REPORT_RESERVED", "REPORT_CALCULATED", "REPORT_SEALED", "DELIVERED"].includes(existing.status)) {
        throw new Error("PREPARATION_PACK_ALREADY_PURCHASED");
      }
      if (existing.status === "CHECKOUT_CREATED") {
        throw new Error("CHECKOUT_CREATION_IN_PROGRESS");
      }
      if (!["PAYMENT_FAILED", "PAYMENT_CANCELED"].includes(existing.status)) {
        throw new Error(`CHECKOUT_ORDER_STATE_INVALID:${existing.status}`);
      }

      dbTransaction.update(orderRef, {
        status: "CHECKOUT_CREATED",
        paddleTransactionId: null,
        updatedAt: new Date().toISOString(),
      });
      return { create: true as const };
    }

    const now = new Date().toISOString();
    const order: CommerceOrder = {
      orderId,
      uid,
      caseId,
      productCode,
      status: "CHECKOUT_CREATED",
      currency: product.currency,
      amountMinor: product.expectedUnitAmount,
      createdAt: now,
      updatedAt: now,
    };
    dbTransaction.set(orderRef, order);
    return { create: true as const };
  });

  if (!decision.create) return decision.transactionId;

  try {
    const paddleTransaction = await paddle.transactions.create({
      items: [{ priceId, quantity: 1 }],
      customData: {
        uid,
        orderId,
        caseId,
        productCode,
        environment: sandbox ? "sandbox" : "production",
      },
    });

    await orderRef.update({
      paddleTransactionId: paddleTransaction.id,
      status: "PAYMENT_PENDING",
      updatedAt: new Date().toISOString(),
    });
    return paddleTransaction.id;
  } catch (error) {
    await orderRef.update({
      status: "PAYMENT_FAILED",
      updatedAt: new Date().toISOString(),
      lastCheckoutError: error instanceof Error ? error.message : "CHECKOUT_CREATION_FAILED",
    });
    throw error;
  }
}
