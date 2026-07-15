import { describe, it, expect, vi, beforeEach } from "vitest";
import { createEntitlement, reserveEntitlement, consumeEntitlement } from "../../functions/src/commerce/entitlement-service";
import { DoubleSpendViolationError, EntitlementUnavailableError } from "../../functions/src/commerce/commerce-errors";

const mockDocs: Record<string, Record<string, unknown>> = {};

type QueryFilter = {
  field: string;
  operator: string;
  value: unknown;
};

function documentSnapshot(path: string, data: Record<string, unknown>) {
  const id = path.split("/").at(-1) || path;
  return {
    id,
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
            .filter(([, data]) => filters.every((filter) => {
              if (filter.operator !== "==") throw new Error(`UNSUPPORTED_MOCK_QUERY_OPERATOR:${filter.operator}`);
              return data[filter.field] === filter.value;
            }))
            .map(([path, data]) => documentSnapshot(path, data));

          if (resultLimit !== undefined) documents = documents.slice(0, resultLimit);
          return {
            empty: documents.length === 0,
            docs: documents,
          };
        }),
        doc: (documentId?: string) => {
          const id = documentId || Math.random().toString(36).substring(2, 15);
          const path = `${collectionName}/${id}`;
          return {
            id,
            path,
            get: async () => {
              const data = mockDocs[path];
              return {
                id,
                exists: Boolean(data),
                data: () => data,
              };
            },
            set: async (data: Record<string, unknown>) => {
              mockDocs[path] = data;
            },
            update: async (data: Record<string, unknown>) => {
              mockDocs[path] = { ...mockDocs[path], ...data };
            },
            delete: async () => {
              delete mockDocs[path];
            },
          };
        },
      };

      return collection;
    },
    runTransaction: async (callback: (transaction: typeof mockDbTransaction) => Promise<unknown>) =>
      callback(mockDbTransaction),
  },
  getStorageBucket: () => ({
    file: (filePath: string) => {
      let fileData = Buffer.from("");
      return {
        name: filePath,
        save: async (buffer: Buffer) => {
          fileData = buffer;
        },
        download: async () => [fileData],
        delete: async () => undefined,
      };
    },
  }),
}));

describe("5-Release Commercial Entitlement State Machine", () => {
  beforeEach(() => {
    for (const key of Object.keys(mockDocs)) delete mockDocs[key];
    vi.clearAllMocks();
  });

  it("1. Initializes with 0 releases and status AVAILABLE", async () => {
    const entitlement = await createEntitlement(mockDbTransaction as never, {
      uid: "user-123",
      orderId: "ord-1",
      transactionId: "txn-1",
      eventId: "evt-1",
      productCode: "CBAM_EXPORTER_FINAL_REPORT",
      quantity: 1,
    });

    expect(entitlement.releasesCount).toBe(0);
    expect(entitlement.status).toBe("AVAILABLE");
    expect(entitlement.releasesList).toEqual([]);
  });

  it("2. Reserves and locks case scope successfully, preventing double spend", async () => {
    const entitlement = await createEntitlement(mockDbTransaction as never, {
      uid: "user-123",
      orderId: "ord-1",
      transactionId: "txn-1",
      eventId: "evt-1",
      productCode: "CBAM_EXPORTER_FINAL_REPORT",
      quantity: 1,
    });

    const reserved = await reserveEntitlement(mockDbTransaction as never, {
      entitlementId: entitlement.entitlementId,
      uid: "user-123",
      reportId: "rep-1",
      caseId: "case-999",
    });

    expect(reserved.status).toBe("RESERVED");
    expect(reserved.reservedReportId).toBe("rep-1");

    await expect(
      reserveEntitlement(mockDbTransaction as never, {
        entitlementId: entitlement.entitlementId,
        uid: "user-123",
        reportId: "rep-2",
        caseId: "case-999",
      })
    ).rejects.toThrow(DoubleSpendViolationError);
  });

  it("3. Enforces scope locking to the same caseId across multiple releases", async () => {
    const entitlement = await createEntitlement(mockDbTransaction as never, {
      uid: "user-123",
      orderId: "ord-1",
      transactionId: "txn-1",
      eventId: "evt-1",
      productCode: "CBAM_EXPORTER_FINAL_REPORT",
      quantity: 1,
    });

    await reserveEntitlement(mockDbTransaction as never, {
      entitlementId: entitlement.entitlementId,
      uid: "user-123",
      reportId: "rep-1",
      caseId: "case-999",
    });

    await consumeEntitlement(mockDbTransaction as never, {
      entitlementId: entitlement.entitlementId,
      uid: "user-123",
      reportId: "rep-1",
      caseId: "case-999",
      reportHash: "hash-1",
      version: 1,
    });

    await expect(
      reserveEntitlement(mockDbTransaction as never, {
        entitlementId: entitlement.entitlementId,
        uid: "user-123",
        reportId: "rep-2",
        caseId: "case-888",
      })
    ).rejects.toThrow(EntitlementUnavailableError);
  });

  it("4. Consumes releases sequentially, requires correctionReason for sequence 2-5, and fully consumes at 5", async () => {
    const entitlement = await createEntitlement(mockDbTransaction as never, {
      uid: "user-123",
      orderId: "ord-1",
      transactionId: "txn-1",
      eventId: "evt-1",
      productCode: "CBAM_EXPORTER_FINAL_REPORT",
      quantity: 1,
    });

    await reserveEntitlement(mockDbTransaction as never, {
      entitlementId: entitlement.entitlementId,
      uid: "user-123",
      reportId: "rep-1",
      caseId: "case-1",
    });
    let updated = await consumeEntitlement(mockDbTransaction as never, {
      entitlementId: entitlement.entitlementId,
      uid: "user-123",
      reportId: "rep-1",
      caseId: "case-1",
      reportHash: "hash-1",
      version: 1,
    });
    expect(updated.releasesCount).toBe(1);
    expect(updated.status).toBe("AVAILABLE");

    await reserveEntitlement(mockDbTransaction as never, {
      entitlementId: entitlement.entitlementId,
      uid: "user-123",
      reportId: "rep-2",
      caseId: "case-1",
    });
    await expect(
      consumeEntitlement(mockDbTransaction as never, {
        entitlementId: entitlement.entitlementId,
        uid: "user-123",
        reportId: "rep-2",
        caseId: "case-1",
        reportHash: "hash-2",
        version: 2,
      })
    ).rejects.toThrow("A correction reason must be supplied");

    updated = await consumeEntitlement(mockDbTransaction as never, {
      entitlementId: entitlement.entitlementId,
      uid: "user-123",
      reportId: "rep-2",
      caseId: "case-1",
      reportHash: "hash-2",
      version: 2,
      correctionReason: "Fixed incorrect CN Code",
    });
    expect(updated.releasesCount).toBe(2);

    for (let sequence = 3; sequence <= 5; sequence += 1) {
      await reserveEntitlement(mockDbTransaction as never, {
        entitlementId: entitlement.entitlementId,
        uid: "user-123",
        reportId: `rep-${sequence}`,
        caseId: "case-1",
      });
      updated = await consumeEntitlement(mockDbTransaction as never, {
        entitlementId: entitlement.entitlementId,
        uid: "user-123",
        reportId: `rep-${sequence}`,
        caseId: "case-1",
        reportHash: `hash-${sequence}`,
        version: sequence,
        correctionReason: `Correction version ${sequence}`,
      });
    }

    expect(updated.releasesCount).toBe(5);
    expect(updated.status).toBe("CONSUMED");

    await expect(
      reserveEntitlement(mockDbTransaction as never, {
        entitlementId: entitlement.entitlementId,
        uid: "user-123",
        reportId: "rep-6",
        caseId: "case-1",
      })
    ).rejects.toThrow(EntitlementUnavailableError);
  });
});
