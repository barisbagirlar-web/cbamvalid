import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

function request(path: string, authenticated = false): NextRequest {
  return new NextRequest(`https://cbamvalid.test${path}`, {
    headers: authenticated
      ? { cookie: "__session=test-session-cookie" }
      : undefined,
  });
}

describe("workspace proxy", () => {
  it.each([
    "/account",
    "/account#security",
    "/credits",
    "/credits/buy?caseId=case-123",
  ])("protects %s and preserves its path and query", (path) => {
    const response = proxy(request(path));
    const location = new URL(response.headers.get("location")!);
    const requested = new URL(`https://cbamvalid.test${path}`);

    expect(response.status).toBe(307);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next"))
      .toBe(`${requested.pathname}${requested.search}`);
  });

  it("does not treat the public CBAM SEO path as workspace", () => {
    const response = proxy(request("/cbam-2026-guide"));

    expect(response.headers.get("location")).toBeNull();
  });

  it.each(["/", "/login", "/register"])(
    "sends authenticated visitors from %s directly to the workspace",
    (path) => {
      const response = proxy(request(path, true));

      expect(response.status).toBe(307);
      expect(new URL(response.headers.get("location")!).pathname).toBe("/cbam");
    },
  );

  it("marks authenticated workspace responses private and non-cacheable", () => {
    const response = proxy(request("/account", true));

    expect(response.headers.get("cache-control"))
      .toBe("private, no-store, no-cache, must-revalidate");
  });
});
