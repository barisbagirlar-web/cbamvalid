import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isOwnerSuperAdmin, requireOwnerSuperAdmin } from "../../functions/src/auth/owner-admin";

const originalUid = process.env.OWNER_ADMIN_UID;
const originalEmail = process.env.OWNER_ADMIN_EMAIL;

describe("Exact owner super-admin authorization", () => {
  beforeEach(() => {
    process.env.OWNER_ADMIN_UID = "owner-uid";
    process.env.OWNER_ADMIN_EMAIL = "owner@example.com";
  });

  afterEach(() => {
    if (originalUid === undefined) delete process.env.OWNER_ADMIN_UID;
    else process.env.OWNER_ADMIN_UID = originalUid;
    if (originalEmail === undefined) delete process.env.OWNER_ADMIN_EMAIL;
    else process.env.OWNER_ADMIN_EMAIL = originalEmail;
  });

  const valid = {
    uid: "owner-uid",
    token: {
      email: "owner@example.com",
      email_verified: true,
      role: "super_admin",
      owner: true,
    },
  };

  it("accepts only the exact configured owner identity and claims", () => {
    expect(isOwnerSuperAdmin(valid)).toBe(true);
    expect(() => requireOwnerSuperAdmin(valid)).not.toThrow();
  });

  it.each([
    { ...valid, uid: "other-uid" },
    { ...valid, token: { ...valid.token, email: "other@example.com" } },
    { ...valid, token: { ...valid.token, email_verified: false } },
    { ...valid, token: { ...valid.token, role: "admin" } },
    { ...valid, token: { ...valid.token, owner: false } },
    { uid: "owner-uid", token: { email: "owner@example.com", email_verified: true, admin: true, ownerAdmin: true } },
  ])("rejects incomplete or legacy admin authority", (candidate) => {
    expect(isOwnerSuperAdmin(candidate)).toBe(false);
    expect(() => requireOwnerSuperAdmin(candidate)).toThrow(
      "Requires exact owner super-admin privileges."
    );
  });

  it("fails closed when owner identity environment is missing", () => {
    delete process.env.OWNER_ADMIN_UID;
    delete process.env.OWNER_ADMIN_EMAIL;
    expect(isOwnerSuperAdmin(valid)).toBe(false);
  });
});
