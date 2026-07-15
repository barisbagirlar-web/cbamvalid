import crypto from "node:crypto";
import { HttpsError } from "firebase-functions/v2/https";
import { adminDb } from "../../firebase-admin";
import { getPriceIdForProduct, getProductDefinition } from "../catalog";
import { COMMERCIAL_CONTRACT, normalizeProductCode } from "../commercial-contract";
import { createOrder, type CommerceOrder } from "../order-service";
import { getPaddleClient, isSandboxMode } from "../paddle-client";

interface CheckoutMarker {
  uid: string;
  requestId: string;
  orderId: string;
  state: "CREATING" | "COMPLETE" | "RECOVERY_REQUIRED";
  leaseExpiresAt: string;
  createdAt: string;
  updatedAt: string;
  paddleTransactionId?: string;
  failureCode?: string;
}

function checkoutDigest(uid: string, requestId: string): string {
  return crypto.createHash("sha256").update(`${uid}\u0000${requestId}`).digest("hex");
}

export async function createCheckout(params: {
  uid: string;
  email: string;
  productCode: string;
  requestId: string;
}): Promise<string> {
  const productCode = normalizeProductCode(params.productCode);
  const product = getProductDefinition(productCode);
  const sandbox = isSandboxMode();
  const priceId = getPriceIdForProduct(productCode, sandbox);
  const digest = checkoutDigest(params.uid, params.requestId);
  const orderId = `ord_${digest.slice(0, 48)}`;
  const markerRef = adminDb.collection("checkout_requests").doc(digest);
  const orderRef = adminDb.collection("commerce_orders").doc(orderId);
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();

  const preparation = await adminDb.runTransaction(async (transaction) => {
    const [markerSnapshot, orderSnapshot] = await Promise.all([
      transaction.get(markerRef),
      transaction.get(orderRef),
    ]);
    if (markerSnapshot.exists) {
      const marker = markerSnapshot.data() as CheckoutMarker;
      if (marker.uid !== params.uid || marker.requestId !== params.requestId || marker.orderId !== orderId) {
        throw new Error("CHECKOUT_IDEMPOTENCY_COLLISION");
      }
      if (marker.state === "COMPLETE" && marker.paddleTransactionId && orderSnapshot.exists) {
        const order = orderSnapshot.data() as CommerceOrder;
        if (
          order.paddleTransactionId !== marker.paddleTransactionId ||
          order.productCode !== productCode ||
          order.paddlePriceId !== priceId ||
          order.amountMinor !== product.expectedUnitAmount ||
          order.currency !== product.currency
        ) throw new Error("CHECKOUT_COMPLETE_STATE_MISMATCH");
        return { existingTransactionId: marker.paddleTransactionId };
      }
      if (marker.state === "CREATING") throw new HttpsError("aborted", "CHECKOUT_REQUEST_IN_PROGRESS");
      throw new HttpsError("failed-precondition", "CHECKOUT_RECOVERY_REQUIRED");
    }
    if (orderSnapshot.exists) throw new Error("CHECKOUT_ORDER_PARTIAL_STATE");

    await createOrder(transaction, {
      orderId,
      uid: params.uid,
      productCode,
      paddlePriceId: priceId,
      currency: product.currency,
      amountMinor: product.expectedUnitAmount,
      checkoutRequestId: params.requestId,
      now: now.toISOString(),
    });
    const marker: CheckoutMarker = {
      uid: params.uid,
      requestId: params.requestId,
      orderId,
      state: "CREATING",
      leaseExpiresAt,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    transaction.create(markerRef, marker);
    return { existingTransactionId: "" };
  });

  if (preparation.existingTransactionId) return preparation.existingTransactionId;

  try {
    const paddleTransaction = await getPaddleClient().transactions.create({
      items: [{ priceId, quantity: 1 }],
      customData: {
        uid: params.uid,
        email: params.email,
        orderId,
        requestId: params.requestId,
        productCode: COMMERCIAL_CONTRACT.productCode,
        environment: sandbox ? "sandbox" : "production",
      },
    });

    await adminDb.runTransaction(async (transaction) => {
      const [markerSnapshot, orderSnapshot] = await Promise.all([
        transaction.get(markerRef),
        transaction.get(orderRef),
      ]);
      if (!markerSnapshot.exists || !orderSnapshot.exists) throw new Error("CHECKOUT_COMMIT_STATE_MISSING");
      const marker = markerSnapshot.data() as CheckoutMarker;
      const order = orderSnapshot.data() as CommerceOrder;
      if (
        marker.state !== "CREATING" ||
        order.status !== "CHECKOUT_CREATED" ||
        order.paddlePriceId !== priceId
      ) throw new Error("CHECKOUT_COMMIT_STATE_INVALID");
      transaction.update(orderRef, {
        paddleTransactionId: paddleTransaction.id,
        status: "PAYMENT_PENDING",
        updatedAt: new Date().toISOString(),
      });
      transaction.update(markerRef, {
        state: "COMPLETE",
        paddleTransactionId: paddleTransaction.id,
        updatedAt: new Date().toISOString(),
      });
    });
    return paddleTransaction.id;
  } catch (error: unknown) {
    const failureCode = error instanceof Error ? error.message : "PADDLE_TRANSACTION_CREATE_UNKNOWN_FAILURE";
    await adminDb.runTransaction(async (transaction) => {
      const [markerSnapshot, orderSnapshot] = await Promise.all([
        transaction.get(markerRef),
        transaction.get(orderRef),
      ]);
      if (markerSnapshot.exists) {
        transaction.update(markerRef, {
          state: "RECOVERY_REQUIRED",
          failureCode,
          updatedAt: new Date().toISOString(),
        });
      }
      if (orderSnapshot.exists) {
        transaction.update(orderRef, {
          status: "CHECKOUT_RECOVERY_REQUIRED",
          updatedAt: new Date().toISOString(),
        });
      }
    });
    throw error;
  }
}
