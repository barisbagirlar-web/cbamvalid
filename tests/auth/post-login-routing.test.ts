import { describe, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";
import {
  getPreservedAuthHref,
  resolvePostLoginRoute,
  sanitizeInternalNextPath,
} from "@/lib/auth/post-login-routing";

function userWithClaims(claims: Record<string, unknown>): User {
  return {
    uid: "canonical-owner-uid",
    getIdTokenResult: vi.fn().mockResolvedValue({ claims }),
  } as unknown as User;
}

describe("post-login routing", () => {
  it.each([
    ["/cases/case-123?step=4#evidence", "/cases/case-123?step=4#evidence"],
    ["/account", "/account"],
    ["/credits/buy?caseId=case-123", "/credits/buy?caseId=case-123"],
    ["/admin/credits/grant", "/admin/credits/grant"],
  ])("allows the internal route %s", (candidate, expected) => {
    expect(sanitizeInternalNextPath(candidate)).toBe(expected);
  });

  it.each([
    "https://evil.example/phish",
    "//evil.example/phish",
    "/\\evil.example/phish",
    "javascript:alert(1)",
    "/login",
    "/pricing",
    "/cbam-2026-guide",
    "/cases\u0000/hidden",
  ])("rejects unsafe or non-workspace route %s", (candidate) => {
    expect(sanitizeInternalNextPath(candidate)).toBeNull();
  });

  it("preserves an allowlisted next path between login and registration", () => {
    expect(getPreservedAuthHref("/register", "?next=%2Fcases%2Fcase-123%3Fstep%3D2"))
      .toBe("/register?next=%2Fcases%2Fcase-123%3Fstep%3D2");
    expect(getPreservedAuthHref("/login", "?next=https%3A%2F%2Fevil.example"))
      .toBe("/login");
  });

  it("sends a customer to the requested customer route", async () => {
    await expect(resolvePostLoginRoute(userWithClaims({}), "/account"))
      .resolves.toBe("/account");
  });

  it("does not send a customer into the admin area", async () => {
    await expect(resolvePostLoginRoute(userWithClaims({}), "/admin/credits"))
      .resolves.toBe("/cbam");
  });

  it("sends only the UID-bound canonical owner to the admin destination", async () => {
    const ownerClaims = {
      role: "super_admin",
      owner: true,
      ownerUid: "canonical-owner-uid",
    };
    await expect(resolvePostLoginRoute(userWithClaims(ownerClaims), "/account"))
      .resolves.toBe("/admin");
    await expect(resolvePostLoginRoute(userWithClaims(ownerClaims), "/admin/users"))
      .resolves.toBe("/admin/users");
    await expect(resolvePostLoginRoute(userWithClaims({ ownerAdmin: true }), "/admin/users"))
      .resolves.toBe("/cbam");
  });
});
