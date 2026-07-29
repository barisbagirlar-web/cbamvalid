import { afterEach, describe, expect, it } from "vitest";
import {
  CANONICAL_OWNER_EMAIL,
  isCanonicalOwner,
  requireCanonicalOwner,
} from "../../functions/src/auth/owner-contract";

const OWNER_UID = "canonical-owner-uid";

function ownerAuth(overrides: Record<string, unknown> = {}) {
  return {
    uid: OWNER_UID,
    token: {
      email: CANONICAL_OWNER_EMAIL,
      email_verified: true,
      role: "super_admin",
      owner: true,
      ownerUid: OWNER_UID,
      ...overrides,
    },
  };
}

describe("canonical owner authorization", () => {
  afterEach(() => {
    delete process.env.SUPER_ADMIN_UID;
  });

  it("requires the configured exact UID and all immutable owner conditions", () => {
    process.env.SUPER_ADMIN_UID = OWNER_UID;
    expect(() => requireCanonicalOwner(ownerAuth())).not.toThrow();
    expect(() => requireCanonicalOwner({ ...ownerAuth(), uid: "teb232-test-user" }))
      .toThrow("Canonical owner authorization is required.");
    expect(() => requireCanonicalOwner(ownerAuth({ email_verified: false })))
      .toThrow("Canonical owner authorization is required.");
    expect(() => requireCanonicalOwner(ownerAuth({ role: "user" })))
      .toThrow("Canonical owner authorization is required.");
    expect(() => requireCanonicalOwner(ownerAuth({ owner: false })))
      .toThrow("Canonical owner authorization is required.");
    expect(isCanonicalOwner(ownerAuth({ role: "pilot", pilot: true }))).toBe(false);
    expect(isCanonicalOwner(ownerAuth({ admin: true, owner: false }))).toBe(false);
  });

  it("fails closed when the canonical owner UID is not configured", () => {
    expect(() => requireCanonicalOwner(ownerAuth()))
      .toThrow("Canonical owner identity is not configured.");
  });
});
