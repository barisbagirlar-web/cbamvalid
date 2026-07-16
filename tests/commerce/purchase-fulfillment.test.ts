import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ValidatedCompletedTransaction } from "../../functions/src/commerce/transaction-contract";
import { PREPARATION_PACK } from "../../functions/src/commerce/preparation-pack";

const documents: Record<string, Record<string, unknown>> = {};

function snapshot(path: string) {
  return {
    id: path.split("/").at(-1) || path,
    exists: Boolean(documents[path]),
    data: () => documents[path],
  };
}

function documentReference(path: string) {
  return {
    path,
    id: path.split("/").at(-1) || path,
    collection: (name: string) => collectionReference(`${path}/${name}`),
  };
}

function collectionReference(path: string) {
  return {
    doc: (id: string) => documentReference(`${path}/${id}`),
  };
}

const transaction = {
  get: vi.fn(async (reference: { path: string }) => snapshot(reference.path)),
  create: vi.fn((reference: { path: string }, data: Record<string, unknown>) => {
    if (documents[reference.path]) throw new Error(`ALREADY_EXISTS:${reference.path}`);
    documents[reference.path] = structuredClone(data);
  }),
  update: vi.fn((reference: { path: string }, data: Record<string, unknown>) => {
    if (!documents[reference.path]) throw new Error(`NOT_FOUND:${reference.path}`);
    documents[reference.path] = { ...documents[reference.path], ...structuredClone(data) };
  }),
  set: vi.fn((reference: { path: string }, data: Record<string, unknown>, options?: { merge?: boolean }) => {
    documents[reference.path] = options?.merge
      ? { ...(documents[reference.path] || {}), ...structuredClone(data) }
      : structuredClone(data);
  }),
};

vi.mock("../../functions/src/firebase-admin", () => ({
  adminDb: {
    collection: (name: string) => collectionReference(name),
  },
}));

function validatedTransaction(overrides: Partial<ValidatedCompletedTransaction> = {}): ValidatedCompletedTransaction {
  return {
    transactionId: "txn-123",
    uid: "user-123",
    orderId: `ord_${"a".repeat(64)}`,
    caseId: "case-123",
    productCode: PREPARATION_PACK.productCode,
    currency: PREPARATION_PACK.currency,
    totalMinor: PREPARATION_PACK.priceMinor,
    quantity: 1,
    priceId: "pri_sandbox_valid",
    ...overrides,
  };
}

function seedOrder(transactionData: ValidatedCompletedTransaction) {
  documents[`commerce_orders/${transactionData.orderId}`] = {
    orderId: transactionData.orderId,
    requestId: "11111111-1111-4111-8111-111111111111",
    uid: transactionData.uid,
    caseId: transactionData.caseId,
    productCode: transactionData.productCode,
    status: "PAYMENT_PENDING",
    currency: transactionData.currency,
    amountMinor: transactionData.totalMinor,
    paddleTransactionId: transactionData.transactionId,
    createdAt: "2026-07-16T00:00:00.000Z",
    updatedAt: "2026-07-16T00:00:00.000Z",
  };
}

describe("Atomic Preparation Pack purchase fulfillment", () => {
  beforeEach(() => {
    for (const key of Object.keys(documents)) delete documents[key];
    vi.clearAllMocks();
  });

  it("creates one entitlement and grants exactly 100 credits", async () => {
    const purchase = validatedTransaction();
    seedOrder(purchase);
    const { fulfillPreparationPackPurchase } = await import(
      "../../functions/src/commerce/purchase-fulfillment"
    );

    const result = await fulfillPreparationPackPurchase(
      transaction as never,
      purchase,
      "evt-123"
    );

    expect(result).toMatchObject({ balanceAfter: 100, idempotent: false });
    expect(documents[`commerce_orders/${purchase.orderId}`]).toMatchObject({
      status: "ENTITLED",
      paddleTransactionId: purchase.transactionId,
    });
    expect(documents[`users/${purchase.uid}/creditSummary/current`]).toMatchObject({
      availableCredits: 100,
      lifetimePurchased: 100,
      lifetimeConsumed: 0,
    });
    expect(documents[`users/${purchase.uid}/creditLedger/purchase_${purchase.transactionId}`]).toMatchObject({
      amount: 100,
      type: "PURCHASE_CREDIT",
      balanceAfter: 100,
    });

    const entitlementPaths = Object.keys(documents).filter((path) => path.startsWith("entitlements/"));
    expect(entitlementPaths).toHaveLength(1);
    expect(documents[entitlementPaths[0]]).toMatchObject({
      uid: purchase.uid,
      orderId: purchase.orderId,
      productCode: PREPARATION_PACK.productCode,
      status: "AVAILABLE",
      maxReleases: 5,
      releasesCount: 0,
      creditsRemaining: 100,
    });
  });

  it("acknowledges an exact replay without a second credit grant", async () => {
    const purchase = validatedTransaction();
    seedOrder(purchase);
    const { fulfillPreparationPackPurchase } = await import(
      "../../functions/src/commerce/purchase-fulfillment"
    );

    const first = await fulfillPreparationPackPurchase(transaction as never, purchase, "evt-123");
    const stateAfterFirst = structuredClone(documents);
    const second = await fulfillPreparationPackPurchase(transaction as never, purchase, "evt-replay");

    expect(first.idempotent).toBe(false);
    expect(second).toMatchObject({ idempotent: true, balanceAfter: 100 });
    expect(documents).toEqual(stateAfterFirst);
    expect(Object.keys(documents).filter((path) => path.startsWith("entitlements/"))).toHaveLength(1);
  });

  it("rejects a mismatched amount without granting credits", async () => {
    const orderTransaction = validatedTransaction();
    seedOrder(orderTransaction);
    const tampered = validatedTransaction({ totalMinor: 1 });
    const { fulfillPreparationPackPurchase } = await import(
      "../../functions/src/commerce/purchase-fulfillment"
    );

    await expect(
      fulfillPreparationPackPurchase(transaction as never, tampered, "evt-tampered")
    ).rejects.toThrow("PURCHASE_ORDER_CONTRACT_MISMATCH");
    expect(documents[`users/${tampered.uid}/creditSummary/current`]).toBeUndefined();
    expect(Object.keys(documents).filter((path) => path.startsWith("entitlements/"))).toHaveLength(0);
  });
});
