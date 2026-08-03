import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("case workspace performance contract", () => {
  it("primes a validated timestamped case cache before navigation", () => {
    const link = read("components/cbam/CaseResumeLink.tsx");
    const cache = read("lib/cbam/workspace-cache.ts");

    expect(link).toContain("writeCaseWorkspaceCache");
    expect(link).toContain("seedWorkspaceCase");
    expect(link).toContain("prewarmCaseWorkspace");
    expect(link).toContain("onPointerEnter={prewarm}");
    expect(link).toContain("onFocus={prewarm}");
    expect(link).toContain("onTouchStart={prewarm}");
    expect(cache).toContain("AuditReadyCaseSchema.parse");
    expect(cache).toContain("FAST_OPEN_MAX_AGE_MS");
    expect(cache).toContain("cachedAt: Date.now()");
  });

  it("deduplicates concurrent case and entitlement reads", () => {
    const loader = read("lib/functions/workspace-loader.ts");

    expect(loader).toContain("caseInflight");
    expect(loader).toContain("entitlementInflight");
    expect(loader).toContain("if (active) return active");
    expect(loader).toContain("if (entitlementInflight) return entitlementInflight");
    expect(loader).toContain("Promise.allSettled");
  });

  it("opens the editor from a fresh case snapshot without waiting for capacity", () => {
    const page = read("app/(workspace)/cases/[caseId]/page.tsx");

    expect(page).toContain("readFreshCaseWorkspaceCache");
    expect(page).toContain("setCaseLoading(false)");
    expect(page).toContain("loadWorkspaceCase(caseId, { forceRefresh: true })");
    expect(page).toContain("loadWorkspaceEntitlements({ forceRefresh: true })");
    expect(page).toContain("Verifying release capacity in the background");
    expect(page).not.toContain("Promise.allSettled([getCase(caseId), getEntitlements()])");
    expect(page).not.toContain("Retrieving the case record and verified release capacity.");
  });

  it("uses the prewarming link on every visible case row", () => {
    const cases = read("app/(workspace)/cases/page.tsx");
    expect(cases).toContain("CaseResumeLink");
    expect(cases).toContain("caseData={cbamCase.data}");
    expect(cases).toContain("updatedAt={cbamCase.updatedAt}");
  });
});
