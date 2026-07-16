import { beforeEach, describe, expect, it, vi } from "vitest";
import { createNewCaseDraft } from "@/lib/cbam/new-case";

type StoredDocument = Record<string, unknown>;
type DocumentRef = { collectionName: string; id: string };

const fakeFirestore = vi.hoisted(() => {
  const collections = new Map<string, Map<string, StoredDocument>>();

  function collectionStore(name: string): Map<string, StoredDocument> {
    let store = collections.get(name);
    if (!store) {
      store = new Map<string, StoredDocument>();
      collections.set(name, store);
    }
    return store;
  }

  function snapshot(ref: DocumentRef) {
    const value = collectionStore(ref.collectionName).get(ref.id);
    return {
      id: ref.id,
      exists: value !== undefined,
      data: () => value === undefined ? undefined : structuredClone(value),
    };
  }

  const adminDb = {
    collection(name: string) {
      return {
        doc(id: string): DocumentRef {
          return { collectionName: name, id };
        },
        where(field: string, operator: string, expected: unknown) {
          if (operator !== "==") throw new Error("FAKE_FIRESTORE_OPERATOR_UNSUPPORTED");
          return {
            async get() {
              const docs = [...collectionStore(name).entries()]
                .filter(([, value]) => value[field] === expected)
                .map(([id, value]) => ({
                  id,
                  data: () => structuredClone(value),
                }));
              return { docs };
            },
          };
        },
      };
    },
    async runTransaction<T>(
      callback: (transaction: {
        get(ref: DocumentRef): Promise<ReturnType<typeof snapshot>>;
        create(ref: DocumentRef, data: StoredDocument): void;
      }) => Promise<T>
    ): Promise<T> {
      const pendingCreates: Array<{ ref: DocumentRef; data: StoredDocument }> = [];
      const transaction = {
        async get(ref: DocumentRef) {
          return snapshot(ref);
        },
        create(ref: DocumentRef, data: StoredDocument) {
          pendingCreates.push({ ref, data: structuredClone(data) });
        },
      };

      const result = await callback(transaction);
      for (const { ref, data } of pendingCreates) {
        const store = collectionStore(ref.collectionName);
        if (store.has(ref.id)) throw new Error("FAKE_FIRESTORE_CREATE_CONFLICT");
        store.set(ref.id, structuredClone(data));
      }
      return result;
    },
  };

  return {
    adminDb,
    clear() {
      collections.clear();
    },
    size(name: string) {
      return collectionStore(name).size;
    },
    set(name: string, id: string, value: StoredDocument) {
      collectionStore(name).set(id, structuredClone(value));
    },
  };
});

vi.mock("../../functions/src/firebase-admin", () => ({
  adminDb: fakeFirestore.adminDb,
}));

import {
  createCase,
  getCasesForUser,
} from "../../functions/src/cbam/storage/case-repository";

const OWNER_ID = "repository_idempotency_user";
const REQUEST_ID = "44444444-4444-4444-8444-444444444444";
const OTHER_REQUEST_ID = "55555555-5555-4555-8555-555555555555";
const EVENT_ID = "66666666-6666-4666-8666-666666666666";
const TIMESTAMP = "2026-07-15T13:00:00.000Z";

function draft() {
  return createNewCaseDraft(OWNER_ID, { eventId: EVENT_ID, timestamp: TIMESTAMP });
}

describe("case repository idempotency", () => {
  beforeEach(() => {
    fakeFirestore.clear();
  });

  it("returns the first persisted case for a repeated creation request", async () => {
    const firstInput = draft();
    const first = await createCase(OWNER_ID, firstInput, REQUEST_ID);

    const retryInput = draft();
    retryInput.exporterIdentity.legalName.value = "MUTATED RETRY PAYLOAD";
    const retry = await createCase(OWNER_ID, retryInput, REQUEST_ID);

    expect(retry).toEqual(first);
    expect(retry.data.exporterIdentity.legalName.value).toBe("Illustrative Steel Exporter Ltd.");
    expect(fakeFirestore.size("cbam_cases")).toBe(1);
    expect(fakeFirestore.size("case_creation_requests")).toBe(1);
  });

  it("creates independent records for independent request IDs", async () => {
    const first = await createCase(OWNER_ID, draft(), REQUEST_ID);
    const second = await createCase(OWNER_ID, draft(), OTHER_REQUEST_ID);

    expect(second.caseId).not.toBe(first.caseId);
    expect(fakeFirestore.size("cbam_cases")).toBe(2);
    expect(fakeFirestore.size("case_creation_requests")).toBe(2);
  });

  it("adapts recognized legacy cases and isolates an unsupported record from the dashboard list", async () => {
    const modern = await createCase(OWNER_ID, draft(), REQUEST_ID);
    fakeFirestore.set("cbam_cases", "legacyDocument123", {
      caseId: "case_legacyDocument123",
      uid: OWNER_ID,
      status: "DRAFT",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-07-16T10:00:00.000Z",
      data: {
        exporterName: "Legacy Exporter",
        declarantEORI: "DE123456789012",
        importYear: 2026,
        importQuarter: 1,
        cnCode: "72085120",
        productionVolume: 300,
        installationName: "Legacy Plant",
        directEmissions: 56788,
        electricityConsumed: 456,
        gridEmissionFactor: 4344,
      },
    });
    fakeFirestore.set("cbam_cases", "unsupportedDocument123", {
      caseId: "case_unsupportedDocument123",
      uid: OWNER_ID,
      status: "DRAFT",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-07-16T11:00:00.000Z",
      data: { directEmissions: { value: 10 } },
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const cases = await getCasesForUser(OWNER_ID);

    expect(cases.map((record) => record.caseId).sort()).toEqual([
      "case_legacyDocument123",
      modern.caseId,
    ].sort());
    const legacy = cases.find((record) => record.caseId === "case_legacyDocument123");
    expect(legacy?.data.installation.name.value).toBe("Legacy Plant");
    expect(legacy?.data.gridEmissionFactor.value).toBe(4344);
    expect(consoleError).toHaveBeenCalledWith(
      "Skipping unsupported CBAM case record",
      expect.objectContaining({ documentId: "unsupportedDocument123" })
    );
    consoleError.mockRestore();
  });
});
