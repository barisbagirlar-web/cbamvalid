import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  buildPurchaseAnalyticsIdempotencyKey,
  createMemoryPurchaseAnalyticsStore,
  emitPurchaseAnalyticsExactlyOnce,
} from "@/lib/seo/purchase-analytics-idempotency";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const mockDocs: Record<string, Record<string, unknown>> = {};

type QueryFilter = { field: string; operator: string; value: unknown };

function documentSnapshot(path: string, data: Record<string, unknown>) {
  return {
    id: path.split("/").at(-1) || path,
    exists: true,
    data: () => data,
  };
}

const mockDbTransaction = {
  get: vi.fn(async (reference: { path?: string; get?: () => Promise<unknown> }) => {
    if (reference && typeof reference.get === "function" && !reference.path) {
      return reference.get();
    }
    const path = reference?.path || "";
    const data = mockDocs[path];
    return {
      id: path.split("/").at(-1) || path,
      exists: Boolean(data),
      data: () => data,
    };
  }),
  set: vi.fn((reference: { path: string }, data: Record<string, unknown>) => {
    mockDocs[reference.path] = data;
  }),
  update: vi.fn((reference: { path: string }, data: Record<string, unknown>) => {
    mockDocs[reference.path] = { ...mockDocs[reference.path], ...data };
  }),
};

vi.mock("../../functions/src/firebase-admin", () => ({
  adminDb: {
    collection: (collectionName: string) => {
      const filters: QueryFilter[] = [];
      let resultLimit: number | undefined;
      const collection = {
        where: vi.fn((field: string, operator: string, value: unknown) => {
          filters.push({ field, operator, value });
          return collection;
        }),
        limit: vi.fn((value: number) => {
          resultLimit = value;
          return collection;
        }),
        orderBy: vi.fn(() => collection),
        get: vi.fn(async () => {
          const prefix = `${collectionName}/`;
          let documents = Object.entries(mockDocs)
            .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes("/"))
            .filter(([, data]) =>
              filters.every((filter) => {
                if (filter.operator !== "==") throw new Error(`UNSUPPORTED_MOCK_QUERY_OPERATOR:${filter.operator}`);
                return data[filter.field] === filter.value;
              }),
            )
            .map(([path, data]) => documentSnapshot(path, data));
          if (resultLimit !== undefined) documents = documents.slice(0, resultLimit);
          return { empty: documents.length === 0, docs: documents };
        }),
        doc: (documentId?: string) => {
          const id = documentId || Math.random().toString(36).substring(2, 15);
          const path = `${collectionName}/${id}`;
          return {
            id,
            path,
            get: async () => {
              const data = mockDocs[path];
              return { id, exists: Boolean(data), data: () => data };
            },
            set: async (data: Record<string, unknown>) => {
              mockDocs[path] = data;
            },
          };
        },
      };
      return collection;
    },
  },
}));

import { writeLedgerEntry } from "../../functions/src/commerce/ledger-service";
import { createEntitlement } from "../../functions/src/commerce/entitlement-service";

describe("Persistent purchase analytics idempotency", () => {
  const store = createMemoryPurchaseAnalyticsStore();

  beforeEach(() => {
    store.reset();
    for (const key of Object.keys(mockDocs)) delete mockDocs[key];
    vi.clearAllMocks();
  });

  it("PURCHASE_DEDUP_PERSISTENT: key scheme matches commerce payment style", () => {
    expect(buildPurchaseAnalyticsIdempotencyKey("txn_abc123")).toBe("analytics_purchase:txn_abc123");
  });

  it("PURCHASE_REPLAY_TEST: second emission is duplicate with delta 0", async () => {
    let emissions = 0;
    const input = {
      transactionId: "txn_replay_1",
      eventId: "evt_1",
      value: 149,
      currency: "USD" as const,
      emitter: "test" as const,
    };

    const first = await emitPurchaseAnalyticsExactlyOnce(store, input, async () => {
      emissions += 1;
    });
    const second = await emitPurchaseAnalyticsExactlyOnce(store, input, async () => {
      emissions += 1;
    });

    expect(first.status).toBe("emitted");
    expect(first.emissionDelta).toBe(1);
    expect(second.status).toBe("duplicate");
    expect(second.emissionDelta).toBe(0);
    expect(emissions).toBe(1);
    expect(store.size()).toBe(1);
  });

  it("PURCHASE_CONCURRENT_REPLAY_TEST: parallel claims emit exactly once", async () => {
    let emissions = 0;
    const input = {
      transactionId: "txn_concurrent_1",
      eventId: "evt_c1",
      value: 149,
      currency: "USD" as const,
      emitter: "test" as const,
    };

    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        emitPurchaseAnalyticsExactlyOnce(store, input, async () => {
          emissions += 1;
        }),
      ),
    );

    const created = results.filter((r) => r.status === "emitted");
    const duplicates = results.filter((r) => r.status === "duplicate");
    const deltaSum = results.reduce((acc, r) => acc + r.emissionDelta, 0);

    expect(created).toHaveLength(1);
    expect(duplicates).toHaveLength(19);
    expect(emissions).toBe(1);
    expect(deltaSum).toBe(1);
    expect(store.size()).toBe(1);
  });

  it("track route uses Firestore store, not process-local Map", () => {
    const src = readFileSync(resolve("app/api/seo/track/route.ts"), "utf8");
    expect(src).toContain("createFirestorePurchaseAnalyticsStore");
    expect(src).toContain("emitPurchaseAnalyticsExactlyOnce");
    expect(src).not.toMatch(/new Map\s*</);
    expect(src).not.toMatch(/purchaseDedupe/);
  });

  it("LEDGER_DUPLICATE_DELTA=0 on payment and entitlement ledger key replay", async () => {
    const txId = "txn_ledger_replay";
    const eventId = "evt_ledger_replay";

    const firstPayment = await writeLedgerEntry(mockDbTransaction as never, {
      uid: "uid-1",
      orderId: "ord-1",
      transactionId: txId,
      eventId,
      type: "PAYMENT_CAPTURED",
      quantity: 1,
      currency: "USD",
      amountMinor: 14900,
      idempotencyKey: `payment:${txId}`,
    });
    const secondPayment = await writeLedgerEntry(mockDbTransaction as never, {
      uid: "uid-1",
      orderId: "ord-1",
      transactionId: txId,
      eventId,
      type: "PAYMENT_CAPTURED",
      quantity: 1,
      currency: "USD",
      amountMinor: 14900,
      idempotencyKey: `payment:${txId}`,
    });
    expect(secondPayment.entryId).toBe(firstPayment.entryId);

    const firstEntLedger = await writeLedgerEntry(mockDbTransaction as never, {
      uid: "uid-1",
      orderId: "ord-1",
      transactionId: txId,
      eventId,
      type: "ENTITLEMENT_ISSUED",
      quantity: 5,
      idempotencyKey: `entitlement:${txId}:pack_premium_dossier_v5`,
    });
    const secondEntLedger = await writeLedgerEntry(mockDbTransaction as never, {
      uid: "uid-1",
      orderId: "ord-1",
      transactionId: txId,
      eventId,
      type: "ENTITLEMENT_ISSUED",
      quantity: 5,
      idempotencyKey: `entitlement:${txId}:pack_premium_dossier_v5`,
    });
    expect(secondEntLedger.entryId).toBe(firstEntLedger.entryId);

    const ledgerDocs = Object.values(mockDocs).filter((d) => typeof d.idempotencyKey === "string");
    const paymentKeys = ledgerDocs.filter((d) => d.idempotencyKey === `payment:${txId}`);
    const entitlementKeys = ledgerDocs.filter(
      (d) => d.idempotencyKey === `entitlement:${txId}:pack_premium_dossier_v5`,
    );
    expect(paymentKeys).toHaveLength(1);
    expect(entitlementKeys).toHaveLength(1);

    // Canonical entitlement create once (order-state machine prevents webhook re-entry).
    const entitlement = await createEntitlement(mockDbTransaction as never, {
      uid: "uid-1",
      orderId: "ord-1",
      transactionId: txId,
      eventId,
      productCode: "pack_premium_dossier_v5",
      quantity: 5,
    });
    expect(entitlement.entitlementId).toBeTruthy();
    const entitlementCount = Object.keys(mockDocs).filter((p) => p.startsWith("entitlements/")).length;
    expect(entitlementCount).toBe(1);

    let analyticsEmissions = 0;
    const a1 = await emitPurchaseAnalyticsExactlyOnce(
      store,
      {
        transactionId: txId,
        eventId,
        value: 149,
        currency: "USD",
        emitter: "paddle_webhook",
      },
      async () => {
        analyticsEmissions += 1;
      },
    );
    const a2 = await emitPurchaseAnalyticsExactlyOnce(
      store,
      {
        transactionId: txId,
        eventId,
        value: 149,
        currency: "USD",
        emitter: "api_seo_track",
      },
      async () => {
        analyticsEmissions += 1;
      },
    );

    expect(a1.emissionDelta + a2.emissionDelta).toBe(1);
    expect(analyticsEmissions).toBe(1);
  });
});
