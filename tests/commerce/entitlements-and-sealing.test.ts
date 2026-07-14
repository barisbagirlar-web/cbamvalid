import { describe, it, expect, vi, beforeEach } from "vitest";
import { createEntitlement, reserveEntitlement, consumeEntitlement, releaseEntitlementReservation } from "../../functions/src/commerce/entitlement-service";
import { DoubleSpendViolationError, EntitlementUnavailableError } from "../../functions/src/commerce/commerce-errors";

// Mock Firebase Admin SDK
const mockDocs: Record<string, any> = {};

const mockDbTransaction: any = {
  get: vi.fn(async (ref: any) => {
    // If it's a query (with where/limit methods), return empty query result
    if (ref && typeof ref.get === "function" && ref !== mockDbTransaction) {
      return await ref.get();
    }
    const path = ref?.path;
    const data = mockDocs[path];
    return {
      exists: !!data,
      data: () => data,
    };
  }),
  set: vi.fn((ref: any, data: any) => {
    mockDocs[ref.path] = data;
  }),
  update: vi.fn((ref: any, data: any) => {
    mockDocs[ref.path] = { ...mockDocs[ref.path], ...data };
  }),
};

vi.mock("../../functions/src/firebase-admin", () => {
  return {
    adminDb: {
      collection: (colName: string) => {
        const colObj: any = {
          where: vi.fn(() => colObj),
          limit: vi.fn(() => colObj),
          orderBy: vi.fn(() => colObj),
          get: vi.fn(async () => {
            return {
              empty: true,
              docs: [],
            };
          }),
          doc: (docId?: string) => {
            const id = docId || Math.random().toString(36).substring(7);
            const path = `${colName}/${id}`;
            return {
              id,
              path,
              get: async () => {
                const data = mockDocs[path];
                return {
                  exists: !!data,
                  data: () => data,
                };
              },
              set: async (d: any) => {
                mockDocs[path] = d;
              },
              update: async (d: any) => {
                mockDocs[path] = { ...mockDocs[path], ...d };
              },
              delete: async () => {
                delete mockDocs[path];
              }
            };
          }
        };
        return colObj;
      },
      runTransaction: async (callback: any) => {
        return await callback(mockDbTransaction);
      }
    },
    getStorageBucket: () => {
      return {
        file: (filePath: string) => {
          let fileData: Buffer = Buffer.from("");
          return {
            name: filePath,
            save: async (buf: Buffer) => {
              fileData = buf;
            },
            download: async () => {
              return [fileData];
            },
            delete: async () => {}
          };
        }
      };
    }
  };
});

describe("5-Release Commercial Entitlement State Machine", () => {
  beforeEach(() => {
    // Clear mock DB
    for (const key in mockDocs) {
      delete mockDocs[key];
    }
    vi.clearAllMocks();
  });

  it("1. Initializes with 0 releases and status AVAILABLE", async () => {
    const ent = await createEntitlement(mockDbTransaction, {
      uid: "user-123",
      orderId: "ord-1",
      transactionId: "txn-1",
      eventId: "evt-1",
      productCode: "CBAM_EXPORTER_FINAL_REPORT",
      quantity: 1,
    });

    expect(ent.releasesCount).toBe(0);
    expect(ent.status).toBe("AVAILABLE");
    expect(ent.releasesList).toEqual([]);
  });

  it("2. Reserves and locks case scope successfully, preventing double spend", async () => {
    const ent = await createEntitlement(mockDbTransaction, {
      uid: "user-123",
      orderId: "ord-1",
      transactionId: "txn-1",
      eventId: "evt-1",
      productCode: "CBAM_EXPORTER_FINAL_REPORT",
      quantity: 1,
    });

    const reserved = await reserveEntitlement(mockDbTransaction, {
      entitlementId: ent.entitlementId,
      uid: "user-123",
      reportId: "rep-1",
      caseId: "case-999",
    });

    expect(reserved.status).toBe("RESERVED");
    expect(reserved.reservedReportId).toBe("rep-1");

    // Second reservation attempt should trigger double-spend protection
    await expect(
      reserveEntitlement(mockDbTransaction, {
        entitlementId: ent.entitlementId,
        uid: "user-123",
        reportId: "rep-2",
        caseId: "case-999",
      })
    ).rejects.toThrow(DoubleSpendViolationError);
  });

  it("3. Enforces scope locking to the same caseId across multiple releases", async () => {
    const ent = await createEntitlement(mockDbTransaction, {
      uid: "user-123",
      orderId: "ord-1",
      transactionId: "txn-1",
      eventId: "evt-1",
      productCode: "CBAM_EXPORTER_FINAL_REPORT",
      quantity: 1,
    });

    // 1st Release on case-999
    await reserveEntitlement(mockDbTransaction, {
      entitlementId: ent.entitlementId,
      uid: "user-123",
      reportId: "rep-1",
      caseId: "case-999",
    });

    await consumeEntitlement(mockDbTransaction, {
      entitlementId: ent.entitlementId,
      uid: "user-123",
      reportId: "rep-1",
      caseId: "case-999",
      reportHash: "hash-1",
      version: 1,
    });

    // Attempting reservation for a different caseId (case-888) must fail scope lock
    await expect(
      reserveEntitlement(mockDbTransaction, {
        entitlementId: ent.entitlementId,
        uid: "user-123",
        reportId: "rep-2",
        caseId: "case-888",
      })
    ).rejects.toThrow(EntitlementUnavailableError);
  });

  it("4. Consumes releases sequentially, requires correctionReason for sequence 2-5, and fully consumes at 5", async () => {
    const ent = await createEntitlement(mockDbTransaction, {
      uid: "user-123",
      orderId: "ord-1",
      transactionId: "txn-1",
      eventId: "evt-1",
      productCode: "CBAM_EXPORTER_FINAL_REPORT",
      quantity: 1,
    });

    // Release 1: no correction reason required
    await reserveEntitlement(mockDbTransaction, { entitlementId: ent.entitlementId, uid: "user-123", reportId: "rep-1", caseId: "case-1" });
    let updated = await consumeEntitlement(mockDbTransaction, {
      entitlementId: ent.entitlementId,
      uid: "user-123",
      reportId: "rep-1",
      caseId: "case-1",
      reportHash: "hash-1",
      version: 1,
    });
    expect(updated.releasesCount).toBe(1);
    expect(updated.status).toBe("AVAILABLE");

    // Release 2: correction reason is required!
    await reserveEntitlement(mockDbTransaction, { entitlementId: ent.entitlementId, uid: "user-123", reportId: "rep-2", caseId: "case-1" });
    await expect(
      consumeEntitlement(mockDbTransaction, {
        entitlementId: ent.entitlementId,
        uid: "user-123",
        reportId: "rep-2",
        caseId: "case-1",
        reportHash: "hash-2",
        version: 2,
      })
    ).rejects.toThrow("A correction reason must be supplied");

    // Re-attempt with correction reason
    updated = await consumeEntitlement(mockDbTransaction, {
      entitlementId: ent.entitlementId,
      uid: "user-123",
      reportId: "rep-2",
      caseId: "case-1",
      reportHash: "hash-2",
      version: 2,
      correctionReason: "Fixed incorrect CN Code",
    });
    expect(updated.releasesCount).toBe(2);

    // Consume releases 3, 4, 5
    for (let seq = 3; seq <= 5; seq++) {
      await reserveEntitlement(mockDbTransaction, { entitlementId: ent.entitlementId, uid: "user-123", reportId: `rep-${seq}`, caseId: "case-1" });
      updated = await consumeEntitlement(mockDbTransaction, {
        entitlementId: ent.entitlementId,
        uid: "user-123",
        reportId: `rep-${seq}`,
        caseId: "case-1",
        reportHash: `hash-${seq}`,
        version: seq,
        correctionReason: `Correction version ${seq}`,
      });
    }

    expect(updated.releasesCount).toBe(5);
    expect(updated.status).toBe("CONSUMED");

    // Release 6: must be prevented
    await expect(
      reserveEntitlement(mockDbTransaction, {
        entitlementId: ent.entitlementId,
        uid: "user-123",
        reportId: "rep-6",
        caseId: "case-1",
      })
    ).rejects.toThrow(EntitlementUnavailableError);
  });
});
