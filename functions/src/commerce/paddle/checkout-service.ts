import { getPriceIdForProduct, PRODUCT_CATALOG } from "../../commerce/catalog";
import { paddle, isSandboxMode } from "../paddle-client";
import { adminDb } from "../../firebase-admin";
import { createOrder } from "../order-service";
import { verifyCaseOwner } from "../../cbam/storage/case-repository";

const PREPARATION_PACK_PRODUCT = "CBAM_CREDIT_PACK_5" as const;

export async function createCheckout(
  uid: string,
  email: string,
  productCode: string,
  metadata: { caseId: string }
) {
  const { caseId } = metadata;

  if (productCode !== PREPARATION_PACK_PRODUCT) {
    throw new Error("Unsupported checkout product.");
  }

  const product = PRODUCT_CATALOG[productCode];
  if (!product || !product.active) {
    throw new Error("Product is inactive or invalid.");
  }

  const cbamCase = await verifyCaseOwner(caseId, uid);
  if (cbamCase.status !== "DRAFT") {
    throw new Error("Only an active draft case can be linked to a Preparation Pack.");
  }

  const isSandbox = isSandboxMode();
  const priceId = getPriceIdForProduct(productCode, isSandbox);
  if (!priceId || priceId.includes("...")) {
    throw new Error("Price mapping is not configured for the selected Paddle environment.");
  }

  const order = await adminDb.runTransaction(async (dbTransaction: any) => {
    return createOrder(dbTransaction, {
      uid,
      caseId,
      productCode,
      currency: product.currency,
      amountMinor: product.expectedUnitAmount,
    });
  });

  try {
    const paddleTransaction = await paddle.transactions.create({
      items: [
        {
          priceId,
          quantity: 1,
        },
      ],
      customer: email ? { email } : undefined,
      customData: {
        uid,
        orderId: order.orderId,
        caseId,
        productCode,
        environment: isSandbox ? "sandbox" : "production",
      },
    });

    await adminDb.collection("commerce_orders").doc(order.orderId).update({
      paddleTransactionId: paddleTransaction.id,
      status: "PAYMENT_PENDING",
      updatedAt: new Date().toISOString(),
    });

    return paddleTransaction.id;
  } catch (error) {
    await adminDb.collection("commerce_orders").doc(order.orderId).update({
      status: "PAYMENT_FAILED",
      updatedAt: new Date().toISOString(),
    });
    throw error;
  }
}
