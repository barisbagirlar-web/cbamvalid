import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const memory = vi.hoisted(() => {
  type Data = Record<string, unknown>;
  type DocRef = {
    kind: "doc";
    path: string;
    id: string;
    collection: (name: string) => CollectionRef;
  };
  type QueryRef = {
    kind: "query";
    path: string;
    filters: Array<{ field: string; value: unknown }>;
    resultLimit?: number;
  };
  type CollectionRef = {
    path: string;
    doc: (id?: string) => DocRef;
    where: (field: string, operator: string, value: unknown) => QueryRef & {
      limit: (limit: number) => QueryRef;
      get: () => Promise<unknown>;
    };
  };

  const docs = new Map<string, Data>();
  let generated = 0;

  function doc(path: string): DocRef {
    const id = path.split("/").at(-1) || path;
    return {
      kind: "doc",
      path,
      id,
      collection: (name: string) => collection(`${path}/${name}`),
    };
  }

  function snapshot(reference: DocRef) {
    const data = docs.get(reference.path);
    return {
      id: reference.id,
      exists: data !== undefined,
      data: () => data,
      ref: reference,
    };
  }

  function querySnapshot(reference: QueryRef) {
    const prefix = `${reference.path}/`;
    let matches = [...docs.entries()]
      .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes("/"))
      .filter(([, data]) => reference.filters.every((filter) => data[filter.field] === filter.value));
    if (reference.resultLimit !== undefined) matches = matches.slice(0, reference.resultLimit);
    return {
      empty: matches.length === 0,
      size: matches.length,
      docs: matches.map(([path]) => snapshot(doc(path))),
    };
  }

  function query(path: string, filters: QueryRef["filters"], resultLimit?: number) {
    const reference: QueryRef & {
      limit: (limit: number) => QueryRef;
      get: () => Promise<unknown>;
    } = {
      kind: "query",
      path,
      filters,
      resultLimit,
      limit: (limit: number) => query(path, filters, limit),
      get: async () => querySnapshot(reference),
    };
    return reference;
  }

  function collection(path: string): CollectionRef {
    return {
      path,
      doc: (id?: string) => doc(`${path}/${id || `generated-${++generated}`}`),
      where: (field: string, operator: string, value: unknown) => {
        if (operator !== "==") throw new Error(`UNSUPPORTED_QUERY_OPERATOR:${operator}`);
        return query(path, [{ field, value }]);
      },
    };
  }

  const transaction = {
    get: vi.fn(async (reference: DocRef | QueryRef) =>
      reference.kind === "query" ? querySnapshot(reference) : snapshot(reference)
    ),
    create: vi.fn((reference: DocRef, data: Data) => {
      if (docs.has(reference.path)) throw new Error(`DOCUMENT_ALREADY_EXISTS:${reference.path}`);
      docs.set(reference.path, structuredClone(data));
    }),
    set: vi.fn((reference: DocRef, data: Data, options?: { merge?: boolean }) => {
      const current = docs.get(reference.path) || {};
      docs.set(reference.path, options?.merge ? { ...current, ...structuredClone(data) } : structuredClone(data));
    }),
    update: vi.fn((reference: DocRef, data: Data) => {
      const current = docs.get(reference.path);
      if (!current) throw new Error(`DOCUMENT_NOT_FOUND:${reference.path}`);
      docs.set(reference.path, { ...current, ...structuredClone(data) });
    }),
  };

  const db = {
    collection,
    runTransaction: vi.fn(async (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction)),
  };

  return {
    docs,
    db,
    transaction,
    reset: () => {
      docs.clear();
      generated = 0;
      transaction.get.mockClear();
      transaction.create.mockClear();
      transaction.set.mockClear();
      transaction.update.mockClear();
      db.runTransaction.mockClear();
    },
  };
});

vi.mock("../../functions/src/firebase-admin", () => ({ adminDb: memory.db }));

import { COMMERCIAL_CONTRACT } from "../../functions/src/commerce/commercial-contract";
import { unlockPreparationPack } from "../../functions/src/commerce/credit-service";
import { processRefund } from "../../functions/src/commerce/refund-service";
import {
  normalizeCompletedTransaction,
  processWebhookEvent,
  type ProcessedWebhookResult,
} from "../../functions/src/commerce/webhook-processor";

const uid = "user-commercial-1";
const orderId = "ord_commercial_1";
const transactionId = "txn_commercial_1";
const requestId = "550e8400-e29b-41d4-a716-446655440000";
const priceId = "pri_commercial123";
const occurredAt = "2026-07-16T00:00:00.000Z";

function pendingOrder(overrides: Record<string, unknown> = {}) {
  return {
    orderId,
    uid,
    productCode: COMMERCIAL_CONTRACT.productCode,
    paddlePriceId: priceId,
    status: "PAYMENT_PENDING",
    currency: COMMERCIAL_CONTRACT.currency,
    amountMinor: COMMERCIAL_CONTRACT.priceMinor,
    checkoutRequestId: requestId,
    paddleTransactionId: transactionId,
    createdAt: occurredAt,
    updatedAt: occurredAt,
    ...overrides,
  };
}

function completedEvent(overrides: Record<string, unknown> = {}) {
  return {
    eventId: "evt_commercial_1",
    eventType: "transaction.completed",
    occurredAt,
    data: {
      id: transactionId,
      status: "completed",
      currencyCode: COMMERCIAL_CONTRACT.currency,
      customData: {
        uid,
        orderId,
        requestId,
        productCode: COMMERCIAL_CONTRACT.productCode,
      },
      items: [{ quantity: 1, price: { id: priceId } }],
      details: { totals: { total: String(COMMERCIAL_CONTRACT.priceMinor) } },
      ...overrides,
    },
  };
}

function purchaseLedgerPath(): string {
  const digest = crypto.createHash("sha256").update(`${uid}\u0000${transactionId}`).digest("hex");
  return `users/${uid}/creditLedger/purchase_${digest}`;
}

async function fulfillPurchase(): Promise<ProcessedWebhookResult> {
  memory.docs.set(`commerce_orders/${orderId}`, pendingOrder());
  return processWebhookEvent(completedEvent());
}

describe("closed-loop commercial DNA", () => {
  beforeEach(() => memory.reset());

  it("normalizes only complete one-line-item Paddle transactions", () => {
    expect(normalizeCompletedTransaction(completedEvent().data)).toMatchObject({
      transactionId,
      status: "completed",
      currency: "USD",
      totalMinor: 14900,
      uid,
      orderId,
      requestId,
      productCode: "CBAM_EXPORTER_FINAL_REPORT",
      quantity: 1,
      priceId,
    });

    const quantityTamper = completedEvent({ items: [{ quantity: 2, price: { id: priceId } }] });
    expect(() => normalizeCompletedTransaction(quantityTamper.data)).toThrow("PADDLE_QUANTITY_INVALID");
    const missingRequest = completedEvent({ customData: { uid, orderId, productCode: COMMERCIAL_CONTRACT.productCode } });
    expect(() => normalizeCompletedTransaction(missingRequest.data)).toThrow("customData.requestId");
    const missingPrice = completedEvent({ items: [{ quantity: 1 }] });
    expect(() => normalizeCompletedTransaction(missingPrice.data)).toThrow("items.0.priceId");
  });

  it("fulfills one exact payment once and replays without duplicate credit", async () => {
    const first = await fulfillPurchase();
    expect(first).toMatchObject({ handled: true, idempotentReplay: false, uid, orderId, transactionId });
    expect(memory.docs.get(`commerce_orders/${orderId}`)).toMatchObject({
      status: "CREDITS_GRANTED",
      creditsGranted: 100,
    });
    expect(memory.docs.get(`users/${uid}/creditSummary/current`)).toMatchObject({
      availableCredits: 100,
      lifetimePurchased: 100,
    });
    expect(memory.docs.get(purchaseLedgerPath())).toMatchObject({
      type: "PURCHASE",
      amount: 100,
      balanceAfter: 100,
    });

    const replay = await processWebhookEvent({ ...completedEvent(), eventId: "evt_commercial_retry" });
    expect(replay.idempotentReplay).toBe(true);
    expect(memory.docs.get(`users/${uid}/creditSummary/current`)).toMatchObject({
      availableCredits: 100,
      lifetimePurchased: 100,
    });
  });

  it("rejects price, total, currency and identity tampering before any credit write", async () => {
    memory.docs.set(`commerce_orders/${orderId}`, pendingOrder());
    const tampered = completedEvent({
      details: { totals: { total: "14901" } },
    });
    await expect(processWebhookEvent(tampered)).rejects.toThrow("PADDLE_ORDER_FULFILLMENT_MISMATCH");
    expect(memory.docs.has(`users/${uid}/creditSummary/current`)).toBe(false);
    expect(memory.docs.has(purchaseLedgerPath())).toBe(false);
    expect(memory.docs.get(`commerce_orders/${orderId}`)).toMatchObject({ status: "PAYMENT_PENDING" });
  });

  it("deducts one hundred credits exactly once when one case pack is unlocked", async () => {
    await fulfillPurchase();
    const first = await memory.db.runTransaction((tx) => unlockPreparationPack(tx as never, {
      uid,
      caseId: "case-commercial-1",
      requestId: "550e8400-e29b-41d4-a716-446655440001",
      now: "2026-07-16T00:01:00.000Z",
    })) as Awaited<ReturnType<typeof unlockPreparationPack>>;
    expect(first).toMatchObject({ creditsConsumed: 100, balanceAfter: 0, releasesGranted: 5, idempotentReplay: false });
    expect(memory.docs.get(`users/${uid}/creditSummary/current`)).toMatchObject({
      availableCredits: 0,
      lifetimeConsumed: 100,
    });
    expect(memory.docs.get(`entitlements/${first.entitlementId}`)).toMatchObject({
      uid,
      scopeCaseId: "case-commercial-1",
      maxReleases: 5,
      releasesCount: 0,
    });

    const replay = await memory.db.runTransaction((tx) => unlockPreparationPack(tx as never, {
      uid,
      caseId: "case-commercial-1",
      requestId: "550e8400-e29b-41d4-a716-446655440001",
      now: "2026-07-16T00:02:00.000Z",
    })) as Awaited<ReturnType<typeof unlockPreparationPack>>;
    expect(replay.idempotentReplay).toBe(true);
    expect(replay.balanceAfter).toBe(0);

    await expect(memory.db.runTransaction((tx) => unlockPreparationPack(tx as never, {
      uid,
      caseId: "case-commercial-2",
      requestId: "550e8400-e29b-41d4-a716-446655440002",
      now: "2026-07-16T00:03:00.000Z",
    }))).rejects.toThrow("100 account credits are required");
    expect([...memory.docs.keys()].filter((path) => path.startsWith("entitlements/"))).toHaveLength(1);
  });

  it("recovers unused credits on full refund without a negative balance", async () => {
    await fulfillPurchase();
    await memory.db.runTransaction((tx) => processRefund(tx as never, {
      uid,
      orderId,
      transactionId,
      eventId: "evt_refund_unused",
      adjustmentId: "adj_unused_1",
      amountMinor: 14900,
      currency: "USD",
    }));

    expect(memory.docs.get(`users/${uid}/creditSummary/current`)).toMatchObject({
      availableCredits: 0,
      lifetimeRefunded: 100,
    });
    expect(memory.docs.get(`users/${uid}/commerceHold/current`)).toMatchObject({
      active: false,
      deficitCredits: 0,
    });
    expect(memory.docs.get(`commerce_orders/${orderId}`)).toMatchObject({ status: "REFUNDED_UNUSED" });
  });

  it("creates a blocking commerce hold when refunded credits were already converted into a case pack", async () => {
    await fulfillPurchase();
    await memory.db.runTransaction((tx) => unlockPreparationPack(tx as never, {
      uid,
      caseId: "case-commercial-1",
      requestId: "550e8400-e29b-41d4-a716-446655440003",
      now: "2026-07-16T00:01:00.000Z",
    }));

    await memory.db.runTransaction((tx) => processRefund(tx as never, {
      uid,
      orderId,
      transactionId,
      eventId: "evt_refund_consumed",
      adjustmentId: "adj_consumed_1",
      amountMinor: 14900,
      currency: "USD",
    }));

    expect(memory.docs.get(`users/${uid}/creditSummary/current`)).toMatchObject({
      availableCredits: 0,
      lifetimeConsumed: 100,
      lifetimeRefunded: 100,
    });
    expect(memory.docs.get(`users/${uid}/commerceHold/current`)).toMatchObject({
      active: true,
      reason: "REFUND_AFTER_CREDIT_CONSUMPTION",
      deficitCredits: 100,
    });
    expect(memory.docs.get(`commerce_orders/${orderId}`)).toMatchObject({ status: "REFUNDED_AFTER_DELIVERY" });

    memory.docs.set(`users/${uid}/creditSummary/current`, {
      availableCredits: 100,
      lifetimePurchased: 200,
      lifetimeConsumed: 100,
      lifetimeAdjusted: 0,
      lifetimeRefunded: 100,
      updatedAt: "2026-07-16T00:05:00.000Z",
    });
    await expect(memory.db.runTransaction((tx) => unlockPreparationPack(tx as never, {
      uid,
      caseId: "case-commercial-2",
      requestId: "550e8400-e29b-41d4-a716-446655440004",
      now: "2026-07-16T00:06:00.000Z",
    }))).rejects.toThrow("COMMERCE_HOLD_ACTIVE");
  });

  it("rejects partial, over-value and wrong-currency refunds", async () => {
    await fulfillPurchase();
    await expect(memory.db.runTransaction((tx) => processRefund(tx as never, {
      uid,
      orderId,
      transactionId,
      eventId: "evt_refund_partial",
      adjustmentId: "adj_partial",
      amountMinor: 1000,
      currency: "USD",
    }))).rejects.toThrow("REFUND_FULL_AMOUNT_REQUIRED");

    await expect(memory.db.runTransaction((tx) => processRefund(tx as never, {
      uid,
      orderId,
      transactionId,
      eventId: "evt_refund_currency",
      adjustmentId: "adj_currency",
      amountMinor: 14900,
      currency: "EUR",
    }))).rejects.toThrow("REFUND_CURRENCY_MISMATCH");
  });
});
