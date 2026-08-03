import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isTestAdmin,
  isTestAdminEmail,
  ensureTestAdminEntitlement,
  TEST_ADMIN_EMAILS,
  TEST_ADMIN_MAX_RELEASES,
} from "../../functions/src/commerce/test-admin-access";

const mockDocs: Record<string, Record<string, unknown>> = {};

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
      const filters: Array<{ field: string; operator: string; value: unknown }> = [];
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
              })
            )
            .map(([path, data]) => ({
              id: path.split("/").at(-1) || path,
              exists: true,
              data: () => data,
            }));
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
    file: () => ({
      save: async () => undefined,
      download: async () => [Buffer.from("")],
      delete: async () => undefined,
    }),
  }),
}));

describe("Test-admin access (owner-approved test bypass)", () => {
  beforeEach(() => {
    for (const key of Object.keys(mockDocs)) delete mockDocs[key];
    vi.clearAllMocks();
  });

  it("1. Allowlist contains only the approved owner account", () => {
    expect(TEST_ADMIN_EMAILS).toEqual(["barisbagirlar@gmail.com"]);
    expect(TEST_ADMIN_EMAILS).not.toContain("teb232@gmail.com");
  });

  it("2. isTestAdmin requires verified email + allowlist membership", () => {
    expect(isTestAdmin({ email: "BARISBAGIRLAR@gmail.com", email_verified: true })).toBe(true);
    expect(isTestAdmin({ email: "barisbagirlar@gmail.com", email_verified: false })).toBe(false);
    expect(isTestAdmin({ email: "teb232@gmail.com", email_verified: true })).toBe(false);
    expect(isTestAdmin({ email: "someone@example.com", email_verified: true })).toBe(false);
    expect(isTestAdmin(null)).toBe(false);
    expect(isTestAdmin(undefined)).toBe(false);
  });

  it("3. ensureTestAdminEntitlement provisions an idempotent synthetic AVAILABLE entitlement", async () => {
    const first = await ensureTestAdminEntitlement(mockDbTransaction as never, "user-test-1", "barisbagirlar@gmail.com");
    expect(first.entitlementId).toMatch(/^ent_test_[a-f0-9]{40}$/);
    expect(first.releasesRemaining).toBe(TEST_ADMIN_MAX_RELEASES);
    expect(first.maxReleases).toBe(TEST_ADMIN_MAX_RELEASES);

    const entitlementPath = `entitlements/${first.entitlementId}`;
    const stored = mockDocs[entitlementPath];
    expect(stored?.status).toBe("AVAILABLE");
    expect(stored?.uid).toBe("user-test-1");
    expect(stored?.orderId).toBe("TEST_ADMIN_user-test-1");
    expect(stored?.productCode).toBe("pack_premium_dossier_v5");
    expect(stored?.syntheticTest).toBe(true);
    expect(stored?.environment).toBe("sandbox");
    expect(stored?.provisionedForEmail).toBe("barisbagirlar@gmail.com");

    const ledgerPath = Object.keys(mockDocs).find((path) => path.startsWith("commerce_ledger/"));
    expect(ledgerPath).toBeTruthy();
    expect(mockDocs[ledgerPath as string]?.type).toBe("ENTITLEMENT_ISSUED");
    expect(mockDocs[ledgerPath as string]?.syntheticTest).toBe(true);

    const second = await ensureTestAdminEntitlement(mockDbTransaction as never, "user-test-1", "barisbagirlar@gmail.com");
    expect(second.entitlementId).toBe(first.entitlementId);
    const entitlementDocs = Object.keys(mockDocs).filter((path) => path.startsWith("entitlements/"));
    expect(entitlementDocs).toHaveLength(1);
  });

  it("4. Rejects invalid uid (fail-closed) before writing", async () => {
    await expect(
      ensureTestAdminEntitlement(mockDbTransaction as never, "", "barisbagirlar@gmail.com")
    ).rejects.toThrow();
    expect(Object.keys(mockDocs)).toHaveLength(0);
  });

  it("5. isTestAdminEmail lowercases and trims", () => {
    expect(isTestAdminEmail("  BARISBAGIRLAR@gmail.com ")).toBe(true);
    expect(isTestAdminEmail("teb232@GMAIL.com")).toBe(false);
    expect(isTestAdminEmail("nope@gmail.com")).toBe(false);
  });
});
