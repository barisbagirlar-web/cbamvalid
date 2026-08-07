/**
 * FAZ UX (2026-08-01) — Footer contract.
 *
 * Step 1–7 footer: Previous · Save draft · Continue.
 * Step 8 footer: Previous · Save draft · exactly one contextual CTA
 * (never a disabled Next). The footer uses mobile safe-area padding and the
 * main content reserves real footer height so nothing is covered.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  formatStep8CtaLabel,
  STEP8_FOOTER_CTA_LABELS,
  STEP8_PACKAGE_PREVIEW_HEADLINE,
  type Step8Status,
} from "@/lib/cbam/wizard-validation";

const readSource = (relative: string): string =>
  readFileSync(path.join(process.cwd(), relative), "utf8");

describe("wizard footer", () => {
  it("provides exactly one contextual CTA label per Step 8 status", () => {
    const statuses: Step8Status[] = ["BLOCKED", "PAYMENT_REQUIRED", "READY_TO_LOCK", "LOCKING", "LOCKED", "LOCK_FAILED"];
    expect(Object.keys(STEP8_FOOTER_CTA_LABELS).sort()).toEqual([...statuses].sort());
    for (const status of statuses) {
      expect(STEP8_FOOTER_CTA_LABELS[status].trim().length).toBeGreaterThan(0);
    }
  });

  it("labels match the mandate wording exactly and every pre-release label contains 'seal'", () => {
    expect(STEP8_FOOTER_CTA_LABELS.BLOCKED).toBe("Complete {openItemCount} requirements to seal");
    expect(STEP8_FOOTER_CTA_LABELS.PAYMENT_REQUIRED).toBe("Pay {price} and seal package");
    expect(STEP8_FOOTER_CTA_LABELS.READY_TO_LOCK).toBe("Seal package and create downloads");
    expect(STEP8_FOOTER_CTA_LABELS.LOCKING).toBe("Sealing package…");
    expect(STEP8_FOOTER_CTA_LABELS.LOCKED).toBe("Open sealed package");
    expect(STEP8_FOOTER_CTA_LABELS.LOCK_FAILED).toBe("Retry sealing package");

    // Runtime rendering: BLOCKED carries the requirement count, PAYMENT_REQUIRED
    // carries the canonical price (never hardcoded in the SSOT).
    expect(formatStep8CtaLabel("BLOCKED", { openItemCount: 10, price: "$449" })).toBe("Complete 10 requirements to seal");
    expect(formatStep8CtaLabel("PAYMENT_REQUIRED", { openItemCount: 0, price: "$449" })).toBe("Pay $449 and seal package");
    expect(formatStep8CtaLabel("READY_TO_LOCK", { openItemCount: 0, price: "$449" })).toBe("Seal package and create downloads");
    expect(formatStep8CtaLabel("LOCKING", { openItemCount: 0, price: "$449" })).toBe("Sealing package…");
    expect(formatStep8CtaLabel("LOCKED", { openItemCount: 0, price: "$449" })).toBe("Open sealed package");
    expect(formatStep8CtaLabel("LOCK_FAILED", { openItemCount: 0, price: "$449" })).toBe("Retry sealing package");

    for (const preRelease of ["BLOCKED", "PAYMENT_REQUIRED", "READY_TO_LOCK", "LOCKING", "LOCK_FAILED"] as const) {
      expect(formatStep8CtaLabel(preRelease, { openItemCount: 10, price: "$449" }).toLowerCase()).toContain("seal");
    }
  });

  it("never renders a disabled Next on step 8 (STEP8_DISABLED_NEXT=0)", () => {
    const client = readSource("app/(workspace)/cases/[caseId]/CaseWizardClient.tsx");
    // The only "Continue"/Next affordance is for steps 1–7 and is never
    // disabled; step 8 renders a status-driven CTA instead.
    expect(client).toContain("Continue <ArrowRight");
    expect(client).not.toContain('disabled={currentStep === 8}');
    // A literal "Next" button does not exist anywhere in the wizard.
    expect(client).not.toMatch(/<button[^>]*>\s*Next\s*<\/button>/);
  });

  it("the footer CTA branch covers every status (no missing label fall-through)", () => {
    const statuses: Step8Status[] = ["BLOCKED", "PAYMENT_REQUIRED", "READY_TO_LOCK", "LOCKING", "LOCKED", "LOCK_FAILED"];
    for (const status of statuses) {
      expect(STEP8_FOOTER_CTA_LABELS[status].trim().length).toBeGreaterThan(0);
    }
    const client = readSource("app/(workspace)/cases/[caseId]/CaseWizardClient.tsx");
    // The renderFooterCta switch handles every status explicitly.
    for (const status of statuses) {
      expect(client).toContain(`case "${status}"`);
    }
  });

  it("main content reserves footer height and the footer uses mobile safe-area", () => {
    const client = readSource("app/(workspace)/cases/[caseId]/CaseWizardClient.tsx");
    expect(client).toContain("pb-48");
    expect(client).toContain("fixed bottom-0");
    expect(client).toContain("pb-[env(safe-area-inset-bottom)]");
  });

  it("the package preview headline is distinct from the sealed success claim", () => {
    expect(STEP8_PACKAGE_PREVIEW_HEADLINE).toBe("What your locked package will include");
    expect(STEP8_PACKAGE_PREVIEW_HEADLINE.toLowerCase()).not.toContain("sealed");
    expect(STEP8_PACKAGE_PREVIEW_HEADLINE.toLowerCase()).not.toContain("successful");
  });
});
