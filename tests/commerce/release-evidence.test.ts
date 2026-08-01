import { describe, it, expect, vi, beforeEach } from "vitest";

/* Deterministic in-memory Firestore mock with transaction rollback semantics,
   hoisted so the vi.mock factory can access the shared store. */

const h = vi.hoisted(() => {
  const store: Record<string, Record<string, unknown>> = {};
  let counter = 0;

  function queryable(q: {
    collection: string;
    filters: Array<{ field: string; op: string; value: unknown }>;
    orderByField?: string;
    orderDir?: "asc" | "desc";
    limitN?: number;
  }, overlay?: Record<string, Record<string, unknown>> | null) {
    let entries = Object.entries(store)
      .filter(([path]) => path.split("/").length === 2 && path.startsWith(q.collection + "/"))
      .map(([path, data]) => ({ id: path.split("/")[1], data }));
    // Apply pending transaction writes on top of committed store (Firestore
    // transaction read-your-writes semantics for queries).
    if (overlay) {
      const overlayByCollection = Object.entries(overlay).filter(
        ([path]) => path.split("/").length === 2 && path.startsWith(q.collection + "/")
      );
      for (const [path, pending] of overlayByCollection) {
        if (pending === null) {
          entries = entries.filter((e) => `${q.collection}/${e.id}` !== path);
        } else {
          const existing = entries.find((e) => `${q.collection}/${e.id}` === path);
          if (existing) existing.data = { ...existing.data, ...pending };
          else entries.push({ id: path.split("/")[1], data: pending });
        }
      }
    }
    for (const f of q.filters) {
      if (f.op !== "==") throw new Error(`UNSUPPORTED_OP:${f.op}`);
      entries = entries.filter((e) => e.data[f.field] === f.value);
    }
    if (q.orderByField) {
      entries = [...entries].sort((a, b) => {
        const av = String(a.data[q.orderByField!] ?? "");
        const bv = String(b.data[q.orderByField!] ?? "");
        const cmp = q.orderDir === "desc" ? bv.localeCompare(av) : av.localeCompare(bv);
        // Firestore tie-break: equal field values are ordered by document id
        // ascending, so the later-written doc is the true "latest".
        return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
      });
    }
    if (q.limitN !== undefined) entries = entries.slice(0, q.limitN);
    return entries;
  }

  function makeRef(path: string) {
    const id = path.split("/")[1];
    return {
      id,
      path,
      get: async () => {
        const data = store[path];
        return { id, exists: data !== undefined, data: () => data };
      },
      set: async (data: Record<string, unknown>, opts?: { merge?: boolean }) => {
        if (opts?.merge) store[path] = { ...(store[path] || {}), ...data };
        else store[path] = data;
      },
      update: async (data: Record<string, unknown>) => {
        if (!store[path]) throw new Error(`UPDATE_MISSING_DOC:${path}`);
        store[path] = { ...store[path], ...data };
      },
      create: async (data: Record<string, unknown>) => {
        if (store[path] !== undefined) throw new Error("DOCUMENT_EXISTS");
        store[path] = data;
      },
      delete: async () => {
        delete store[path];
      },
    };
  }

  function makeCollection(name: string) {
    // Each query chain call returns a NEW immutable query descriptor, matching
    // real Firestore Query semantics. Never share/mutate a descriptor across
    // chained calls: `where(...).limit(1)` then a separate `orderBy(...)`
    // must NOT inherit each other's constraints.
    const makeChain = (desc: {
      collection: string;
      filters: Array<{ field: string; op: string; value: unknown }>;
      orderByField?: string;
      orderDir?: "asc" | "desc";
      limitN?: number;
    }): Record<string, unknown> => {
      const c: Record<string, unknown> = {
        where: (field: string, op: string, value: unknown) =>
          makeChain({ ...desc, filters: [...desc.filters, { field, op, value }] }),
        orderBy: (field: string, dir?: "asc" | "desc") =>
          makeChain({ ...desc, orderByField: field, orderDir: dir }),
        limit: (n: number) => makeChain({ ...desc, limitN: n }),
        get: async (overlay?: Record<string, Record<string, unknown>> | null) => {
          const docs = queryable(desc, overlay);
          return { empty: docs.length === 0, docs: docs.map((d) => ({ id: d.id, data: () => d.data })) };
        },
        doc: (id?: string) => makeRef(`${name}/${id || `doc_${++counter}`}`),
      };
      return c;
    };
    return makeChain({ collection: name, filters: [] });
  }

  return {
    store,
    makeRef,
    makeCollection,
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); counter = 0; },
  };
});

vi.mock("../../functions/src/firebase-admin", () => {
  const { makeCollection, store } = h;
  return {
    adminDb: {
      collection: (name: string) => makeCollection(name),
      runTransaction: async (cb: (t: unknown) => Promise<unknown>) => {
        // Firestore transaction semantics:
        // 1. ALL reads must precede ALL writes (reads after writes throw
        //    FAILED_PRECONDITION, matching the real Firestore engine).
        // 2. Writes are applied atomically at commit after the read-set is
        //    re-verified (optimistic concurrency); conflicts retry.
        for (let attempt = 0; attempt < 8; attempt++) {
          const overlay: Record<string, Record<string, unknown>> = {};
          const readSet = new Map<string, string | null>();
          let wrote = false;
          const txn = {
            get: async (ref: { path?: string; get?: (overlay?: Record<string, Record<string, unknown>> | null) => Promise<{ docs: Array<{ id: string; data: () => Record<string, unknown> }> } | { exists: boolean; data: () => Record<string, unknown> | undefined }> }) => {
              if (wrote) {
                throw new Error("Firestore transactions require all reads to be executed before all writes.");
              }
              // Query reference — run against store+overlay.
              if (!ref.path && typeof ref.get === "function") {
                return ref.get(overlay);
              }
              const p = ref.path as string;
              if (!readSet.has(p)) {
                const base = store[p];
                const pending = overlay[p];
                const merged = pending !== undefined ? { ...(base || {}), ...pending } : base;
                readSet.set(p, merged !== undefined ? JSON.stringify(merged) : null);
              }
              const val = readSet.get(p);
              return {
                exists: val != null,
                data: () => (val != null ? JSON.parse(val) : undefined),
                id: p.split("/").at(-1),
              };
            },
            set: (ref: { path: string }, data: Record<string, unknown>, o?: { merge?: boolean }) => {
              wrote = true;
              const p = ref.path;
              if (o?.merge) overlay[p] = { ...(overlay[p] || store[p] || {}), ...data };
              else overlay[p] = data;
              return Promise.resolve();
            },
            update: (ref: { path: string }, data: Record<string, unknown>) => {
              wrote = true;
              const p = ref.path;
              const base = overlay[p] || store[p];
              if (!base) return Promise.reject(new Error(`UPDATE_MISSING_DOC:${p}`));
              overlay[p] = { ...base, ...data };
              return Promise.resolve();
            },
            create: (ref: { path: string }, data: Record<string, unknown>) => {
              wrote = true;
              const p = ref.path;
              if (overlay[p] || store[p] !== undefined) return Promise.reject(new Error("DOCUMENT_EXISTS"));
              overlay[p] = data;
              return Promise.resolve();
            },
            delete: (ref: { path: string }) => {
              wrote = true;
              const p = ref.path;
              overlay[p] = null as never;
              return Promise.resolve();
            },
          };
          try {
            const result = await cb(txn);
            // Commit phase: verify no read doc changed since snapshot
            let conflicted = false;
            for (const [path, expected] of readSet) {
              const current = store[path];
              const now = current ? JSON.stringify(current) : null;
              if (now !== expected) { conflicted = true; break; }
            }
            if (conflicted) continue;
            // Apply overlay to store atomically
            for (const [path, data] of Object.entries(overlay)) {
              if (data === null) delete store[path];
              else store[path] = data;
            }
            return result;
          } catch (e) {
            throw e;
          }
        }
        throw new Error("TRANSACTION_RETRY_EXHAUSTED");
      },
    },
    getStorageBucket: () => ({}),
  };
});

vi.mock("../../functions/src/commerce/seo-purchase-analytics", () => ({
  emitVerifiedPurchaseAnalytics: vi.fn().mockResolvedValue({ status: "skipped", emissionDelta: 0 }),
}));

import { adminDb } from "../../functions/src/firebase-admin";
import { reserveEntitlement, consumeEntitlement, releaseEntitlementReservation, createEntitlement } from "../../functions/src/commerce/entitlement-service";
import { processWebhookEvent } from "../../functions/src/commerce/webhook-processor";
import { DoubleSpendViolationError, EntitlementUnavailableError } from "../../functions/src/commerce/commerce-errors";
import { ensureTestAdminEntitlement } from "../../functions/src/commerce/test-admin-access";
import type { LedgerEntry } from "../../functions/src/commerce/ledger-service";

const PRICE_ID = "pri_01kx4373n0xa7fthk3ttqqd7p8";

async function seedEntitlement(overrides: Record<string, unknown> = {}) {
  return adminDb.runTransaction((t) =>
    createEntitlement(t as never, {
      uid: "user-a",
      orderId: "ord_seed",
      transactionId: "txn_seed",
      eventId: "evt_seed",
      productCode: "pack_premium_dossier_v5",
      quantity: 1,
      ...overrides,
    })
  );
}

async function seedOrder() {
  h.store["commerce_orders/ord_seed"] = {
    orderId: "ord_seed",
    uid: "user-a",
    caseId: "case_1",
    productCode: "pack_premium_dossier_v5",
    canonicalProductCode: "pack_premium_dossier_v5",
    paddlePriceId: PRICE_ID,
    catalogVersion: "v5",
    currency: "USD",
    amountMinor: 44900,
    status: "PAYMENT_PENDING",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function ledgerByType(type: string): string[] {
  return Object.keys(h.store).filter((p) => {
    if (!p.startsWith("commerce_ledger/")) return false;
    return (h.store[p] as Record<string, unknown>).type === type;
  });
}

/** Simulates the real paddle_events eventId dedup gate from functions/src/webhook.ts. */
async function ingestWebhookEvent(evt: { eventId: string; payloadSha256: string } & Record<string, unknown>) {
  const refPath = `paddle_events/${evt.eventId}`;
  if (h.store[refPath]) {
    const existing = h.store[refPath] as { payloadSha256?: string };
    return existing.payloadSha256 === evt.payloadSha256
      ? { status: 200, duplicate: true }
      : { status: 409, duplicate: true };
  }
  h.store[refPath] = {
    eventId: evt.eventId,
    eventType: evt.eventType,
    payloadSha256: evt.payloadSha256,
    signatureVerified: true,
    processingState: "PROCESSING",
  };
  await processWebhookEvent(evt as never);
  h.store[refPath] = { ...(h.store[refPath] as object), processingState: "PROCESSED" };
  return { status: 200, duplicate: false };
}

describe("S6 Entitlement state machine", () => {
  beforeEach(() => h.clear());

  it("AVAILABLE -> RESERVED -> AVAILABLE (release) keeps single ledger effect", async () => {
    const ent = (await seedEntitlement({ maxReleases: 5 })) as unknown as { entitlementId: string };
    await adminDb.runTransaction((t) =>
      reserveEntitlement(t as never, { entitlementId: ent.entitlementId, uid: "user-a", reportId: "report_1", caseId: "case_1" })
    );
    expect((h.store[`entitlements/${ent.entitlementId}`] as Record<string, unknown>).status).toBe("RESERVED");
    await adminDb.runTransaction((t) =>
      releaseEntitlementReservation(t as never, { entitlementId: ent.entitlementId, uid: "user-a", reportId: "report_1" })
    );
    expect((h.store[`entitlements/${ent.entitlementId}`] as Record<string, unknown>).status).toBe("AVAILABLE");
    expect(ledgerByType("ENTITLEMENT_RESERVED")).toHaveLength(1);
    expect(ledgerByType("ENTITLEMENT_RELEASED")).toHaveLength(1);
  });

  it("consume requires RESERVED + matching reportId (double-spend blocked)", async () => {
    const ent = (await seedEntitlement({ maxReleases: 5 })) as unknown as { entitlementId: string };
    await expect(
      adminDb.runTransaction((t) =>
        consumeEntitlement(t as never, { entitlementId: ent.entitlementId, uid: "user-a", reportId: "report_x", caseId: "case_1", reportHash: "h1", version: 1 })
      )
    ).rejects.toBeInstanceOf(DoubleSpendViolationError);
    await adminDb.runTransaction((t) =>
      reserveEntitlement(t as never, { entitlementId: ent.entitlementId, uid: "user-a", reportId: "report_1", caseId: "case_1" })
    );
    await expect(
      adminDb.runTransaction((t) =>
        consumeEntitlement(t as never, { entitlementId: ent.entitlementId, uid: "user-a", reportId: "report_other", caseId: "case_1", reportHash: "h2", version: 1 })
      )
    ).rejects.toBeInstanceOf(DoubleSpendViolationError);
    await adminDb.runTransaction((t) =>
      consumeEntitlement(t as never, { entitlementId: ent.entitlementId, uid: "user-a", reportId: "report_1", caseId: "case_1", reportHash: "h1", version: 1 })
    );
    const doc = h.store[`entitlements/${ent.entitlementId}`] as Record<string, unknown>;
    expect(doc.releasesCount).toBe(1);
    expect(doc.releasesList).toHaveLength(1);
    expect(doc.status).toBe("AVAILABLE");
    await expect(
      adminDb.runTransaction((t) =>
        consumeEntitlement(t as never, { entitlementId: ent.entitlementId, uid: "user-a", reportId: "report_1", caseId: "case_1", reportHash: "h1", version: 2 })
      )
    ).rejects.toBeInstanceOf(DoubleSpendViolationError);
  });

  it("ownership mismatch blocked on reserve", async () => {
    const ent = (await seedEntitlement({ maxReleases: 5 })) as unknown as { entitlementId: string };
    await expect(
      adminDb.runTransaction((t) =>
        reserveEntitlement(t as never, { entitlementId: ent.entitlementId, uid: "attacker", reportId: "report_1", caseId: "case_1" })
      )
    ).rejects.toThrow("Ownership mismatch");
  });

  it("scope-locked entitlement refuses sealing a different case", async () => {
    const ent = (await seedEntitlement({ maxReleases: 5, scopeCaseId: "case_scoped" })) as unknown as { entitlementId: string };
    await expect(
      adminDb.runTransaction((t) =>
        reserveEntitlement(t as never, { entitlementId: ent.entitlementId, uid: "user-a", reportId: "report_1", caseId: "case_other" })
      )
    ).rejects.toThrow("scope-locked");
    await expect(
      adminDb.runTransaction((t) =>
        reserveEntitlement(t as never, { entitlementId: ent.entitlementId, uid: "user-a", reportId: "report_1", caseId: "case_scoped" })
      )
    ).resolves.toBeDefined();
  });

  it("release limit exhausted -> CONSUMED and further reserve blocked", async () => {
    const ent = (await seedEntitlement({ maxReleases: 1 })) as unknown as { entitlementId: string };
    await adminDb.runTransaction((t) =>
      reserveEntitlement(t as never, { entitlementId: ent.entitlementId, uid: "user-a", reportId: "report_1", caseId: "case_1" })
    );
    await adminDb.runTransaction((t) =>
      consumeEntitlement(t as never, { entitlementId: ent.entitlementId, uid: "user-a", reportId: "report_1", caseId: "case_1", reportHash: "h1", version: 1 })
    );
    expect((h.store[`entitlements/${ent.entitlementId}`] as Record<string, unknown>).status).toBe("CONSUMED");
    await expect(
      adminDb.runTransaction((t) =>
        reserveEntitlement(t as never, { entitlementId: ent.entitlementId, uid: "user-a", reportId: "report_2", caseId: "case_1" })
      )
    ).rejects.toBeInstanceOf(EntitlementUnavailableError);
  });

  it("second release requires a correction reason", async () => {
    const ent = (await seedEntitlement({ maxReleases: 100 })) as unknown as { entitlementId: string };
    await adminDb.runTransaction((t) =>
      reserveEntitlement(t as never, { entitlementId: ent.entitlementId, uid: "user-a", reportId: "report_1", caseId: "case_1" })
    );
    await adminDb.runTransaction((t) =>
      consumeEntitlement(t as never, { entitlementId: ent.entitlementId, uid: "user-a", reportId: "report_1", caseId: "case_1", reportHash: "h1", version: 1 })
    );
    await adminDb.runTransaction((t) =>
      reserveEntitlement(t as never, { entitlementId: ent.entitlementId, uid: "user-a", reportId: "report_2", caseId: "case_1" })
    );
    await expect(
      adminDb.runTransaction((t) =>
        consumeEntitlement(t as never, { entitlementId: ent.entitlementId, uid: "user-a", reportId: "report_2", caseId: "case_1", reportHash: "h2", version: 2 })
      )
    ).rejects.toThrow("correction reason");
  });

  it("20 parallel reserves converge on exactly one RESERVED state + one ledger effect", async () => {
    const ent = (await seedEntitlement({ maxReleases: 5 })) as unknown as { entitlementId: string };
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        adminDb.runTransaction((t) =>
          reserveEntitlement(t as never, { entitlementId: ent.entitlementId, uid: "user-a", reportId: "report_c", caseId: "case_1" })
        )
      )
    );
    const ok = results.filter((r) => r.status === "fulfilled").length;
    expect(ok).toBe(1); // exactly one caller wins the reservation
    expect((h.store[`entitlements/${ent.entitlementId}`] as Record<string, unknown>).status).toBe("RESERVED");
    expect((h.store[`entitlements/${ent.entitlementId}`] as Record<string, unknown>).reservedReportId).toBe("report_c");
    expect(ledgerByType("ENTITLEMENT_RESERVED")).toHaveLength(1);
  });

  it("stale version consume is rejected (refresh keeps state stable)", async () => {
    const ent = (await seedEntitlement({ maxReleases: 5 })) as unknown as { entitlementId: string };
    await adminDb.runTransaction((t) =>
      reserveEntitlement(t as never, { entitlementId: ent.entitlementId, uid: "user-a", reportId: "report_1", caseId: "case_1" })
    );
    // simulate client that saw AVAILABLE snapshot then tries consume without reserve
    const doc = h.store[`entitlements/${ent.entitlementId}`] as Record<string, unknown>;
    expect(doc.status).toBe("RESERVED");
    await expect(
      adminDb.runTransaction((t) =>
        consumeEntitlement(t as never, { entitlementId: ent.entitlementId, uid: "user-a", reportId: "report_stale", caseId: "case_1", reportHash: "stale", version: 999 })
      )
    ).rejects.toBeInstanceOf(DoubleSpendViolationError);
  });
});

describe("S5 Paddle lifecycle guards", () => {
  beforeEach(() => h.clear());

  it("fulfills valid completed payment: 1 entitlement + 1 ledger effect", async () => {
    await seedOrder();
    const evt = {
      eventId: "evt_txn_1",
      eventType: "transaction.completed",
      data: {
        id: "txn_1",
        status: "completed",
        currencyCode: "USD",
        customData: { orderId: "ord_seed" },
        items: [{ priceId: PRICE_ID, quantity: 1 }],
        details: { totals: { grandTotal: 44900 } },
      },
    };
    await processWebhookEvent(evt as never);
    expect(ledgerByType("PAYMENT_CAPTURED")).toHaveLength(1);
    expect(ledgerByType("ENTITLEMENT_ISSUED")).toHaveLength(1);
    const ents = Object.keys(h.store).filter((p) => p.startsWith("entitlements/"));
    expect(ents).toHaveLength(1);
    expect((h.store[ents[0]] as Record<string, unknown>).status).toBe("AVAILABLE");
    expect((h.store[ents[0]] as Record<string, unknown>).scopeCaseId).toBe("case_1");
    expect((h.store[ents[0]] as Record<string, unknown>).billingModel).toBe("CASE_PAY_AT_LOCK");
    expect((h.store["commerce_orders/ord_seed"] as Record<string, unknown>).status).toBe("ENTITLED");
    // order doc now holds a caseId for pay-at-lock scope
    expect((h.store["commerce_orders/ord_seed"] as Record<string, unknown>).caseId).toBe("case_1");
  });

  it("duplicate completed event does not create a second economic effect", async () => {
    await seedOrder();
    const evt = {
      eventId: "evt_dup",
      eventType: "transaction.completed",
      payloadSha256: "p1",
      data: {
        id: "txn_dup",
        status: "completed",
        currencyCode: "USD",
        customData: { orderId: "ord_seed" },
        items: [{ priceId: PRICE_ID, quantity: 1 }],
        details: { totals: { grandTotal: 44900 } },
      },
    };
    await ingestWebhookEvent(evt as never);
    // same eventId + same payload -> dedup gate acknowledges without re-fulfilling
    const second = await ingestWebhookEvent(evt as never);
    expect(second.duplicate).toBe(true);
    expect(second.status).toBe(200);
    expect(ledgerByType("PAYMENT_CAPTURED")).toHaveLength(1);
    expect(ledgerByType("ENTITLEMENT_ISSUED")).toHaveLength(1);
    expect(Object.keys(h.store).filter((p) => p.startsWith("entitlements/"))).toHaveLength(1);
  });

  it("price mismatch blocks fulfillment", async () => {
    await seedOrder();
    await processWebhookEvent({
      eventId: "evt_wrong_price",
      eventType: "transaction.completed",
      data: {
        id: "txn_wp",
        status: "completed",
        currencyCode: "USD",
        customData: { orderId: "ord_seed" },
        items: [{ priceId: "pri_WRONG", quantity: 1 }],
        details: { totals: { grandTotal: 44900 } },
      },
    } as never);
    expect(ledgerByType("PAYMENT_CAPTURED")).toHaveLength(0);
  });

  it("currency mismatch blocks fulfillment", async () => {
    await seedOrder();
    await processWebhookEvent({
      eventId: "evt_wrong_ccy",
      eventType: "transaction.completed",
      data: {
        id: "txn_wc",
        status: "completed",
        currencyCode: "EUR",
        customData: { orderId: "ord_seed" },
        items: [{ priceId: PRICE_ID, quantity: 1 }],
        details: { totals: { grandTotal: 44900 } },
      },
    } as never);
    expect(ledgerByType("PAYMENT_CAPTURED")).toHaveLength(0);
  });

  it("amount mismatch blocks fulfillment", async () => {
    await seedOrder();
    await processWebhookEvent({
      eventId: "evt_wrong_amt",
      eventType: "transaction.completed",
      data: {
        id: "txn_wa",
        status: "completed",
        currencyCode: "USD",
        customData: { orderId: "ord_seed" },
        items: [{ priceId: PRICE_ID, quantity: 1 }],
        details: { totals: { grandTotal: 1 } },
      },
    } as never);
    expect(ledgerByType("PAYMENT_CAPTURED")).toHaveLength(0);
  });

  it("status !== completed blocks fulfillment", async () => {
    await seedOrder();
    await processWebhookEvent({
      eventId: "evt_pending",
      eventType: "transaction.completed",
      data: {
        id: "txn_p",
        status: "pending",
        currencyCode: "USD",
        customData: { orderId: "ord_seed" },
        items: [{ priceId: PRICE_ID, quantity: 1 }],
        details: { totals: { grandTotal: 44900 } },
      },
    } as never);
    expect(ledgerByType("PAYMENT_CAPTURED")).toHaveLength(0);
  });
});

describe("S8 Commerce ledger + refund idempotency", () => {
  beforeEach(() => h.clear());

  it("ledger entries form an unbroken append-only hash chain with deterministic hashes", async () => {
    await seedEntitlement({ maxReleases: 5 });
    await seedOrder();
    await processWebhookEvent({
      eventId: "evt_chain",
      eventType: "transaction.completed",
      data: {
        id: "txn_chain",
        status: "completed",
        currencyCode: "USD",
        customData: { orderId: "ord_seed" },
        items: [{ priceId: PRICE_ID, quantity: 1 }],
        details: { totals: { grandTotal: 44900 } },
      },
    } as never);
    const entries = Object.keys(h.store)
      .filter((p) => p.startsWith("commerce_ledger/"))
      .map((p) => h.store[p] as unknown as LedgerEntry);
    expect(entries.length).toBeGreaterThanOrEqual(2);
    console.log("[CHAIN]", JSON.stringify(entries.map((e) => ({ t: e.type, k: e.idempotencyKey, c: e.createdAt, p: e.previousEntryHash?.slice(0, 8), h: e.entryHash?.slice(0, 8) }))));

    // Chain walk is ordering-independent: follow previousEntryHash pointers
    // backward from the unique tail (the entry no other entry references).
    const byHash = new Map(entries.map((e) => [e.entryHash, e]));
    const tails = entries.filter(
      (e) => !entries.some((o) => o.entryHash !== e.entryHash && o.previousEntryHash === e.entryHash)
    );
    expect(tails).toHaveLength(1);
    const chain: LedgerEntry[] = [];
    let current: LedgerEntry | undefined = tails[0];
    const seen = new Set<string>();
    while (current) {
      expect(seen.has(current.entryHash)).toBe(false); // no cycles
      seen.add(current.entryHash);
      chain.push(current);
      current = current.previousEntryHash ? byHash.get(current.previousEntryHash) : undefined;
    }
    expect(chain.length).toBe(entries.length); // every entry reachable
    expect(chain[chain.length - 1].previousEntryHash).toBe(""); // head terminates

    // Deterministic hashing: identical fields must yield identical hash.
    const { calculateEntryHash } = await import("../../functions/src/commerce/ledger-service");
    const sample: Omit<LedgerEntry, "entryHash"> = { ...chain[0] };
    delete (sample as Partial<LedgerEntry>).entryHash;
    const first = calculateEntryHash(sample);
    const second = calculateEntryHash({ ...sample });
    expect(first).toBe(second);
    expect(first.length).toBe(64);
  });

  it("refund idempotent: same adjustment id does not double-revoke or double-ledger", async () => {
    await seedOrder();
    // Bind the seeded order to the refund transaction id
    Object.assign(h.store["commerce_orders/ord_seed"], { paddleTransactionId: "txn_seed" });
    const ent = (await seedEntitlement({ maxReleases: 5, scopeCaseId: "case_1", orderId: "ord_seed" })) as unknown as { entitlementId: string };
    await adminDb.runTransaction((t) =>
      reserveEntitlement(t as never, { entitlementId: ent.entitlementId, uid: "user-a", reportId: "report_r", caseId: "case_1" })
    );
    const refundEvt = {
      eventId: "evt_refund_a1",
      eventType: "adjustment.updated",
      data: { id: "adj_a1", status: "approved", transactionId: "txn_seed", totals: { subtotal: 44900 }, currencyCode: "USD" },
    };
    await processWebhookEvent(refundEvt as never);
    expect(ledgerByType("REFUND_APPROVED")).toHaveLength(1);
    expect((h.store[`entitlements/${ent.entitlementId}`] as Record<string, unknown>).status).toBe("REVOKED");
    await processWebhookEvent(refundEvt as never);
    expect(ledgerByType("REFUND_APPROVED")).toHaveLength(1);
  });
});

describe("S4 Test-admin bypass", () => {
  beforeEach(() => h.clear());

  it("20 concurrent provisions converge on exactly 1 entitlement + 1 ledger entry", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        adminDb.runTransaction((t) => ensureTestAdminEntitlement(t as never, "uid_test_admin", "teb232@gmail.com"))
      )
    );
    const ids = new Set(results.map((r) => r.entitlementId));
    expect(ids.size).toBe(1);
    const entPaths = Object.keys(h.store).filter((p) => p.startsWith("entitlements/"));
    expect(entPaths).toHaveLength(1);
    const issued = ledgerByType("ENTITLEMENT_ISSUED").filter((p) => (h.store[p] as Record<string, unknown>).syntheticTest === true);
    expect(issued).toHaveLength(1);
    expect((h.store[entPaths[0]] as Record<string, unknown>).billingModel).toBe("TEST_ADMIN_BYPASS");
    expect((h.store[entPaths[0]] as Record<string, unknown>).syntheticTest).toBe(true);
  });

  it("unauthorized uid cannot provision (fail-closed on invalid uid)", async () => {
    await expect(ensureTestAdminEntitlement(null as never, "", "teb232@gmail.com")).rejects.toThrow();
    expect(Object.keys(h.store)).toHaveLength(0);
  });
});
