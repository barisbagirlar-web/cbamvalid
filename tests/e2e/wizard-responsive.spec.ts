import { test, expect, type Page } from "@playwright/test";

/**
 * FAZ UX (2026-08-01) — Wizard responsive behavior.
 *
 * CI-safe part (no auth): public surfaces must not overflow at 390/768/1024/1440.
 * Opt-in part (E2E_WIZARD_*): the working file itself at the same four widths:
 *   - mobile header shows "Step X of 8" with a single progress bar
 *   - "View all steps" opens the vertical drawer
 *   - no eight-card step grid
 *   - desktop 280px sticky step rail at >= 1024px, hidden below
 */
const WIZARD_BASE_URL = process.env.E2E_WIZARD_BASE_URL || "";
const WIZARD_EMAIL = process.env.E2E_WIZARD_EMAIL || "";
const WIZARD_PASSWORD = process.env.E2E_WIZARD_PASSWORD || "";
const WIZARD_CASE_ID = process.env.E2E_WIZARD_CASE_ID || "";
const enabled = Boolean(WIZARD_BASE_URL && WIZARD_EMAIL && WIZARD_PASSWORD && WIZARD_CASE_ID);

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

test.describe("Responsive — CI-safe public surfaces", () => {
  for (const width of [390, 768, 1024, 1440]) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      for (const route of ["/", "/login", "/pricing"]) {
        await page.goto(route);
        await page.waitForLoadState("domcontentloaded");
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        );
        expect(overflow, `${route} overflows at ${width}px`).toBeLessThanOrEqual(1);
      }
    });
  }
});

test.describe("Responsive — authenticated wizard (opt-in)", () => {
  test.skip(!enabled, "Set E2E_WIZARD_BASE_URL/EMAIL/PASSWORD/CASE_ID to run the wizard responsive checks.");

  const wizardUrl = (step = 8) => `${WIZARD_BASE_URL}/cases/${WIZARD_CASE_ID}?step=${step}`;

  test.beforeEach(async ({ page }) => {
    await loginWithRetry(page);
  });

  test("mobile 390px: header, progress bar and vertical step drawer", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(wizardUrl());
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });

    const workingStep = page.locator('section[aria-label="Where you are in this working file"]');
    await expect(workingStep).toContainText("Step 8 of 8", { timeout: 30000 });

    // The eight-card row is gone; the mobile header shows the current step.
    await expect(page.locator("[data-testid='wizard-step-cards']")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /View all steps/i })).toBeVisible();

    // Open the vertical drawer.
    await page.getByRole("button", { name: /View all steps/i }).click();
    await expect(page.locator("[data-testid='mobile-step-drawer']")).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow, "wizard overflows at 390px").toBeLessThanOrEqual(1);
  });

  test("tablet 768px: no overflow and single navigation", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(wizardUrl());
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow, "wizard overflows at 768px").toBeLessThanOrEqual(1);
    await expect(page.locator('nav[aria-label="Wizard step progress"]')).toHaveCount(0);
  });

  test("desktop 1440px: sticky step rail present and no duplicate navigation", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(wizardUrl());
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });

    const stepRail = page.locator("[data-testid='desktop-step-rail']");
    await expect(stepRail).toBeVisible({ timeout: 30000 });
    // Single navigation: the journey strip is informational and there is no
    // second wizard-nav rail.
    await expect(page.locator("[data-testid='desktop-step-rail']")).toHaveCount(1);
    await expect(page.locator('nav[aria-label="Wizard step progress"]')).toHaveCount(0);
  });
});
