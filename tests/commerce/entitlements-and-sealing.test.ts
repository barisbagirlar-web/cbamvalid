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

const documents = new Map<string, Record<string, unknown>>();
let generatedId = 0;

type Filter = { field: string; operator: "=="; value: unknown };
type DocumentReference = {
  kind: "document";
  id: string;
  path: string;
  collection: (name: string) => CollectionReference;
};
type QueryReference = {
  kind: "query";
  path: string;
  filters: Filter[];
  resultLimit?: number;
};
type CollectionReference = {
  path: string;
  doc: (id?: string) => DocumentReference;
  where: (field: string, operator: "==", value: unknown) => QueryReference & {
    where: CollectionReference["where"];
    limit: (limit: number) => QueryReference;
    orderBy: () => QueryReference;
  };
  limit: (limit: number) => QueryReference;
  orderBy: () => CollectionReference;
};

function directChildren(collectionPath: string): Array<{ path: string; data: Record<string, unknown> }> {
  const prefix = `${collectionPath}/`;
  return [...documents.entries()]
    .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes("/"))
    .map(([path, data]) => ({ path, data }));
}

function documentSnapshot(reference: DocumentReference) {
  const data = documents.get(reference.path);
  return {
    id: reference.id,
    exists: data !== undefined,
    data: () => data,
    ref: reference,
  };
}

function querySnapshot(reference: QueryReference) {
  let matches = directChildren(reference.path).filter(({ data }) =>
    reference.filters.every((filter) => {
      if (filter.operator !== "==") throw new Error(`UNSUPPORTED_QUERY_OPERATOR:${filter.operator}`);
      return data[filter.field] === filter.value;
    })
  );
  if (reference.resultLimit !== undefined) matches = matches.slice(0, reference.resultLimit);
  return {
    empty: matches.length === 0,
    size: matches.length,
    docs: matches.map(({ path }) => documentSnapshot(documentReference(path))),
  };
}

function documentReference(path: string): DocumentReference {
  const id = path.split("/").at(-1) || path;
  return {
    kind: "document",
    id,
    path,
    collection: (name: string) => collectionReference(`${path}/${name}`),
  };
}

function queryReference(path: string, filters: Filter[] = [], resultLimit?: number) {
  const query: QueryReference & {
    where: CollectionReference["where"];
    limit: (limit: number) => QueryReference;
    orderBy: () => QueryReference;
  } = {
    kind: "query",
    path,
    filters,
    resultLimit,
    where: (field, operator, value) => queryReference(path, [...filters, { field, operator, value }], resultLimit),
    limit: (limit) => queryReference(path, filters, limit),
    orderBy: () => query,
  };
  return query;
}

function collectionReference(path: string): CollectionReference {
  const collection: CollectionReference = {
    path,
    doc: (id?: string) => documentReference(`${path}/${id || `generated-${++generatedId}`}`),
    where: (field, operator, value) => queryReference(path, [{ field, operator, value }]),
    limit: (limit) => queryReference(path, [], limit),
    orderBy: () => collection,
  };
  return collection;
}

const transaction = {
  get: vi.fn(async (reference: DocumentReference | QueryReference) =>
    reference.kind === "query" ? querySnapshot(reference) : documentSnapshot(reference)
  ),
  create: vi.fn((reference: DocumentReference, data: Record<string, unknown>) => {
    if (documents.has(reference.path)) throw new Error(`DOCUMENT_ALREADY_EXISTS:${reference.path}`);
    documents.set(reference.path, structuredClone(data));
  }),
  set: vi.fn((reference: DocumentReference, data: Record<string, unknown>, options?: { merge?: boolean }) => {
    const current = documents.get(reference.path) || {};
    documents.set(reference.path, options?.merge ? { ...current, ...structuredClone(data) } : structuredClone(data));
  }),
  update: vi.fn((reference: DocumentReference, data: Record<string, unknown>) => {
    const current = documents.get(reference.path);
    if (!current) throw new Error(`DOCUMENT_NOT_FOUND:${reference.path}`);
    documents.set(reference.path, { ...current, ...structuredClone(data) });
  }),
};

vi.mock("../../functions/src/firebase-admin", () => ({
  adminDb: {
    collection: (name: string) => collectionReference(name),
    runTransaction: async (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction),
  },
}));

function hash(sequence: number): string {
  return sequence.toString(16).padStart(64, "0");
}

async function newEntitlement(orderId = "ord-1") {
  return createEntitlement(transaction as never, {
    uid: "user-123",
    orderId,
    transactionId: `txn-${orderId}`,
    eventId: `evt-${orderId}`,
    productCode: "CBAM_EXPORTER_FINAL_REPORT",
    quantity: 1,
  });
}

describe("five-release commercial entitlement state machine", () => {
  beforeEach(() => {
    documents.clear();
    generatedId = 0;
    vi.clearAllMocks();
  });

  it("creates one canonical pack entitlement with zero consumed releases", async () => {
    const entitlement = await newEntitlement();
    expect(entitlement).toMatchObject({
      status: "AVAILABLE",
      quantity: 1,
      maxReleases: 5,
      releasesCount: 0,
      releasesList: [],
    });
    expect(documents.get(`entitlements/${entitlement.entitlementId}`)).toMatchObject({
      productCode: "CBAM_EXPORTER_FINAL_REPORT",
      maxReleases: 5,
    });
    expect(directChildren("commerce_ledger")).toHaveLength(1);
  });

  it("reserves atomically and rejects concurrent double spend", async () => {
    const entitlement = await newEntitlement();
    const reserved = await reserveEntitlement(transaction as never, {
      entitlementId: entitlement.entitlementId,
      uid: "user-123",
      reportId: "report-1",
      caseId: "case-999",
    });
    expect(reserved.status).toBe("RESERVED");
    expect(reserved.reservedReportId).toBe("report-1");

    await expect(reserveEntitlement(transaction as never, {
      entitlementId: entitlement.entitlementId,
      uid: "user-123",
      reportId: "report-2",
      caseId: "case-999",
    })).rejects.toThrow(DoubleSpendViolationError);
  });

  it("locks the first successful release to one case", async () => {
    const entitlement = await newEntitlement();
    await reserveEntitlement(transaction as never, {
      entitlementId: entitlement.entitlementId,
      uid: "user-123",
      reportId: "report-1",
      caseId: "case-999",
    });
    const consumed = await consumeEntitlement(transaction as never, {
      entitlementId: entitlement.entitlementId,
      uid: "user-123",
      reportId: "report-1",
      caseId: "case-999",
      reportHash: hash(1),
      version: 1,
    });
    expect(consumed.scopeCaseId).toBe("case-999");

    await expect(reserveEntitlement(transaction as never, {
      entitlementId: entitlement.entitlementId,
      uid: "user-123",
      reportId: "report-2",
      caseId: "case-888",
    })).rejects.toThrow(EntitlementUnavailableError);
  });

  it("requires sequential versions and a correction reason for releases two through five", async () => {
    const entitlement = await newEntitlement();
    let current = entitlement;

    for (let sequence = 1; sequence <= 5; sequence += 1) {
      const reportId = `report-${sequence}`;
      await reserveEntitlement(transaction as never, {
        entitlementId: entitlement.entitlementId,
        uid: "user-123",
        reportId,
        caseId: "case-1",
      });

      if (sequence === 2) {
        await expect(consumeEntitlement(transaction as never, {
          entitlementId: entitlement.entitlementId,
          uid: "user-123",
          reportId,
          caseId: "case-1",
          reportHash: hash(sequence),
          version: sequence,
        })).rejects.toThrow("A correction reason is required after the first release.");
      }

      current = await consumeEntitlement(transaction as never, {
        entitlementId: entitlement.entitlementId,
        uid: "user-123",
        reportId,
        caseId: "case-1",
        reportHash: hash(sequence),
        version: sequence,
        ...(sequence > 1 ? { correctionReason: `Corrected evidence and calculations for release ${sequence}` } : {}),
      });
      expect(current.releasesCount).toBe(sequence);
      expect(current.releasesList).toHaveLength(sequence);
    }

    expect(current.status).toBe("CONSUMED");
    await expect(reserveEntitlement(transaction as never, {
      entitlementId: entitlement.entitlementId,
      uid: "user-123",
      reportId: "report-6",
      caseId: "case-1",
    })).rejects.toThrow(EntitlementUnavailableError);
  });

  it("blocks reservation while a refund-related commerce hold is active", async () => {
    const entitlement = await newEntitlement();
    documents.set("users/user-123/commerceHold/current", {
      active: true,
      reason: "REFUND_AFTER_CREDIT_CONSUMPTION",
      deficitCredits: 100,
    });

    await expect(reserveEntitlement(transaction as never, {
      entitlementId: entitlement.entitlementId,
      uid: "user-123",
      reportId: "report-held",
      caseId: "case-1",
    })).rejects.toThrow("COMMERCE_HOLD_ACTIVE");
  });
});
