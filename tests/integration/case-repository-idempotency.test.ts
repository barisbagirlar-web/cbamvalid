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
  };
});

vi.mock("../../functions/src/firebase-admin", () => ({
  adminDb: fakeFirestore.adminDb,
}));

import { createCase } from "../../functions/src/cbam/storage/case-repository";

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
    expect(retry.data.exporterIdentity.legalName.value).toBeNull();
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
});
