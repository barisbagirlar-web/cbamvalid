import { describe, expect, it } from "vitest";
import { resolveSafeNextRoute } from "../../lib/auth/safe-next-route";
import { requireVerifiedUser } from "../../functions/src/auth/verified-user";

describe("Safe internal post-auth routing", () => {
  it.each([
    ["/cbam", "/cbam"],
    ["/cases/new?cn=73089098", "/cases/new?cn=73089098"],
    ["/reports#latest", "/reports#latest"],
  ])("accepts internal route %s", (input, expected) => {
    expect(resolveSafeNextRoute(input, "/fallback")).toBe(expected);
  });

  it.each([
    "https://attacker.example",
    "//attacker.example/path",
    "javascript:alert(1)",
    "/\\attacker.example",
    "cases/new",
    "",
  ])("rejects unsafe route %s", (input) => {
    expect(resolveSafeNextRoute(input, "/fallback")).toBe("/fallback");
  });
});

describe("Verified-user commerce boundary", () => {
  it("accepts an authenticated token with a verified email", () => {
    expect(() => requireVerifiedUser({
      uid: "user-123",
      token: { email: "user@example.com", email_verified: true },
    })).not.toThrow();
  });

  it.each([
    { email: "user@example.com", email_verified: false },
    { email: "", email_verified: true },
    { email_verified: true },
  ])("rejects an unverified or missing email token", (token) => {
    expect(() => requireVerifiedUser({ uid: "user-123", token })).toThrow(
      "EMAIL_VERIFICATION_REQUIRED"
    );
  });
});
