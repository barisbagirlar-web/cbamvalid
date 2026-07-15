import { getPriceIdForProduct, getProduct } from "../catalog";
import { paddle, isSandboxMode } from "../paddle-client";
import { adminDb } from "../../firebase-admin";
import { createOrder, transitionOrderStatus } from "../order-service";
import { verifyCaseOwner } from "../../cbam/storage/case-repository";

export async function createCheckout(params: {
  uid: string;
  email: string;
  productCode: string;
  requestId: string;
  caseId?: string;
}): Promise<string> {
  const product = getProduct(params.productCode);
  if (!product) throw new Error("CHECKOUT_PRODUCT_INVALID");
  if (params.caseId) await verifyCaseOwner(params.caseId, params.uid);

  const sandbox = isSandboxMode();
  const priceId = getPriceIdForProduct(params.productCode, sandbox);
  if (!priceId) throw new Error("PADDLE_PRICE_MAPPING_MISSING");

  const result = await adminDb.runTransaction((transaction) => createOrder(transaction, {
    uid: params.uid,
    requestId: params.requestId,
    ...(params.caseId ? { caseId: params.caseId } : {}),
    productCode: params.productCode,
    currency: product.currency,
    amountMinor: product.expectedUnitAmount,
  }));

  if (result.order.paddleTransactionId) return result.order.paddleTransactionId;
  if (!result.created) throw new Error("CHECKOUT_CREATION_IN_PROGRESS");

  try {
    const paddleTransaction = await paddle.transactions.create({
      items: [{ priceId, quantity: 1 }],
      customer: params.email ? { email: params.email } : undefined,
      customData: {
        uid: params.uid,
        orderId: result.order.orderId,
        ...(params.caseId ? { caseId: params.caseId } : {}),
        productCode: params.productCode,
        environment: sandbox ? "sandbox" : "production",
      },
    });

    await adminDb.runTransaction((transaction) => transitionOrderStatus(
      transaction,
      result.order.orderId,
      "PAYMENT_PENDING",
      { paddleTransactionId: paddleTransaction.id }
    ));
    return paddleTransaction.id;
  } catch (error) {
    await adminDb.runTransaction((transaction) => transitionOrderStatus(
      transaction,
      result.order.orderId,
      "PAYMENT_FAILED"
    )).catch((stateError) => console.error("Checkout failure state could not be persisted", stateError));
    throw error;
  }
}
