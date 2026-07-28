import { getPriceIdForProduct, PRODUCT_CATALOG } from "../../commerce/catalog";
import { paddle, isSandboxMode } from "../paddle-client";
import { adminDb } from "../../firebase-admin";
import { createOrder } from "../order-service";
import crypto from "crypto";

export type CheckoutSessionResult = {
  mode: "transaction" | "items";
  orderId: string;
  correlationId: string;
  priceId: string;
  transactionId?: string;
};

export async function createCheckout(
  uid: string,
  email: string,
  productCode: string,
  metadata: { caseId: string }
): Promise<CheckoutSessionResult> {
  const { caseId } = metadata;

  const canonicalProductCode = "pack_premium_dossier_v5";

  const product = PRODUCT_CATALOG[canonicalProductCode];
  if (!product || !product.active) {
    throw new Error("Product is inactive or invalid");
  }

  const isSandbox = isSandboxMode();
  const priceId = getPriceIdForProduct(canonicalProductCode, isSandbox);
  if (!priceId) {
    throw new Error("Price mapping missing for the requested product code");
  }

  const correlationId = crypto.randomUUID();

  const result = await adminDb.runTransaction(async (dbTransaction: any) => {
    const order = await createOrder(dbTransaction, {
      uid: uid,
      caseId: caseId,
      productCode: canonicalProductCode,
      canonicalProductCode: canonicalProductCode,
      paddlePriceId: priceId,
      catalogVersion: "v5",
      currency: product.currency,
      amountMinor: product.expectedUnitAmount,
    });

    return order;
  });

  try {
    const paddleTransaction = await paddle.transactions.create({
      items: [
        {
          priceId: priceId,
          quantity: 1,
        },
      ],
      customData: {
        orderId: result.orderId,
        correlationId: correlationId,
      },
      ...(email ? { customer: { email } } : {}),
    });

    await adminDb.collection("commerce_orders").doc(result.orderId).update({
      paddleTransactionId: paddleTransaction.id,
      status: "PAYMENT_PENDING",
      checkoutMode: "transaction",
      correlationId,
    });

    return {
      mode: "transaction",
      orderId: result.orderId,
      correlationId,
      priceId,
      transactionId: paddleTransaction.id,
    };
  } catch (error: unknown) {
    // API keys without transaction.write still support client items overlay checkout.
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[CHECKOUT] transaction.create unavailable; falling back to items mode:", message);
    await adminDb.collection("commerce_orders").doc(result.orderId).update({
      status: "PAYMENT_PENDING",
      checkoutMode: "items",
      correlationId,
      updatedAt: new Date().toISOString(),
    });
    return {
      mode: "items",
      orderId: result.orderId,
      correlationId,
      priceId,
    };
  }
}
