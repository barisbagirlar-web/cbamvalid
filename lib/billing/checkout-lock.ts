import crypto from "crypto";
import { adminDb } from "@/lib/firebase/admin";

/** Open checkout sessions older than this may be superseded (abandoned Paddle overlays). */
export const CHECKOUT_LOCK_TTL_MS = 2 * 60 * 60 * 1000;

export type CheckoutLockStatus = "OPEN" | "FULFILLED" | "SUPERSEDED";

export type CheckoutLockRecord = {
  uid: string;
  caseId: string;
  orderId: string;
  correlationId: string;
  priceId: string;
  status: CheckoutLockStatus;
  paddleTransactionId?: string;
  checkoutMode?: "transaction" | "items";
  createdAt: string;
  updatedAt: string;
};

export function checkoutLockDocId(uid: string, caseId: string): string {
  return crypto.createHash("sha256").update(`${uid}\u0000${caseId}`).digest("hex");
}

export function isCheckoutLockStale(
  lock: Pick<CheckoutLockRecord, "updatedAt" | "createdAt">,
  nowMs: number = Date.now(),
): boolean {
  const raw = lock.updatedAt || lock.createdAt;
  const ts = Date.parse(raw);
  if (!Number.isFinite(ts)) return true;
  return nowMs - ts > CHECKOUT_LOCK_TTL_MS;
}

export async function markCheckoutLockFulfilled(uid: string, caseId: string): Promise<void> {
  if (!uid || !caseId) return;
  const now = new Date().toISOString();
  await adminDb
    .collection("commerce_checkout_locks")
    .doc(checkoutLockDocId(uid, caseId))
    .set(
      {
        status: "FULFILLED",
        uid,
        caseId,
        updatedAt: now,
      },
      { merge: true },
    );
}

export async function clearCheckoutLockForRepurchase(uid: string, caseId: string): Promise<void> {
  if (!uid || !caseId) return;
  const now = new Date().toISOString();
  await adminDb
    .collection("commerce_checkout_locks")
    .doc(checkoutLockDocId(uid, caseId))
    .set(
      {
        status: "SUPERSEDED",
        uid,
        caseId,
        updatedAt: now,
        clearedReason: "REFUND_OR_REOPEN",
      },
      { merge: true },
    );
}

export type ClaimCheckoutLockResult =
  | {
      action: "reuse";
      orderId: string;
      correlationId: string;
      priceId: string;
      paddleTransactionId?: string;
      checkoutMode: "transaction" | "items";
    }
  | {
      action: "create";
      orderId: string;
      correlationId: string;
    }
  | {
      action: "already_paid";
    };

/**
 * Atomically claim or reuse a per-(uid, caseId) checkout lock.
 * Reuse requires an OPEN lock that is not stale. Transaction-mode reuse also
 * requires paddleTransactionId so a second tab cannot open a parallel items overlay.
 */
export async function claimOrReuseCheckoutLock(params: {
  uid: string;
  caseId: string;
  priceId: string;
  createOrderId: () => string;
  createCorrelationId: () => string;
}): Promise<ClaimCheckoutLockResult> {
  const lockRef = adminDb.collection("commerce_checkout_locks").doc(
    checkoutLockDocId(params.uid, params.caseId),
  );

  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(lockRef);
    const lock = snap.data() as CheckoutLockRecord | undefined;
    const now = new Date().toISOString();

    if (lock?.status === "FULFILLED") {
      return { action: "already_paid" as const };
    }

    if (
      lock?.status === "OPEN" &&
      lock.orderId &&
      lock.correlationId &&
      lock.priceId === params.priceId &&
      !isCheckoutLockStale(lock)
    ) {
      const mode = lock.checkoutMode === "transaction" ? "transaction" : "items";
      if (mode === "transaction" && !lock.paddleTransactionId) {
        // First request still creating the Paddle transaction — bind to same order.
        return {
          action: "reuse" as const,
          orderId: lock.orderId,
          correlationId: lock.correlationId,
          priceId: lock.priceId,
          checkoutMode: "items" as const,
        };
      }
      return {
        action: "reuse" as const,
        orderId: lock.orderId,
        correlationId: lock.correlationId,
        priceId: lock.priceId,
        paddleTransactionId: lock.paddleTransactionId,
        checkoutMode: mode,
      };
    }

    if (lock?.status === "OPEN" && lock.orderId && isCheckoutLockStale(lock)) {
      const oldOrderRef = adminDb.collection("commerce_orders").doc(lock.orderId);
      tx.set(
        oldOrderRef,
        {
          status: "PAYMENT_CANCELED",
          updatedAt: now,
          canceledReason: "CHECKOUT_LOCK_STALE",
        },
        { merge: true },
      );
    }

    const orderId = params.createOrderId();
    const correlationId = params.createCorrelationId();
    const record: CheckoutLockRecord = {
      uid: params.uid,
      caseId: params.caseId,
      orderId,
      correlationId,
      priceId: params.priceId,
      status: "OPEN",
      createdAt: now,
      updatedAt: now,
    };
    tx.set(lockRef, record);
    return { action: "create" as const, orderId, correlationId };
  });
}

export async function attachPaddleTransactionToLock(params: {
  uid: string;
  caseId: string;
  orderId: string;
  paddleTransactionId?: string;
  checkoutMode: "transaction" | "items";
}): Promise<void> {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    orderId: params.orderId,
    checkoutMode: params.checkoutMode,
    status: "OPEN",
    updatedAt: now,
  };
  if (params.paddleTransactionId) {
    patch.paddleTransactionId = params.paddleTransactionId;
  }
  await adminDb
    .collection("commerce_checkout_locks")
    .doc(checkoutLockDocId(params.uid, params.caseId))
    .set(patch, { merge: true });
}
