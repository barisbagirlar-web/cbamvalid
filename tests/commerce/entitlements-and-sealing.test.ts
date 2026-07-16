import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  consumeEntitlement,
  createEntitlement,
  reserveEntitlement,
} from "../../functions/src/commerce/entitlement-service";
import {
  DoubleSpendViolationError,
  EntitlementUnavailableError,
} from "../../functions/src/commerce/commerce-errors";
import { PREPARATION_PACK } from "../../functions/src/commerce/preparation-pack";

const documents: Record<string, Record<string, unknown>> = {};
let generatedId = 0;

type Filter = { field: string; operator: string; value: unknown };

type Snapshot = {
  id: string;
  exists: boolean;
  data: () => Record<string, unknown> | undefined;
};

function snapshot(path: string): Snapshot {
  const value = documents[path];
  return {
    id: path.split("/").at(-1) || path,
    exists: Boolean(value),
    data: () => value,
  };
}

function documentReference(path: string) {
  return {
    path,
    id: path.split("/").at(-1) || path,
    get: async () => snapshot(path),
    collection: (name: string) => collectionReference(`${path}/${name}`),
  };
}

function collectionReference(path: string) {
  const filters: Filter[] = [];
  let resultLimit: number | undefined;
  const query = {
    where(field: string, operator: string, value: unknown) {
      filters.push({ field, operator, value });
      return query;
    },
    orderBy() {
      return query;
    },
    limit(value: number) {
      resultLimit = value;
      return query;
    },
    async get() {
      const prefix = `${path}/`;
      let docs = Object.keys(documents)
        .filter((candidate) => candidate.startsWith(prefix))
        .filter((candidate) => !candidate.slice(prefix.length).includes("/"))
        .filter((candidate) => filters.every((filter) => {
          if (filter.operator !== "==") throw new Error(`UNSUPPORTED_OPERATOR:${filter.operator}`);
          return documents[candidate][filter.field] === filter.value;
        }))
        .sort()
        .map(snapshot);
      if (resultLimit !== undefined) docs = docs.slice(0, resultLimit);
      return { empty: docs.length === 0, docs };
    },
    doc(id?: string) {
      generatedId += 1;
      return documentReference(`${path}/${id || `generated-${generatedId}`}`);
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
  set: vi.fn((reference: { path: string }, data: Record<string, unknown>, options?: { merge?: boolean }) => {
    documents[reference.path] = options?.merge
      ? { ...(documents[reference.path] || {}), ...structuredClone(data) }
      : structuredClone(data);
  }),
  update: vi.fn((reference: { path: string }, data: Record<string, unknown>) => {
    if (!documents[reference.path]) throw new Error(`NOT_FOUND:${reference.path}`);
    documents[reference.path] = { ...documents[reference.path], ...structuredClone(data) };
  }),
};

vi.mock("../../functions/src/firebase-admin", () => ({
  adminDb: {
    collection: (name: string) => collectionReference(name),
    runTransaction: async (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction),
  },
  getStorageBucket: () => ({ file: () => ({}) }),
}));

function seedCreditSummary(uid: string, credits = PREPARATION_PACK.accountCredits) {
  documents[`users/${uid}/creditSummary/current`] = {
    availableCredits: credits,
    lifetimePurchased: PREPARATION_PACK.accountCredits,
    lifetimeConsumed: 0,
    lifetimeAdjusted: 0,
    lifetimeRefunded: 0,
    updatedAt: "2026-07-16T00:00:00.000Z",
  };
}

async function createPack(uid = "user-123", orderId = "ord-1") {
  return createEntitlement(transaction as never, {
    uid,
    orderId,
    transactionId: `txn-${orderId}`,
    eventId: `evt-${orderId}`,
    productCode: PREPARATION_PACK.productCode,
    quantity: 1,
  });
}

describe("Preparation Pack Entitlement and Credit State Machine", () => {
  beforeEach(() => {
    for (const key of Object.keys(documents)) delete documents[key];
    generatedId = 0;
    vi.clearAllMocks();
  });

  it("creates exactly one five-release entitlement backed by 100 credits", async () => {
    const entitlement = await createPack();
    expect(entitlement).toMatchObject({
      productCode: PREPARATION_PACK.productCode,
      status: "AVAILABLE",
      quantity: 1,
      maxReleases: 5,
      releasesCount: 0,
      creditsRemaining: 100,
      releasesList: [],
    });
    expect(Object.keys(documents).filter((path) => path.startsWith("entitlements/"))).toHaveLength(1);
  });

  it("prevents concurrent reservation double spend", async () => {
    const entitlement = await createPack();
    await reserveEntitlement(transaction as never, {
      entitlementId: entitlement.entitlementId,
      uid: entitlement.uid,
      reportId: "report-1",
      caseId: "case-1",
    });

    await expect(reserveEntitlement(transaction as never, {
      entitlementId: entitlement.entitlementId,
      uid: entitlement.uid,
      reportId: "report-2",
      caseId: "case-1",
    })).rejects.toThrow(DoubleSpendViolationError);
  });

  it("scope-locks the pack to the first successfully sealed case", async () => {
    const entitlement = await createPack();
    seedCreditSummary(entitlement.uid);
    await reserveEntitlement(transaction as never, {
      entitlementId: entitlement.entitlementId,
      uid: entitlement.uid,
      reportId: "report-1",
      caseId: "case-1",
    });
    await consumeEntitlement(transaction as never, {
      entitlementId: entitlement.entitlementId,
      uid: entitlement.uid,
      reportId: "report-1",
      caseId: "case-1",
      reportHash: "a".repeat(64),
      version: 1,
    });

    await expect(reserveEntitlement(transaction as never, {
      entitlementId: entitlement.entitlementId,
      uid: entitlement.uid,
      reportId: "report-2",
      caseId: "case-2",
    })).rejects.toThrow(EntitlementUnavailableError);
  });

  it("debits exactly 20 credits for each of five successful seals", async () => {
    const entitlement = await createPack();
    seedCreditSummary(entitlement.uid);

    for (let sequence = 1; sequence <= PREPARATION_PACK.maxReleases; sequence += 1) {
      const reportId = `report-${sequence}`;
      await reserveEntitlement(transaction as never, {
        entitlementId: entitlement.entitlementId,
        uid: entitlement.uid,
        reportId,
        caseId: "case-1",
      });
      const updated = await consumeEntitlement(transaction as never, {
        entitlementId: entitlement.entitlementId,
        uid: entitlement.uid,
        reportId,
        caseId: "case-1",
        reportHash: sequence.toString(16).padStart(64, "0"),
        version: sequence,
        ...(sequence > 1 ? { correctionReason: `Correction ${sequence}` } : {}),
      });

      const expectedCredits = PREPARATION_PACK.accountCredits - sequence * PREPARATION_PACK.creditsPerRelease;
      expect(updated.releasesCount).toBe(sequence);
      expect(updated.creditsRemaining).toBe(expectedCredits);
      expect(documents[`users/${entitlement.uid}/creditSummary/current`].availableCredits).toBe(expectedCredits);
      expect(documents[`users/${entitlement.uid}/creditLedger/seal_${reportId}`].amount).toBe(-20);
      expect(updated.status).toBe(sequence === 5 ? "CONSUMED" : "AVAILABLE");
    }

    await expect(reserveEntitlement(transaction as never, {
      entitlementId: entitlement.entitlementId,
      uid: entitlement.uid,
      reportId: "report-6",
      caseId: "case-1",
    })).rejects.toThrow(EntitlementUnavailableError);
  });

  it("requires a correction reason for versions two through five", async () => {
    const entitlement = await createPack();
    seedCreditSummary(entitlement.uid);
    await reserveEntitlement(transaction as never, {
      entitlementId: entitlement.entitlementId,
      uid: entitlement.uid,
      reportId: "report-1",
      caseId: "case-1",
    });
    await consumeEntitlement(transaction as never, {
      entitlementId: entitlement.entitlementId,
      uid: entitlement.uid,
      reportId: "report-1",
      caseId: "case-1",
      reportHash: "a".repeat(64),
      version: 1,
    });
    await reserveEntitlement(transaction as never, {
      entitlementId: entitlement.entitlementId,
      uid: entitlement.uid,
      reportId: "report-2",
      caseId: "case-1",
    });
    await expect(consumeEntitlement(transaction as never, {
      entitlementId: entitlement.entitlementId,
      uid: entitlement.uid,
      reportId: "report-2",
      caseId: "case-1",
      reportHash: "b".repeat(64),
      version: 2,
    })).rejects.toThrow("A correction reason is required after the first release.");
  });

  it("hard-stops a seal when global account credits are insufficient", async () => {
    const entitlement = await createPack();
    seedCreditSummary(entitlement.uid, 0);
    await reserveEntitlement(transaction as never, {
      entitlementId: entitlement.entitlementId,
      uid: entitlement.uid,
      reportId: "report-1",
      caseId: "case-1",
    });

    await expect(consumeEntitlement(transaction as never, {
      entitlementId: entitlement.entitlementId,
      uid: entitlement.uid,
      reportId: "report-1",
      caseId: "case-1",
      reportHash: "a".repeat(64),
      version: 1,
    })).rejects.toThrow("20 credits are required for a successful seal.");
    expect(documents[`users/${entitlement.uid}/creditSummary/current`].availableCredits).toBe(0);
    expect(documents[`entitlements/${entitlement.entitlementId}`].releasesCount).toBe(0);
  });
});
