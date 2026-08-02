import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relative: string): string =>
  readFileSync(path.join(process.cwd(), relative), "utf8");

describe("Step 8 premium release command center", () => {
  const client = readSource("app/(workspace)/cases/[caseId]/CaseWizardClient.tsx");

  it("renders one explicit, always-visible command center with immediate operation feedback", () => {
    expect(client).toContain('aria-label="Release command center"');
    expect(client).toContain('data-testid="step8-primary-action"');
    expect(client).toContain('setSealProgress("VALIDATING")');
    expect(client).toContain('Validating the latest working-file data and entitlement');
    expect(client).toContain('setSealProgress("CREATING")');
    expect(client).toContain('Creating the controlled package and integrity manifest');
  });

  it("makes a failed package attempt retryable instead of sending a zero-blocker user to requirements", () => {
    expect(client).toMatch(/case "LOCK_FAILED":[\s\S]*?onClick=\{handleSeal\}[\s\S]*?STEP8_FOOTER_CTA_LABELS\.LOCK_FAILED/);
    expect(client).toContain('step8Status === "LOCK_FAILED" ? STEP8_FOOTER_CTA_LABELS.LOCK_FAILED');
  });

  it("does not advertise a stale entitlement without its server identifier", () => {
    expect(client).toContain('return Boolean(entitlementId) && caseMatches');
  });

  it("positions independent verification after the operator package rather than as a false blocker", () => {
    expect(client).toContain("Independent verification");
    expect(client).toContain("POST-RELEASE");
    expect(client).toContain("does not block the operator working-file release");
  });

  it("does not mount an actionable wizard from stale local cache", () => {
    const page = readSource("app/(workspace)/cases/[caseId]/page.tsx");
    const cacheBlock = page.match(/if \(cachedCase\) \{([\s\S]*?)\n        \}/)?.[1] || "";
    expect(cacheBlock).toContain("setInitialCase");
    expect(cacheBlock).not.toContain("setDataLoading(false)");
    expect(page).toContain("server returns the current case and pack");
  });
});
