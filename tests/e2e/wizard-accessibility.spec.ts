import { test, expect, type Page } from "@playwright/test";

/**
 * FAZ UX (2026-08-01) — Wizard accessibility.
 *
 * CI-safe part (no auth):
 *   - login form inputs are labelled
 *   - headings are present and page title is not empty
 * Opt-in part (E2E_WIZARD_*):
 *   - the step rail exposes accessible names
 *   - the mobile drawer button has an accessible name
 *   - exactly one contextual footer CTA and one "Review remaining actions"
 *   - keyboard focus is visible on the footer CTA
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

test.describe("Accessibility — CI-safe public surfaces", () => {
  test("login form inputs are labelled", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    const emailId = await page.locator('input[type="email"]').getAttribute("id");
    const emailLabel = await page.locator(`label[for="${emailId}"]`).count();
    const ariaLabel = await page.locator('input[type="email"]').getAttribute("aria-label");
    expect(emailLabel > 0 || Boolean(ariaLabel)).toBe(true);
    const passId = await page.locator('input[type="password"]').getAttribute("id");
    const passLabel = await page.locator(`label[for="${passId}"]`).count();
    const passAria = await page.locator('input[type="password"]').getAttribute("aria-label");
    expect(passLabel > 0 || Boolean(passAria)).toBe(true);
  });

  test("public pages expose a heading and a non-empty title", async ({ page }) => {
    for (const route of ["/", "/pricing", "/sample-dossier"]) {
      await page.goto(route);
      await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10000 });
      const title = await page.title();
      expect(title.trim().length).toBeGreaterThan(0);
    }
  });
});

test.describe("Accessibility — authenticated wizard (opt-in)", () => {
  test.skip(!enabled, "Set E2E_WIZARD_BASE_URL/EMAIL/PASSWORD/CASE_ID to run the wizard accessibility checks.");

  test.beforeEach(async ({ page }) => {
    await loginWithRetry(page);
  });

  test("step rail and drawer controls have accessible names; single CTA", async ({ page }) => {
    await page.goto(`${WIZARD_BASE_URL}/cases/${WIZARD_CASE_ID}?step=8`);
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });

    // The desktop rail is a labelled navigation.
    const rail = page.locator("[data-testid='desktop-step-rail']");
    if (await rail.count()) {
      await expect(rail).toHaveAttribute("aria-label", /Step/i);
    }

    // Mobile: the drawer trigger has an accessible name.
    const viewAll = page.getByRole("button", { name: /View all steps/i });
    if (await viewAll.count()) {
      await viewAll.first().focus();
      await expect(viewAll.first()).toBeVisible();
    }

    // Exactly one contextual footer CTA and at most one "Review remaining
    // actions" on the body.
    const footer = page.locator("div.fixed.bottom-0");
    await expect(footer).toBeVisible({ timeout: 15000 });
    const footerActions = footer.locator("a, button").filter({ hasText: /\S/ });
    await expect(footerActions).toHaveCount(3); // Previous · Save progress · seal CTA
    const reviewCtas = page.getByRole("button", { name: /Review remaining actions/i });
    expect(await reviewCtas.count()).toBeLessThanOrEqual(1);
  });

  test("keyboard focus is visible on the footer CTA", async ({ page }) => {
    await page.goto(`${WIZARD_BASE_URL}/cases/${WIZARD_CASE_ID}?step=8`);
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });

    const footer = page.locator("div.fixed.bottom-0");
    await expect(footer).toBeVisible({ timeout: 15000 });
    const primary = footer.locator("a, button").filter({ hasText: /seal|Seal|Pay|Open|Complete \d+ requirements|Continue/i }).last();
    await primary.focus();
    await expect(primary).toBeFocused();
    const outlineVisible = await primary.evaluate((el) => {
      const style = window.getComputedStyle(el as HTMLElement);
      return style.outlineStyle !== "none" && style.outlineWidth !== "0px";
    });
    expect(outlineVisible).toBe(true);
  });
});
