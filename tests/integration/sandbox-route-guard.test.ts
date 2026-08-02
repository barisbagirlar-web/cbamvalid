/**
 * Sandbox-only surface isolation.
 *
 * Both the QA index and generated artifact endpoints must be hard HTTP 404s
 * outside the isolated sandbox project. The edge guard runs before auth and
 * the route/page repeat the environment check as defense-in-depth.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relative: string): string =>
  readFileSync(path.join(process.cwd(), relative), "utf8");

describe("sandbox-only QA route guard", () => {
  it("proxy.ts returns a hard 404 for QA pages and downloads outside sandbox", () => {
    const proxy = readSource("proxy.ts");
    expect(proxy).toContain('pathname.startsWith("/qa/")');
    expect(proxy).toContain('pathname.startsWith("/api/qa/")');
    expect(proxy).toContain('process.env.NEXT_PUBLIC_APP_ENV !== "sandbox"');
    expect(proxy).toContain("status: 404");

    // The guard must run before session/cookie handling so no synthetic route
    // can be redirected, authenticated or rendered in production.
    const pageGuardIndex = proxy.indexOf('pathname.startsWith("/qa/")');
    const apiGuardIndex = proxy.indexOf('pathname.startsWith("/api/qa/")');
    const sessionIndex = proxy.indexOf("request.cookies.get");
    expect(pageGuardIndex).toBeGreaterThanOrEqual(0);
    expect(apiGuardIndex).toBeGreaterThanOrEqual(0);
    expect(sessionIndex).toBeGreaterThan(pageGuardIndex);
    expect(sessionIndex).toBeGreaterThan(apiGuardIndex);
  });

  it("the QA page keeps notFound() before fixture imports", () => {
    const page = readSource("app/(workspace)/qa/four-dossiers/page.tsx");
    expect(page).toContain("notFound()");
    expect(page).toContain("isSandboxApp()");
    expect(page.indexOf("import(")).toBeGreaterThan(page.indexOf("notFound()"));
  });

  it("the artifact route checks sandbox before fixture imports", () => {
    const route = readSource("app/api/qa/four-dossiers/[key]/[format]/route.ts");
    expect(route).toContain("if (!isSandboxApp())");
    expect(route).toContain("status: 404");
    expect(route.indexOf("import(")).toBeGreaterThan(route.indexOf("if (!isSandboxApp())"));
    expect(route).toContain('"Cache-Control": "private, no-store, no-cache, must-revalidate"');
    expect(route).toContain('"X-CBAMValid-QA-Data": "synthetic"');
  });

  it("sandbox env detection is strictly flag-gated", () => {
    const env = readSource("lib/cbam/sandbox-env.ts");
    expect(env).toContain('process.env.NEXT_PUBLIC_APP_ENV === "sandbox"');
    expect(env).not.toContain('NEXT_PUBLIC_FIREBASE_PROJECT_ID');
  });
});
