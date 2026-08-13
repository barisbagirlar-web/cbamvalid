import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { EDGE_CASE_PLAYBOOK, edgeCaseStatusCounts } from "../../lib/trust/edge-case-playbook";

describe("extreme-scenario money playbook", () => {
  it("covers the eleven revenue-critical edge cases without inventing SLAs", () => {
    expect(EDGE_CASE_PLAYBOOK).toHaveLength(11);
    const ids = EDGE_CASE_PLAYBOOK.map((row) => row.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "deadline-night-surge",
        "double-checkout-race",
        "chargeback-after-download",
        "ruleset-mid-draft",
        "malicious-input-fuzz",
        "verify-oracle",
        "session-theft-xss",
        "region-death",
        "gdpr-vs-verify",
        "eua-price-feed-outage",
        "delegated-act-shock",
      ]),
    );
    const blob = EDGE_CASE_PLAYBOOK.map(
      (row) => `${row.commercialPosition} ${row.technicalPosition} ${row.moneyRule}`,
    ).join(" ");
    expect(blob).not.toMatch(/99\.9%/);
    expect(blob).toMatch(/not (an )?unlimited free/i);
    expect(blob).toMatch(/\/api\/checkout\/cbam/);
    expect(blob).toMatch(/Failed or blocked seals do not consume/i);
    expect(blob).toMatch(/commerce_checkout_locks/i);
    expect(blob).toMatch(/Chargebacks are handled via Paddle/i);
    expect(blob).toMatch(/ruleset-pin-banner/);
    expect(edgeCaseStatusCounts().CODE_PROVEN).toBeGreaterThanOrEqual(4);
  });

  it("surfaces the playbook on /trust and chargeback rules on /refund-policy", () => {
    const trust = readFileSync(resolve(process.cwd(), "app/(public)/trust/page.tsx"), "utf8");
    const refund = readFileSync(resolve(process.cwd(), "app/(public)/refund-policy/page.tsx"), "utf8");
    const liveCheckout = readFileSync(resolve(process.cwd(), "app/api/checkout/cbam/route.ts"), "utf8");
    const lock = readFileSync(resolve(process.cwd(), "lib/billing/checkout-lock.ts"), "utf8");
    const wizard = readFileSync(
      resolve(process.cwd(), "app/(workspace)/cases/[caseId]/CaseWizardClient.tsx"),
      "utf8",
    );
    expect(trust).toContain("EDGE_CASE_PLAYBOOK");
    expect(trust).toContain("Extreme scenarios");
    expect(refund).toContain("Chargeback after sealed download");
    expect(liveCheckout).toContain("claimOrReuseCheckoutLock");
    expect(lock).toContain("commerce_checkout_locks");
    expect(lock).toContain("CHECKOUT_LOCK_TTL_MS");
    expect(wizard).toContain('data-testid="ruleset-pin-banner"');
  });
});
