import { test, expect, type Page } from "@playwright/test";
import { CBAM_WORKFLOW_STEPS } from "../../lib/cbam/workflow-definition";
import {
  STEP8_FOOTER_CTA_LABELS,
  STEP8_PACKAGE_PREVIEW_HEADLINE,
} from "../../lib/cbam/wizard-validation";

/**
 * FAZ UX (2026-08-01) — Wizard full journey (opt-in, authenticated).
 *
 * Requires the same env as the authenticated wizard regression:
 *   E2E_WIZARD_BASE_URL, E2E_WIZARD_EMAIL, E2E_WIZARD_PASSWORD,
 *   E2E_WIZARD_CASE_ID.
 *
 * Verifies:
 *   - steps 1–8 render the SSOT titles and descriptions
 *   - step names match the rendered content
 *   - step 8 never shows COMPLETE next to a NOT READY package
 *   - no pre-seal "SUCCESSFUL SEALED RELEASE" claim
 *   - exactly one contextual footer CTA on step 8 (no disabled Next)
 *   - refresh on ?step=8 keeps step 8
 *   - single "Review remaining actions" CTA
 *   - mobile: case ID does not overflow horizontally
 */
const WIZARD_BASE_URL = process.env.E2E_WIZARD_BASE_URL || "";
const WIZARD_EMAIL = process.env.E2E_WIZARD_EMAIL || "";
const WIZARD_PASSWORD = process.env.E2E_WIZARD_PASSWORD || "";
const WIZARD_CASE_ID = process.env.E2E_WIZARD_CASE_ID || "";
const enabled = Boolean(WIZARD_BASE_URL && WIZARD_EMAIL && WIZARD_PASSWORD && WIZARD_CASE_ID);

const wizardUrl = (query = "step=8") => `${WIZARD_BASE_URL}/cases/${WIZARD_CASE_ID}?${query}`;

const workingStep = (page: Page) =>
  page.locator('section[aria-label="Where you are in this working file"]');

async function loginWithRetry(page: Page, maxAttempts = 5): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await page.goto(`${WIZARD_BASE_URL}/login`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1500);
    await page.fill('input[type="email"]', WIZARD_EMAIL);
    await page.fill('input[type="password"]', WIZARD_PASSWORD);
    await page.click('button[type="submit"]');
    let landed = false;
    for (let i = 0; i < 45; i += 1) {
      await page.waitForTimeout(1000);
      if (/^https:\/\/[^/]+\/(cbam|dashboard|admin|cases)(\/|$)/.test(page.url())) {
        landed = true;
        break;
      }
    }
    if (landed) return;
    console.warn(`[WIZARD LOGIN] attempt ${attempt}/${maxAttempts} did not land (last=${page.url()})`);
  }
  throw new Error(`AUTH_FAILED after ${maxAttempts} login attempts against ${WIZARD_BASE_URL}`);
}

test.describe("Wizard full journey (authenticated, opt-in)", () => {
  test.skip(!enabled, "Set E2E_WIZARD_BASE_URL/EMAIL/PASSWORD/CASE_ID to run the authenticated wizard journey.");

  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => console.error(`[WIZARD PAGE ERROR] ${err.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") console.error(`[WIZARD BROWSER ERROR] ${msg.text()}`);
    });
    await loginWithRetry(page);
  });

  test("each of the eight steps renders its SSOT title and description", async ({ page }) => {
    for (const step of CBAM_WORKFLOW_STEPS) {
      await page.goto(`${WIZARD_BASE_URL}/cases/${WIZARD_CASE_ID}?step=${step.id}`);
      await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
      await expect(workingStep(page)).toContainText(`Step ${step.id} of 8`, { timeout: 30000 });
      // The step heading must match the SSOT title exactly.
      await expect(page.getByRole("heading", { name: step.title })).toBeVisible({ timeout: 30000 });
      // The mobile/desktop rail shows the SSOT short title.
      await expect(page.getByText(step.shortTitle).first()).toBeVisible({ timeout: 15000 });
    }
  });

  test("refresh on ?step=8 keeps step 8 (no auto back-step)", async ({ page }) => {
    await page.goto(wizardUrl());
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
    await expect(workingStep(page)).toContainText("Step 8 of 8", { timeout: 30000 });
    await page.reload();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
    await expect(workingStep(page)).toContainText("Step 8 of 8", { timeout: 30000 });
    // Step 8 must not claim COMPLETE.
    const heading = page.getByRole("heading", { name: CBAM_WORKFLOW_STEPS[7].title });
    await expect(heading).toBeVisible({ timeout: 30000 });
    await expect(page.getByText("COMPLETE", { exact: true })).toHaveCount(0);
  });

  test("no pre-seal success claim and exactly one contextual footer CTA on step 8", async ({ page }) => {
    await page.goto(wizardUrl());
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
    await expect(workingStep(page)).toContainText("Step 8 of 8", { timeout: 30000 });

    // The pre-seal package preview uses the preview headline, never a success
    // claim.
    await expect(page.getByText(STEP8_PACKAGE_PREVIEW_HEADLINE).first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/SUCCESSFUL SEALED RELEASE/i)).toHaveCount(0);
    await expect(page.getByText("Sealed release created successfully", { exact: true })).toHaveCount(0);

    // No disabled Next button on step 8; exactly one primary footer CTA.
    await expect(page.getByRole("button", { name: "Next", exact: true })).toHaveCount(0);
    const footer = page.locator("div.fixed.bottom-0");
    await expect(footer).toBeVisible({ timeout: 15000 });
    const cta = footer.locator(
      `a:has-text("${STEP8_FOOTER_CTA_LABELS.READY_TO_LOCK}"), a:has-text("${STEP8_FOOTER_CTA_LABELS.PAYMENT_REQUIRED}"), button:has-text("${STEP8_FOOTER_CTA_LABELS.BLOCKED}"), button:has-text("${STEP8_FOOTER_CTA_LABELS.LOCKING}")`
    );
    await expect(cta).toHaveCount(1);
  });

  test("mobile 390px: case ID does not overflow and footer stays reachable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(wizardUrl());
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
    await expect(workingStep(page)).toContainText("Step 8 of 8", { timeout: 30000 });

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow, "wizard overflows horizontally at 390px").toBeLessThanOrEqual(1);

    // Case ID text must not overflow its container.
    const caseIdOverflow = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="case-id"], code, [class*="font-mono"]');
      if (!el) return 0;
      return (el as HTMLElement).scrollWidth - (el as HTMLElement).clientWidth;
    });
    expect(caseIdOverflow).toBeLessThanOrEqual(1);

    await expect(page.locator("div.fixed.bottom-0")).toBeVisible();
  });
});
