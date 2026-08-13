import { getPriceIdForProduct, PRODUCT_CATALOG } from "../../commerce/catalog";
import { paddle, isSandboxMode } from "../paddle-client";
import { adminDb } from "../../firebase-admin";
import { createOrder } from "../order-service";
import crypto from "crypto";
import type { Transaction } from "firebase-admin/firestore";

export type CheckoutSessionResult = {
  mode: "transaction" | "items";
  orderId: string;
  correlationId: string;
  priceId: string;
  transactionId?: string;
  reusedExistingCheckout?: boolean;
};

type CheckoutLockRecord = {
  uid: string;
  caseId: string;
  orderId: string;
  correlationId: string;
  priceId: string;
  status: "OPEN" | "FULFILLED";
  paddleTransactionId?: string;
  checkoutMode?: "transaction" | "items";
  createdAt: string;
  updatedAt: string;
};

function checkoutLockDocId(uid: string, caseId: string): string {
  return crypto.createHash("sha256").update(`${uid}\u0000${caseId}`).digest("hex");
}

/**
 * Creates (or reuses) a checkout for one working file.
 * Double-tab race: the same uid+caseId reuses the open lock instead of a second Paddle charge.
 */
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

  const lockRef = adminDb.collection("commerce_checkout_locks").doc(checkoutLockDocId(uid, caseId));
  const existingLock = (await lockRef.get()).data() as CheckoutLockRecord | undefined;
  if (existingLock?.status === "FULFILLED") {
    throw new Error("WORKING_FILE_ALREADY_PAID");
  }
  if (
    existingLock?.status === "OPEN" &&
    existingLock.orderId &&
    existingLock.correlationId &&
    existingLock.priceId === priceId
  ) {
    return {
      mode: existingLock.checkoutMode === "items" ? "items" : "transaction",
      orderId: existingLock.orderId,
      correlationId: existingLock.correlationId,
      priceId: existingLock.priceId,
      transactionId: existingLock.paddleTransactionId,
      reusedExistingCheckout: true,
    };
  }

  const correlationId = crypto.randomUUID();

  const result = await adminDb.runTransaction(async (dbTransaction: Transaction) => {
    const lockSnap = await dbTransaction.get(lockRef);
    const lock = lockSnap.data() as CheckoutLockRecord | undefined;
    if (lock?.status === "FULFILLED") {
      throw new Error("WORKING_FILE_ALREADY_PAID");
    }
    if (lock?.status === "OPEN" && lock.orderId && lock.correlationId && lock.priceId === priceId) {
      return {
        reuse: true as const,
        orderId: lock.orderId,
        correlationId: lock.correlationId,
        priceId: lock.priceId,
        paddleTransactionId: lock.paddleTransactionId,
        checkoutMode: lock.checkoutMode,
      };
    }

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

    const now = new Date().toISOString();
    const lockRecord: CheckoutLockRecord = {
      uid,
      caseId,
      orderId: order.orderId,
      correlationId,
      priceId,
      status: "OPEN",
      createdAt: now,
      updatedAt: now,
    };
    dbTransaction.set(lockRef, lockRecord);

    return { reuse: false as const, orderId: order.orderId };
  });

  if (result.reuse) {
    return {
      mode: result.checkoutMode === "items" ? "items" : "transaction",
      orderId: result.orderId,
      correlationId: result.correlationId,
      priceId: result.priceId,
      transactionId: result.paddleTransactionId,
      reusedExistingCheckout: true,
    };
  }

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

    const now = new Date().toISOString();
    await adminDb.collection("commerce_orders").doc(result.orderId).update({
      paddleTransactionId: paddleTransaction.id,
      status: "PAYMENT_PENDING",
      checkoutMode: "transaction",
      correlationId,
    });
    await lockRef.set(
      {
        paddleTransactionId: paddleTransaction.id,
        checkoutMode: "transaction",
        status: "OPEN",
        updatedAt: now,
      },
      { merge: true },
    );

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
    const now = new Date().toISOString();
    await adminDb.collection("commerce_orders").doc(result.orderId).update({
      status: "PAYMENT_PENDING",
      checkoutMode: "items",
      correlationId,
      updatedAt: now,
    });
    await lockRef.set(
      {
        checkoutMode: "items",
        status: "OPEN",
        updatedAt: now,
      },
      { merge: true },
    );
    return {
      mode: "items",
      orderId: result.orderId,
      correlationId,
      priceId,
    };
  }
}

export async function markCheckoutLockFulfilled(uid: string, caseId: string): Promise<void> {
  if (!uid || !caseId) return;
  const lockRef = adminDb.collection("commerce_checkout_locks").doc(checkoutLockDocId(uid, caseId));
  await lockRef.set(
    {
      status: "FULFILLED",
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}
