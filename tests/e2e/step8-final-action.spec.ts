import { test, expect, type Page } from "@playwright/test";
import { STEP8_FINAL_TITLE } from "../../lib/cbam/wizard-validation";

/**
 * FAZ UX (2026-08-06) — Step 8 final-action hierarchy (opt-in, authenticated).
 *
 * Requires the same env as the other wizard journeys:
 *   E2E_WIZARD_BASE_URL, E2E_WIZARD_EMAIL, E2E_WIZARD_PASSWORD, E2E_WIZARD_CASE_ID
 *
 * Verifies on a real step 8 screen:
 *   - heading is "Final review and seal"
 *   - exactly one "Save progress" control and zero "Save draft" labels
 *   - the header exposes a save indicator, never a save button
 *   - exactly one primary footer seal CTA with a state-appropriate label
 *   - BLOCKED: clicking the CTA reveals the blockers, stays on step 8, and
 *     neither pays nor seals
 *   - no footer overlap at 1440x900 and 390x844
 *   - screenshots for every observed state
 */
const WIZARD_BASE_URL = process.env.E2E_WIZARD_BASE_URL || "";
const WIZARD_EMAIL = process.env.E2E_WIZARD_EMAIL || "";
const WIZARD_PASSWORD = process.env.E2E_WIZARD_PASSWORD || "";
const WIZARD_CASE_ID = process.env.E2E_WIZARD_CASE_ID || "";
const enabled = Boolean(WIZARD_BASE_URL && WIZARD_EMAIL && WIZARD_PASSWORD && WIZARD_CASE_ID);

const wizardUrl = (query = "step=8") => `${WIZARD_BASE_URL}/cases/${WIZARD_CASE_ID}?${query}`;

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
  }
  throw new Error("AUTH_FAILED");
}

const STATE_LABELS: Array<{ matcher: RegExp; state: string }> = [
  { matcher: /Complete \d+ requirements to seal/, state: "BLOCKED" },
  { matcher: /^Pay .* and seal package$/, state: "PAYMENT_REQUIRED" },
  { matcher: /^Seal package and create downloads$/, state: "READY_TO_LOCK" },
  { matcher: /^Sealing package/, state: "LOCKING" },
  { matcher: /^Open sealed package$/, state: "LOCKED" },
  { matcher: /^Retry sealing package$/, state: "LOCK_FAILED" },
];

async function observedState(page: Page): Promise<string> {
  const footer = page.locator("div.fixed.bottom-0");
  const ctaText = (await footer.locator('[data-testid="step8-primary-action"]').textContent())?.trim() || "";
  const found = STATE_LABELS.find(({ matcher }) => matcher.test(ctaText));
  if (!found) throw new Error(`Unrecognized Step 8 CTA label: "${ctaText}"`);
  return found.state;
}

test.describe("Step 8 final-action hierarchy (authenticated, opt-in)", () => {
  test.skip(!enabled, "Set E2E_WIZARD_BASE_URL/EMAIL/PASSWORD/CASE_ID to run the step 8 hierarchy journey.");

  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => console.error(`[WIZARD PAGE ERROR] ${err.message}`));
    await loginWithRetry(page);
  });

  test("heading, single save control, header indicator and one seal CTA", async ({ page }) => {
    await page.goto(wizardUrl());
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });

    // Step 8 heading and seal-mandate copy.
    await expect(page.getByRole("heading", { name: STEP8_FINAL_TITLE })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText("Complete the remaining requirements, then pay once, seal the working file and create the verifier downloads.")).toBeVisible();

    // Exactly one manual save control and zero "Save draft" labels.
    await expect(page.getByRole("button", { name: /^Save progress$/ })).toHaveCount(1);
    await expect(page.getByText(/Save draft/i)).toHaveCount(0);
    await expect(page.getByText("Saves the editable working file. No payment or sealing occurs.")).toBeVisible();

    // The header holds a save indicator, never a save button.
    const header = page.locator("header");
    await expect(header.getByRole("button")).toHaveCount(0);
    await expect(header.getByText(/Unsaved changes|Saving|Saved|Save failed/)).toBeVisible();

    // Exactly one primary footer seal CTA.
    const footer = page.locator("div.fixed.bottom-0");
    await expect(footer.locator('[data-testid="step8-primary-action"]')).toHaveCount(1);

    const state = await observedState(page);
    const outDir = "artifacts/step8-final-action";
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: `${outDir}/step8-${state}-e2e.png`, fullPage: true });
    await footer.screenshot({ path: `${outDir}/step8-${state}-e2e-footer.png` });
  });

  test("BLOCKED CTA reveals blockers, stays on step 8, never pays and never seals", async ({ page }) => {
    await page.goto(wizardUrl());
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });

    const blockedCta = page.locator('div.fixed.bottom-0 button[data-testid="step8-primary-action"]').filter({
      hasText: /Complete \d+ requirements to seal/,
    });
    if (!(await blockedCta.count())) {
      test.skip(true, "The wizard case is not in BLOCKED state.");
      return;
    }
    const before = page.url();
    await blockedCta.click();
    // The blockers panel opens in place (no navigation, no payment route).
    await expect(page.getByLabel("Remaining actions")).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveURL(before);
    // Focus moved to the first blocker action.
    await expect(page.getByTestId("first-blocker-action")).toBeFocused();
    // Neither payment nor sealing was invoked.
    await expect(page).not.toHaveURL(/\/credits\/buy/);
    await expect(page.getByText(/Locked package created successfully/)).toHaveCount(0);
  });

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    test(`no footer overlap at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(wizardUrl());
      await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
      await expect(page.getByRole("heading", { name: STEP8_FINAL_TITLE })).toBeVisible({ timeout: 30000 });

      const gap = await page.evaluate(() => {
        const footer = document.querySelector("div.fixed.bottom-0");
        if (!footer) return -1;
        window.scrollTo(0, document.body.scrollHeight);
        const lastSection = document.querySelector('main section[aria-label="Emissions summary"]')
          || [...document.querySelectorAll("main section")].at(-1);
        if (!lastSection) return -1;
        const lastRect = lastSection.getBoundingClientRect();
        const footerRect = footer.getBoundingClientRect();
        return footerRect.top - lastRect.bottom;
      });
      expect(gap, `footer overlaps content at ${viewport.width}x${viewport.height}`).toBeGreaterThanOrEqual(0);
    });
  }
});
