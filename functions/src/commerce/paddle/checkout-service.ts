import { getPriceIdForProduct, PRODUCT_CATALOG } from "../../commerce/catalog";
import { paddle, isSandboxMode } from "../paddle-client";
import { adminDb } from "../../firebase-admin";
import { createOrder } from "../order-service";
import crypto from "crypto";

export async function createCheckout(uid: string, email: string, productCode: string, metadata: { caseId: string }) {
  const { caseId } = metadata;
  
  // Force canonical product mapping
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
    // Create server-side tracking order
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
  });

  await adminDb.collection("commerce_orders").doc(result.orderId).update({
    paddleTransactionId: paddleTransaction.id,
    status: "PAYMENT_PENDING",
  });

  return paddleTransaction.id;
}
