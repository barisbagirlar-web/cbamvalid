import { test, expect } from "@playwright/test";

/**
 * CBAMValid Critical Flows — Regression Guard
 * Covers: Auth, Case creation, Credits/Buy, Sample dossier, Pricing, Seal workflow
 */

test.describe("Authentication", () => {
  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("register page renders", async ({ page }) => {
    await page.goto("/register");
    await expect(page.locator("h1, h2").first()).toBeVisible();
    await expect(page.locator("form")).toBeVisible();
  });
});

test.describe("Case Workflow", () => {
  test("new case page loads and form visible", async ({ page }) => {
    await page.goto("/cases/new");
    await expect(page.locator("h1, h2").first()).toBeVisible();
    await expect(page.locator('form, [data-testid="case-form"]').first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("sample dossier page loads", async ({ page }) => {
    await page.goto("/sample-dossier");
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Pricing & Credits", () => {
  test("pricing page loads with USD 249 pack", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByText(/\$249|USD\s*249|\b249\b/).first()).toBeVisible();
    await expect(
      page.locator('button:has-text("Buy"), a:has-text("Buy"), button:has-text("Get"), a:has-text("Get")').first(),
    ).toBeVisible();
  });

  test("credits/buy page loads", async ({ page }) => {
    await page.goto("/credits/buy");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });
});

test.describe("Checkout API Integrity", () => {
  test("pricing API returns valid structure", async ({ request }) => {
    // No /api/health in this repo — assert public pricing contract instead.
    // Real payment is not executed; endpoint structure only.
    const response = await request.get("/api/pricing");
    expect(response.status()).toBeLessThan(500);
    if (response.ok()) {
      const body = await response.json();
      expect(body).toMatchObject({
        displayPrice: expect.any(String),
        currency: expect.any(String),
      });
    }
  });
});

test.describe("SEO & Meta", () => {
  test("homepage title and description valid", async ({ page }) => {
    await page.goto("/");
    const title = await page.title();
    expect(title).not.toBe("");
    expect(title).not.toMatch(/placeholder|untitled/i);
    const desc = page.locator('meta[name="description"]');
    await expect(desc).toHaveAttribute("content", /.+/);
  });

  test("sitemap.xml valid", async ({ page }) => {
    const response = await page.goto("/sitemap.xml");
    expect(response?.status()).toBe(200);
  });
});

test.describe("Visual Regression", () => {
  // Snapshots are OS-specific (darwin vs linux). Keep local; skip in CI until linux baselines exist.
  test.skip(!!process.env.CI, "Visual baselines are platform-specific");

  test("homepage screenshot", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveScreenshot("cbamvalid-homepage.png", { maxDiffPixels: 100 });
  });

  test("pricing page screenshot", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page).toHaveScreenshot("cbamvalid-pricing.png", { maxDiffPixels: 100 });
  });
});
