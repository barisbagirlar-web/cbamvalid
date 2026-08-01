/**
 * FAZ QA (2026-08-01) — sandbox-only surface isolation.
 *
 * /qa/four-dossiers must be a hard HTTP 404 outside the sandbox project.
 * Next.js notFound() alone returns HTTP 200 for streamed responses, so the
 * proxy (edge) must short-circuit before rendering. Defense-in-depth:
 *   - proxy.ts returns a real 404 for /qa/* when NEXT_PUBLIC_APP_ENV !== sandbox;
 *   - the page itself also calls notFound() when isSandboxApp() is false.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relative: string): string =>
  readFileSync(path.join(process.cwd(), relative), "utf8");

describe("sandbox-only QA route guard", () => {
  it("proxy.ts returns a hard 404 for /qa/* outside the sandbox project", () => {
    const proxy = readSource("proxy.ts");
    expect(proxy).toContain('pathname.startsWith("/qa/")');
    expect(proxy).toContain('process.env.NEXT_PUBLIC_APP_ENV !== "sandbox"');
    expect(proxy).toContain("status: 404");
    // The guard must run before session/cookie handling so the sandbox route
    // short-circuits to a hard 404 instead of being rewritten or redirected.
    const guardIndex = proxy.indexOf('pathname.startsWith("/qa/")');
    const sessionIndex = proxy.indexOf("request.cookies.get");
    expect(guardIndex).toBeGreaterThanOrEqual(0);
    expect(sessionIndex).toBeGreaterThan(guardIndex);
  });

  it("the QA page keeps notFound() as defense-in-depth", () => {
    const page = readSource("app/(workspace)/qa/four-dossiers/page.tsx");
    expect(page).toContain("notFound()");
    expect(page).toContain("isSandboxApp()");
    // Fixtures load only after the sandbox gate.
    expect(page.indexOf("import(")).toBeGreaterThan(page.indexOf("notFound()"));
  });

  it("sandbox env detection is strictly flag-gated", () => {
    const env = readSource("lib/cbam/sandbox-env.ts");
    expect(env).toContain('process.env.NEXT_PUBLIC_APP_ENV === "sandbox"');
    // The gate must be the APP_ENV flag only — never a project-id check that
    // could leak or drift.
    expect(env).not.toContain('NEXT_PUBLIC_FIREBASE_PROJECT_ID');
  });
});
