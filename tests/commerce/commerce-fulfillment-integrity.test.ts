import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => {
  const documents = new Map<string, Record<string, unknown>>();
  let transactionQueue: Promise<unknown> = Promise.resolve();

  const snapshot = (path: string) => {
    const data = documents.get(path);
    const ref = reference(path);
    return {
      id: ref.id,
      ref,
      exists: Boolean(data),
      data: () => data,
    };
  };

  function reference(path: string) {
    return {
      path,
      id: path.split("/").at(-1) || "",
      get: async () => snapshot(path),
      set: async (data: Record<string, unknown>, options?: { merge?: boolean }) => {
        documents.set(path, options?.merge ? { ...documents.get(path), ...data } : data);
      },
      update: async (data: Record<string, unknown>) => {
        documents.set(path, { ...documents.get(path), ...data });
      },
    };
  }

  function collection(name: string) {
    const filters: Array<{ field: string; value: unknown }> = [];
    let limitCount: number | undefined;
    let orderField: string | undefined;
    const query = {
      where(field: string, operator: string, value: unknown) {
        if (operator !== "==") throw new Error(`UNSUPPORTED_OPERATOR:${operator}`);
        filters.push({ field, value });
        return query;
      },
      orderBy(field: string) {
        orderField = field;
        return query;
      },
      limit(value: number) {
        limitCount = value;
        return query;
      },
      doc(id?: string) {
        return reference(`${name}/${id || `random_${documents.size}`}`);
      },
      async get() {
        let docs = [...documents.entries()]
          .filter(([path]) => path.startsWith(`${name}/`) && !path.slice(name.length + 1).includes("/"))
          .filter(([, data]) => filters.every((filter) => data[filter.field] === filter.value))
          .map(([path]) => snapshot(path));
        if (orderField) {
          const field = orderField;
          docs = docs.sort((left, right) =>
            String(right.data()?.[field] || "").localeCompare(String(left.data()?.[field] || ""))
          );
        }
        if (limitCount !== undefined) docs = docs.slice(0, limitCount);
        return { empty: docs.length === 0, docs };
      },
    };
    return query;
  }

  const transaction = {
    get: async (target: { path?: string; get?: () => Promise<unknown> }) =>
      target.path ? snapshot(target.path) : target.get?.(),
    set: (
      ref: { path: string },
      data: Record<string, unknown>,
      options?: { merge?: boolean }
    ) => {
      documents.set(ref.path, options?.merge ? { ...documents.get(ref.path), ...data } : data);
    },
    create: (ref: { path: string }, data: Record<string, unknown>) => {
      if (documents.has(ref.path)) throw new Error("ALREADY_EXISTS");
      documents.set(ref.path, data);
    },
    update: (ref: { path: string }, data: Record<string, unknown>) => {
      documents.set(ref.path, { ...documents.get(ref.path), ...data });
    },
  };

  const adminDb = {
    collection,
    runTransaction: vi.fn((callback: (tx: typeof transaction) => Promise<unknown>) => {
      const result = transactionQueue.then(() => callback(transaction));
      transactionQueue = result.then(() => undefined, () => undefined);
      return result;
    }),
  };

  return {
    adminDb,
    documents,
    transaction,
    reset() {
      documents.clear();
      transactionQueue = Promise.resolve();
    },
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/firebase/admin", () => ({ adminDb: harness.adminDb }));
vi.mock("../../functions/src/firebase-admin", () => ({ adminDb: harness.adminDb }));
vi.mock("@/lib/billing/paddle-config.server", () => ({
  getPaddleConfig: () => ({ isSandbox: true, apiKey: "test-api-key" }),
}));
vi.mock("../../functions/src/commerce/paddle-client", () => ({
  paddle: { transactions: { create: vi.fn() } },
  isSandboxMode: () => true,
}));
vi.mock("../../functions/src/commerce/seo-purchase-analytics", () => ({
  emitVerifiedPurchaseAnalytics: async () => ({ status: "deduplicated", emissionDelta: 0 }),
}));

import { fulfillCheckoutOrder } from "@/lib/billing/fulfill-checkout-order";
import { processWebhookEvent } from "../../functions/src/commerce/webhook-processor";
import { createCheckout } from "../../functions/src/commerce/paddle/checkout-service";
import { processRefund } from "../../functions/src/commerce/refund-service";
import { transitionOrderStatus } from "../../functions/src/commerce/order-service";
import { classifyExistingPaddleEvent } from "../../functions/src/webhook";

const orderId = "ord_concurrency";
const transactionId = "txn_concurrency";
const caseId = "case_concurrency";
const uid = "user_concurrency";
const priceId = "pri_concurrency";

function seedOrder(status = "PAYMENT_PENDING") {
  harness.documents.set(`commerce_orders/${orderId}`, {
    orderId,
    uid,
    caseId,
    productCode: "pack_premium_dossier_v5",
    canonicalProductCode: "pack_premium_dossier_v5",
    paddlePriceId: priceId,
    catalogVersion: "v5",
    status,
    currency: "USD",
    amountMinor: 44900,
    paddleTransactionId: transactionId,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  });
  harness.documents.set(`cbam_cases/${caseId}`, { uid });
}

function paidTransaction(includeAmount = true) {
  return {
    id: transactionId,
    status: "completed",
    currency_code: "USD",
    currencyCode: "USD",
    custom_data: { orderId, caseId },
    customData: { orderId, caseId },
    items: [{ quantity: 1, price_id: priceId, priceId }],
    ...(includeAmount
      ? {
          details: {
            totals: { grand_total: "44900", grandTotal: "44900" },
          },
        }
      : {}),
  };
}

describe("commerce fulfillment integrity", () => {
  beforeEach(() => {
    harness.reset();
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: paidTransaction() }),
      text: async () => "",
    })));
  });

  it("converges confirm and webhook races on one entitlement and unique ledger identities", async () => {
    seedOrder();

    await Promise.all([
      fulfillCheckoutOrder({ uid, orderId, transactionId }),
      processWebhookEvent({
        eventId: "evt_concurrency",
        eventType: "transaction.completed",
        data: paidTransaction(),
      }),
    ]);

    const entitlements = [...harness.documents.entries()].filter(([path]) =>
      path.startsWith("entitlements/")
    );
    const ledger = [...harness.documents.entries()].filter(([path]) =>
      path.startsWith("commerce_ledger/")
    );
    expect(entitlements).toHaveLength(1);
    expect(ledger).toHaveLength(2);
    expect(new Set(ledger.map(([path]) => path)).size).toBe(2);
    expect(harness.documents.get(`commerce_orders/${orderId}`)?.status).toBe("ENTITLED");
  });

  it("retries failed webhook events but only acknowledges processed events", () => {
    const payloadSha256 = "payload_hash";
    expect(
      classifyExistingPaddleEvent(
        { payloadSha256, processingState: "FAILED_RETRYABLE", attempts: 1 },
        payloadSha256
      )
    ).toBe("RETRY");
    expect(
      classifyExistingPaddleEvent(
        { payloadSha256, processingState: "PROCESSED" },
        payloadSha256
      )
    ).toBe("ACK_PROCESSED");
    expect(
      classifyExistingPaddleEvent(
        { payloadSha256: "different", processingState: "FAILED_RETRYABLE" },
        payloadSha256
      )
    ).toBe("PAYLOAD_MISMATCH");
  });

  it("does not fulfill when Paddle omits the verified amount", async () => {
    seedOrder();
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: paidTransaction(false) }),
      text: async () => "",
    })));

    await expect(
      fulfillCheckoutOrder({ uid, orderId, transactionId })
    ).rejects.toThrow("AMOUNT_MISMATCH");
    expect([...harness.documents.keys()].some((path) => path.startsWith("entitlements/"))).toBe(false);
  });

  it("fails checkout closed when case ownership is absent", async () => {
    harness.documents.set(`cbam_cases/${caseId}`, {});
    await expect(
      createCheckout(uid, "user@example.com", "pack_premium_dossier_v5", { caseId })
    ).rejects.toThrow("CASE_OWNERSHIP_MISMATCH");
    expect([...harness.documents.keys()].some((path) => path.startsWith("commerce_orders/"))).toBe(false);
  });

  it("keeps used entitlements immutable and marks the refund after delivery", async () => {
    seedOrder("ENTITLED");
    harness.documents.set("entitlements/ent_used", {
      entitlementId: "ent_used",
      uid,
      orderId,
      productCode: "pack_premium_dossier_v5",
      status: "AVAILABLE",
      releasesCount: 1,
      consumedReportId: "report_1",
    });

    await harness.adminDb.runTransaction((tx) =>
      processRefund(tx as never, {
        uid,
        orderId,
        transactionId,
        eventId: "evt_refund",
        adjustmentId: "adj_refund",
        amountMinor: 44900,
        currency: "USD",
      })
    );

    expect(harness.documents.get("entitlements/ent_used")?.status).toBe("AVAILABLE");
    expect(harness.documents.get(`commerce_orders/${orderId}`)?.status).toBe(
      "REFUNDED_AFTER_DELIVERY"
    );
  });

  it("revokes only unused entitlements on a full verified refund", async () => {
    seedOrder("ENTITLED");
    harness.documents.set("entitlements/ent_unused", {
      entitlementId: "ent_unused",
      uid,
      orderId,
      productCode: "pack_premium_dossier_v5",
      status: "AVAILABLE",
      releasesCount: 0,
    });

    await harness.adminDb.runTransaction((tx) =>
      processRefund(tx as never, {
        uid,
        orderId,
        transactionId,
        eventId: "evt_refund_unused",
        adjustmentId: "adj_refund_unused",
        amountMinor: 44900,
        currency: "USD",
      })
    );

    expect(harness.documents.get("entitlements/ent_unused")?.status).toBe("REVOKED");
    expect(harness.documents.get(`commerce_orders/${orderId}`)?.status).toBe("REFUNDED_UNUSED");
  });

  it("rejects invalid order transitions instead of registering them", async () => {
    seedOrder("REFUNDED_UNUSED");
    await expect(
      transitionOrderStatus(
        harness.transaction as never,
        orderId,
        "ENTITLED"
      )
    ).rejects.toThrow("Order status cannot transition");
    expect(harness.documents.get(`commerce_orders/${orderId}`)?.status).toBe("REFUNDED_UNUSED");
  });
});
