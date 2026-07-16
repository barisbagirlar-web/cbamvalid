import { beforeEach, describe, expect, it, vi } from "vitest";
import { PREPARATION_PACK } from "../../functions/src/commerce/preparation-pack";

const documents: Record<string, Record<string, unknown>> = {};

type Filter = { field: string; operator: string; value: unknown };

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
  const filters: Filter[] = [];
  const query = {
    where(field: string, operator: string, value: unknown) {
      filters.push({ field, operator, value });
      return query;
    },
    async get() {
      const prefix = `${path}/`;
      const docs = Object.keys(documents)
        .filter((candidate) => candidate.startsWith(prefix))
        .filter((candidate) => !candidate.slice(prefix.length).includes("/"))
        .filter((candidate) => filters.every((filter) => {
          if (filter.operator !== "==") throw new Error(`UNSUPPORTED_OPERATOR:${filter.operator}`);
          return documents[candidate][filter.field] === filter.value;
        }))
        .sort()
        .map(snapshot);
      return { empty: docs.length === 0, docs };
    },
    doc(id: string) {
      return documentReference(`${path}/${id}`);
    },
  };
  return query;
}

const transaction = {
  get: vi.fn(async (reference: { path?: string; get?: () => Promise<unknown> }) => {
    if (reference.path) return snapshot(reference.path);
    if (typeof reference.get === "function") return reference.get();
    throw new Error("UNSUPPORTED_REFERENCE");
  }),
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

const uid = "user-123";
const orderId = `ord_${"a".repeat(64)}`;
const transactionId = "txn-123";
const entitlementId = "entitlement-123";

function seedBase(params: { releasesCount: number; accountCredits: number }) {
  const creditsRemaining = (PREPARATION_PACK.maxReleases - params.releasesCount) * PREPARATION_PACK.creditsPerRelease;
  documents[`commerce_orders/${orderId}`] = {
    orderId,
    requestId: "11111111-1111-4111-8111-111111111111",
    uid,
    productCode: PREPARATION_PACK.productCode,
    status: "ENTITLED",
    currency: PREPARATION_PACK.currency,
    amountMinor: PREPARATION_PACK.priceMinor,
    paddleTransactionId: transactionId,
    createdAt: "2026-07-16T00:00:00.000Z",
    updatedAt: "2026-07-16T00:00:00.000Z",
  };
  documents[`entitlements/${entitlementId}`] = {
    entitlementId,
    uid,
    orderId,
    productCode: PREPARATION_PACK.productCode,
    status: params.releasesCount === 5 ? "CONSUMED" : "AVAILABLE",
    quantity: 1,
    maxReleases: 5,
    creditsRemaining,
    releasesCount: params.releasesCount,
    releasesList: [],
    createdAt: "2026-07-16T00:00:00.000Z",
    updatedAt: "2026-07-16T00:00:00.000Z",
  };
  documents[`users/${uid}/creditSummary/current`] = {
    availableCredits: params.accountCredits,
    lifetimePurchased: 100,
    lifetimeConsumed: params.releasesCount * 20,
    lifetimeAdjusted: 0,
    lifetimeRefunded: 0,
    updatedAt: "2026-07-16T00:00:00.000Z",
  };
  return creditsRemaining;
}

async function refund(adjustmentId = "adj-123") {
  const { processRefund } = await import("../../functions/src/commerce/refund-service");
  return processRefund(transaction as never, {
    uid,
    orderId,
    transactionId,
    eventId: `evt-${adjustmentId}`,
    adjustmentId,
    amountMinor: PREPARATION_PACK.priceMinor,
    currency: PREPARATION_PACK.currency,
  });
}

describe("Preparation Pack refund reconciliation", () => {
  beforeEach(() => {
    for (const key of Object.keys(documents)) delete documents[key];
    vi.clearAllMocks();
  });

  it("reverses all 100 unused credits and revokes the pack", async () => {
    seedBase({ releasesCount: 0, accountCredits: 100 });
    const result = await refund();

    expect(result).toEqual({
      status: "REFUNDED_UNUSED",
      creditsReversed: 100,
      idempotent: false,
    });
    expect(documents[`commerce_orders/${orderId}`]).toMatchObject({ status: "REFUNDED_UNUSED" });
    expect(documents[`entitlements/${entitlementId}`]).toMatchObject({ status: "REVOKED", creditsRemaining: 0 });
    expect(documents[`users/${uid}/creditSummary/current`]).toMatchObject({
      availableCredits: 0,
      lifetimeRefunded: 100,
    });
  });

  it("reverses only 60 remaining credits after two sealed versions", async () => {
    seedBase({ releasesCount: 2, accountCredits: 60 });
    const firstHash = "a".repeat(64);
    const secondHash = "b".repeat(64);
    documents["cbam_reports/report-1"] = {
      reportId: "report-1",
      entitlementId,
      uid,
      status: "SEALED",
      documentHash: firstHash,
    };
    documents["cbam_reports/report-2"] = {
      reportId: "report-2",
      entitlementId,
      uid,
      status: "SEALED",
      documentHash: secondHash,
    };
    documents[`document_seals/${firstHash}`] = { commercialStatus: "ACTIVE" };
    documents[`document_seals/${secondHash}`] = { commercialStatus: "ACTIVE" };

    const result = await refund();

    expect(result).toEqual({
      status: "REFUNDED_AFTER_DELIVERY",
      creditsReversed: 60,
      idempotent: false,
    });
    expect(documents[`users/${uid}/creditSummary/current`].availableCredits).toBe(0);
    expect(documents[`document_seals/${firstHash}`]).toMatchObject({ commercialStatus: "REFUNDED_AFTER_DELIVERY" });
    expect(documents[`document_seals/${secondHash}`]).toMatchObject({ commercialStatus: "REFUNDED_AFTER_DELIVERY" });
  });

  it("acknowledges exact refund replay without a second debit", async () => {
    seedBase({ releasesCount: 0, accountCredits: 100 });
    const first = await refund("adj-replay");
    const stateAfterFirst = structuredClone(documents);
    const second = await refund("adj-replay");

    expect(first.idempotent).toBe(false);
    expect(second).toEqual({
      status: "REFUNDED_UNUSED",
      creditsReversed: 100,
      idempotent: true,
    });
    expect(documents).toEqual(stateAfterFirst);
  });

  it("hard-stops when account balance cannot reconcile remaining pack credits", async () => {
    seedBase({ releasesCount: 0, accountCredits: 0 });
    await expect(refund()).rejects.toThrow("REFUND_ACCOUNT_BALANCE_CONSERVATION_INVALID");
    expect(documents[`commerce_orders/${orderId}`].status).toBe("ENTITLED");
    expect(documents[`entitlements/${entitlementId}`].status).toBe("AVAILABLE");
  });
});
