import { describe, expect, it } from "vitest";
import {
  AdminListTransactionsInputSchema,
  AdminListUsersInputSchema,
  AdminSetUserTokensInputSchema,
  decodeUserPageToken,
  encodeUserPageToken,
} from "../../functions/src/admin/user-pagination";

describe("admin user pagination cursor", () => {
  it("round-trips a Firebase document identifier", () => {
    const token = encodeUserPageToken("user_UID-123");
    expect(decodeUserPageToken(token)).toEqual({
      version: 1,
      documentId: "user_UID-123",
    });
  });

  it.each([
    "",
    "not+base64",
    Buffer.from("{}").toString("base64url"),
    Buffer.from(JSON.stringify({ version: 2, documentId: "user-1" })).toString("base64url"),
    Buffer.from(JSON.stringify({ version: 1, documentId: "../user" })).toString("base64url"),
  ])("rejects malformed or unsupported cursor %j", (token) => {
    expect(() => decodeUserPageToken(token)).toThrow("ADMIN_USER_PAGE_TOKEN_INVALID");
  });

  it("rejects identifiers that cannot be used as a document cursor", () => {
    expect(() => encodeUserPageToken("../user")).toThrow("ADMIN_USER_PAGE_CURSOR_INVALID");
    expect(() => encodeUserPageToken("a".repeat(129))).toThrow("ADMIN_USER_PAGE_CURSOR_INVALID");
  });

  it.each([1, 100, 500])("accepts bounded integer list limit %d", (limit) => {
    expect(AdminListUsersInputSchema.safeParse({ limit }).success).toBe(true);
    expect(AdminListTransactionsInputSchema.safeParse({ limit }).success).toBe(true);
  });

  it.each([0, -1, 1.5, 501, Number.POSITIVE_INFINITY])(
    "rejects invalid list limit %s",
    (limit) => {
      expect(AdminListUsersInputSchema.safeParse({ limit }).success).toBe(false);
      expect(AdminListTransactionsInputSchema.safeParse({ limit }).success).toBe(false);
    }
  );

  it("enforces bounded non-negative integer token balances and valid IDs", () => {
    expect(AdminSetUserTokensInputSchema.safeParse({
      targetUserId: "firebase-user-1",
      tokensToSet: 100,
    }).success).toBe(true);

    for (const input of [
      { targetUserId: "", tokensToSet: 100 },
      { targetUserId: "../user", tokensToSet: 100 },
      { targetUserId: "user", tokensToSet: -1 },
      { targetUserId: "user", tokensToSet: 1.5 },
      { targetUserId: "user", tokensToSet: 1_000_001 },
    ]) {
      expect(AdminSetUserTokensInputSchema.safeParse(input).success).toBe(false);
    }
  });
});
