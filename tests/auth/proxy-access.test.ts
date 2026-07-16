import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../../proxy";

function request(path: string, authenticated = false): NextRequest {
  return new NextRequest(`https://cbamvalid.example${path}`, {
    headers: authenticated ? { cookie: "__session=valid-session" } : undefined,
  });
}

describe("Proxy route access matrix", () => {
  it.each([
    "/account",
    "/credits/buy",
    "/cases",
    "/cases/new?cn=73089098",
    "/reports",
    "/cbam",
    "/admin",
  ])("redirects anonymous workspace access for %s", (path) => {
    const response = proxy(request(path));
    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("/login?next=");
    expect(decodeURIComponent(location || "")).toContain(path);
  });

  it.each(["/login", "/register", "/verify-email", "/"])(
    "redirects authenticated users away from %s",
    (path) => {
      const response = proxy(request(path, true));
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("https://cbamvalid.example/cbam");
    }
  );

  it.each([
    "/product",
    "/verify",
    "/cases-study",
    "/accounting",
    "/credits-and-pricing",
  ])("does not misclassify public route %s", (path) => {
    const response = proxy(request(path));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("sets no-store headers on authenticated workspace responses", () => {
    const response = proxy(request("/account", true));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
  });
});
