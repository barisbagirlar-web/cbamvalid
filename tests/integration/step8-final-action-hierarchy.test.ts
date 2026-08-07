/**
 * FAZ UX (2026-08-06) — Step 8 final-action hierarchy.
 *
 * The sealing objective must never disappear behind a generic review CTA:
 *   - Step 8 heading is "Final review and seal" with the seal mandate copy;
 *   - exactly one manual save control ("Save progress") and zero "Save draft";
 *   - the fixed footer holds the only primary seal CTA, in the same position
 *     for every state, labelled with the word "seal" in every pre-release state;
 *   - BLOCKED stays clickable and reveals the blockers in place — it never
 *     invokes payment and never invokes sealing;
 *   - PAYMENT_REQUIRED reuses the canonical price source (no hardcoded amount);
 *   - the header exposes a non-interactive save indicator, never a save button.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CANONICAL_PRICING } from "@/lib/billing/pricing-config";
import {
  formatStep8CtaLabel,
  STEP8_FINAL_SUPPORTING_TEXT,
  STEP8_FINAL_TITLE,
  STEP8_PACKAGE_PREVIEW_HEADLINE,
  type Step8Status,
} from "@/lib/cbam/wizard-validation";

const readSource = (relative: string): string =>
  readFileSync(path.join(process.cwd(), relative), "utf8");

const clientPath = "app/(workspace)/cases/[caseId]/CaseWizardClient.tsx";

function footerCtaCase(status: Step8Status): string {
  const client = readSource(clientPath);
  const renderFooter = client.match(/const renderFooterCta = \(\) => \{([\s\S]*?)\n  \};/)?.[1] || "";
  const match = renderFooter.match(new RegExp(`case "${status}":([\\s\\S]*?)\\n      case |case "${status}":([\\s\\S]*)$`));
  return (match?.[1] || match?.[2] || "").trim();
}

describe("Step 8 final-action hierarchy", () => {
  const client = readSource(clientPath);

  it("A. BLOCKED renders 'Complete 10 requirements to seal'", () => {
    const rendered = formatStep8CtaLabel("BLOCKED", { openItemCount: 10, price: "$449" });
    expect(rendered).toBe("Complete 10 requirements to seal");
  });

  it("B. clicking the BLOCKED CTA reveals blockers and never pays or seals", () => {
    const blocked = footerCtaCase("BLOCKED");
    expect(blocked).toContain("onClick={revealSealBlockers}");
    expect(blocked).not.toContain("handleSeal");
    expect(blocked).not.toContain("sealReport");
    expect(blocked).not.toContain("/credits/buy");
    expect(blocked).not.toContain("<Link");
    // revealSealBlockers opens the panel in place and moves focus to the first
    // blocker action.
    expect(client).toContain("setShowBlockers(true)");
    expect(client).toContain('data-testid="first-blocker-action"');
    expect(client).toContain("firstAction?.focus()");
    // No generic "Review remaining requirements" primary CTA anywhere.
    expect(blocked).not.toContain("Review remaining requirements");
    expect(client).not.toContain("Review remaining requirements");
  });

  it("C. READY_TO_LOCK renders 'Seal package and create downloads'", () => {
    const rendered = formatStep8CtaLabel("READY_TO_LOCK", { openItemCount: 0, price: "$449" });
    expect(rendered).toBe("Seal package and create downloads");
  });

  it("D. PAYMENT_REQUIRED reuses the existing dynamic price", () => {
    const rendered = formatStep8CtaLabel("PAYMENT_REQUIRED", {
      openItemCount: 0,
      price: CANONICAL_PRICING.priceFormatted,
    });
    expect(rendered).toBe(`Pay ${CANONICAL_PRICING.priceFormatted} and seal package`);
    // The client passes the canonical price into the formatter — no hardcoded
    // amount appears in the footer CTA path.
    expect(client).toContain("price: CANONICAL_PRICING.priceFormatted");
  });

  it("E. LOCKED renders 'Open sealed package' and is derived from a real release", () => {
    const rendered = formatStep8CtaLabel("LOCKED", { openItemCount: 0, price: "$449" });
    expect(rendered).toBe("Open sealed package");
    // The footer renders a Link to the sealed-package list for LOCKED.
    expect(footerCtaCase("LOCKED")).toContain('href="/reports"');
    // LOCKED is reachable: the client derives it from the entitlement-bound
    // releasesCount, never from client UI state alone.
    expect(client).toContain("const hasSealedRelease = currentReleasesCount > 0;");
    expect(client).toContain("hasSealedRelease\n        ? \"LOCKED\"");
    expect(client).toContain('lockedReportId = hasSealedRelease ? "SEALED_RELEASE" : null');
    expect(client).toContain("lockedReportId,");
  });

  it("F. Step 8 has exactly one 'Save progress' and zero 'Save draft' labels", () => {
    expect(client.split("Save progress").length - 1).toBe(1);
    expect(client).not.toContain("Save draft");
    expect(client).not.toContain("Save draft and continue later");
  });

  it("G. the header contains no save button — only a non-interactive save indicator", () => {
    const header = client.match(/<header[\s\S]*?<\/header>/)?.[0] || "";
    expect(header).not.toMatch(/<button/);
    expect(header).toContain("aria-live=\"polite\"");
    expect(header).toContain("saveIndicatorText");
    expect(header).not.toContain("Save draft");
  });

  it("the step 8 heading is 'Final review and seal' with the seal mandate copy", () => {
    expect(STEP8_FINAL_TITLE).toBe("Final review and seal");
    expect(STEP8_FINAL_SUPPORTING_TEXT).toBe(
      "Complete the remaining requirements, then pay once, seal the working file and create the verifier downloads."
    );
    expect(client).toContain("{STEP8_FINAL_TITLE}");
    expect(client).toContain("{STEP8_FINAL_SUPPORTING_TEXT}");
  });

  it("the fixed footer reserves clearance so page content is never covered", () => {
    expect(client).toContain("pb-48");
    expect(client).toContain("md:pb-36");
    expect(client).toContain("fixed bottom-0");
  });

  it("the seal CTA is the only high-emphasis footer control (orange/gold, 52px, 300px)", () => {
    const footerCta = client.match(/const renderFooterCta = \(\) => \{([\s\S]*?)\n  \};/)?.[1] || "";
    expect(footerCta).toContain("bg-seal");
    expect(footerCta).toContain("min-h-[52px]");
    expect(footerCta).toContain("sm:min-w-[300px]");
    expect(footerCta).toContain("text-ink");
    // The manual save control stays neutral (bordered surface, not the seal
    // color and not accent).
    const saveControl = client.match(/onClick=\{\(\) => void handleSave\(\)\}[\s\S]*?Save progress/)?.[0] || "";
    expect(saveControl).toContain("Save progress");
    expect(saveControl).toContain("border border-border");
    expect(saveControl).not.toContain("bg-seal");
    expect(saveControl).not.toContain("bg-accent");
    // The seal CTA renders only from the footer switch, never on the body.
    const commandCenter = client.match(/aria-label="Lock and download center"([\s\S]*?)<\/section>/)?.[1] || "";
    expect(commandCenter).not.toContain("bg-seal");
    expect(commandCenter).not.toContain("step8-primary-action");
  });

  it("the pre-release package preview never claims a sealed release", () => {
    expect(STEP8_PACKAGE_PREVIEW_HEADLINE.toLowerCase()).not.toContain("sealed");
    expect(STEP8_PACKAGE_PREVIEW_HEADLINE.toLowerCase()).not.toContain("successful");
  });
});
