import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { STEP8_FOOTER_CTA_LABELS } from "@/lib/cbam/wizard-validation";

const readSource = (relative: string): string =>
  readFileSync(path.join(process.cwd(), relative), "utf8");

/** Extracts a single `case "<status>":` branch from the renderFooterCta switch. */
function footerCtaCase(source: string, status: string): string {
  const renderFooter = source.match(/const renderFooterCta = \(\) => \{([\s\S]*?)\n  \};/)?.[1] || "";
  const match = renderFooter.match(new RegExp(`case "${status}":([\\s\\S]*?)\\n      case |case "${status}":([\\s\\S]*)$`));
  return (match?.[1] || match?.[2] || "").trim();
}

describe("Step 8 premium release command center", () => {
  const client = readSource("app/(workspace)/cases/[caseId]/CaseWizardClient.tsx");
  const globalCss = readSource("app/globals.css");

  it("renders one explicit, always-visible command center with immediate operation feedback", () => {
    expect(client).toContain('aria-label="Lock and download center"');
    expect(client).toContain('data-testid="step8-primary-action"');
    expect(client).toContain('setSealProgress("VALIDATING")');
    expect(client).toContain('Validating the latest working-file data and payment status');
    expect(client).toContain('setSealProgress("CREATING")');
    expect(client).toContain('Creating your locked package and integrity manifest');
  });

  it("makes a failed package attempt retryable instead of sending a zero-blocker user to requirements", () => {
    // The LOCK_FAILED footer CTA retries the same protected request.
    const lockFailedCase = footerCtaCase(client, "LOCK_FAILED");
    expect(lockFailedCase).toContain("onClick={handleSeal}");
    // The footer renders the runtime label from the SSOT (no hardcoded copy).
    expect(client).toContain("formatStep8CtaLabel(step8Status,");
    expect(STEP8_FOOTER_CTA_LABELS.LOCK_FAILED).toBe("Retry sealing package");
  });

  it("the single primary seal CTA lives only in the fixed footer (not duplicated on the body)", () => {
    // The release command center (body section) must not mount its own seal CTA.
    const commandCenter = client.match(
      /aria-label="Lock and download center"([\s\S]*?)<\/section>/
    )?.[1] || "";
    expect(commandCenter).not.toContain("step8-primary-action");
    expect(commandCenter).not.toContain("onClick={handleSeal}");
    // The footer switch is the only place that renders a Step 8 primary CTA.
    const footerCta = client.match(/const renderFooterCta = \(\) => \{([\s\S]*?)\n  \};/)?.[1] || "";
    expect(footerCta).toContain('data-testid="step8-primary-action"');
    expect(footerCta).toContain("bg-seal");
    expect(footerCta).toContain("min-h-[52px]");
    expect(footerCta).toContain("sm:min-w-[300px]");
  });

  it("does not advertise a stale entitlement without its server identifier", () => {
    expect(client).toContain('return Boolean(entitlementId) && caseMatches');
  });

  it("positions independent verification after the operator package rather than as a false blocker", () => {
    expect(client).toContain("Independent verification");
    expect(client).toContain("POST-RELEASE");
    expect(client).toContain("does not block the operator working-file release");
  });

  it("keeps the fixed footer as the single visual action authority", () => {
    expect(globalCss).toContain('section[aria-label="Lock and download center"] [data-testid="step8-primary-action"]');
    expect(globalCss).toContain('main:has(section[aria-label="Final review status"]) > div.fixed.bottom-0');
    expect(globalCss).toContain("min-height: 60px !important");
    expect(globalCss).toContain("var(--color-accent) !important");
    expect(globalCss).toContain("color: #fff !important");
  });

  it("uses the emissions panel width and prevents metric values from escaping their card", () => {
    expect(globalCss).toContain("container-name: emissions-summary");
    expect(globalCss).toContain("container-type: inline-size");
    expect(globalCss).toContain("overflow-wrap: anywhere");
    expect(globalCss).toContain("grid-template-columns: repeat(6, minmax(0, 1fr)) !important");
    expect(globalCss).toContain(":nth-child(n + 4)");
  });

  it("does not mount an actionable wizard from stale local cache", () => {
    const page = readSource("app/(workspace)/cases/[caseId]/page.tsx");
    const cacheBlock = page.match(/if \(cachedCase\) \{([\s\S]*?)\n        \}/)?.[1] || "";
    expect(cacheBlock).toContain("setInitialCase");
    expect(cacheBlock).not.toContain("setDataLoading(false)");
    expect(page).toContain("server returns the current case and pack");
  });
});
