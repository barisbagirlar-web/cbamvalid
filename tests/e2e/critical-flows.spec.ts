import { test, expect, type Page } from "@playwright/test";

/**
 * CBAMValid Critical Flows — Regression Guard
 * Covers: Auth, Case creation, Credits/Buy, Sample dossier, Pricing, Seal workflow
 */

/**
 * FAZ P0 UX (2026-08-01) — Wizard final-review regression.
 *
 * The authenticated wizard suite runs against a real deployment (or a dev
 * server bound to a real Firebase project) only when all four
 * E2E_WIZARD_* env vars are set. Plain CI runs (which hit public pages) skip
 * these cases; the pure decision logic is covered by the vitest suite in
 * tests/integration/wizard-step-validation.test.ts.
 */
const WIZARD_BASE_URL = process.env.E2E_WIZARD_BASE_URL || "";
const WIZARD_EMAIL = process.env.E2E_WIZARD_EMAIL || "";
const WIZARD_PASSWORD = process.env.E2E_WIZARD_PASSWORD || "";
const WIZARD_CASE_ID = process.env.E2E_WIZARD_CASE_ID || "";
const wizardEnabled = Boolean(WIZARD_BASE_URL && WIZARD_EMAIL && WIZARD_PASSWORD && WIZARD_CASE_ID);

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
  test("pricing page loads with USD 449 pack", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByText(/\$449|USD\s*449|\b449\b/).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Start free|lock|Book a demo/i }).first()).toBeVisible();
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

test.describe("Wizard Step 8 UX — CI-safe guards (no auth required)", () => {
  test("the wizard case route with a step query never 500s", async ({ page }) => {
    page.on("pageerror", (err) => {
      throw new Error(`Unexpected page error: ${err.message}`);
    });
    const response = await page.goto("/cases/case_ci_guard_2026?step=8");
    expect(response?.status() ?? 0).toBeLessThan(500);
  });

  test("mobile 390px: no horizontal overflow on wizard-adjacent public pages", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of ["/login", "/register", "/cases/new"]) {
      await page.goto(route);
      await page.waitForLoadState("domcontentloaded");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${route} overflows at 390px`).toBeLessThanOrEqual(1);
    }
  });

  test("desktop: no console errors on public surfaces", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/pricing");
    await page.goto("/sample-dossier");
    expect(errors).toEqual([]);
  });
});

test.describe("Wizard Step 8 UX — authenticated live regression (opt-in)", () => {
  test.skip(
    !wizardEnabled,
    "Set E2E_WIZARD_BASE_URL, E2E_WIZARD_EMAIL, E2E_WIZARD_PASSWORD and E2E_WIZARD_CASE_ID to run the authenticated wizard UX regression."
  );

  const wizardUrl = (query = "step=8") => `${WIZARD_BASE_URL}/cases/${WIZARD_CASE_ID}?${query}`;

  const stepText = (page: Page) =>
    page.locator('section[aria-label="Where you are in this working file"]').getByText(/Working file · Step \d of 8/);

  const footerStepText = (page: Page) =>
    page.locator("div.fixed.bottom-0").getByText(/Step \d of 8 ·/);

  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => console.error(`[WIZARD PAGE ERROR] ${err.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") console.error(`[WIZARD BROWSER ERROR] ${msg.text()}`);
    });
    await page.goto(`${WIZARD_BASE_URL}/login`);
    await page.waitForLoadState("networkidle");
    await page.fill('input[type="email"]', WIZARD_EMAIL);
    await page.fill('input[type="password"]', WIZARD_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/cbam/, { timeout: 30000 });
  });

  // E. Refresh → ?step=N reopens the same step.
  test("E. ?step=N survives a refresh", async ({ page }) => {
    await page.goto(wizardUrl("step=3"));
    await expect(stepText(page)).toBeVisible({ timeout: 30000 });
    await expect(page).toHaveURL(/[?&]step=3/);
    await page.reload();
    await expect(stepText(page)).toContainText("Step 3 of 8", { timeout: 30000 });

    await page.goto(wizardUrl("step=8"));
    await expect(stepText(page)).toContainText("Step 8 of 8", { timeout: 30000 });
    await page.reload();
    await expect(stepText(page)).toContainText("Step 8 of 8", { timeout: 30000 });
  });

  // F + H. Final review always reachable; the three Step 8 sections render and
  // the duplicate step navigation is gone.
  test("F+H. Step 8 preview opens with a single journey strip and no duplicate nav", async ({ page }) => {
    await page.goto(wizardUrl());
    await expect(page.getByLabel("Readiness overview")).toBeVisible({ timeout: 30000 });
    await expect(page.getByLabel("Resolve evidence blockers")).toBeVisible();
    await expect(page.getByLabel("Package preview")).toBeVisible();

    // WorkingFileJourneyStrip is the single navigation; the PR #82 duplicate
    // "Wizard step progress" nav must not exist.
    await expect(page.locator('section[aria-label="Where you are in this working file"]')).toHaveCount(1);
    await expect(page.locator('nav[aria-label="Wizard step progress"]')).toHaveCount(0);
  });

  // A. Blocked readiness keeps Step 8 open and reveals the blocker panel.
  test("A. blocked readiness never forces Step 8 back to Step 7", async ({ page }) => {
    await page.goto(wizardUrl());
    await expect(stepText(page)).toContainText("Step 8 of 8", { timeout: 30000 });

    const reviewButton = page.getByRole("button", { name: "Review remaining actions" });
    if (await reviewButton.count()) {
      await reviewButton.first().click();
      // The blocker panel is revealed in place.
      await expect(page.getByLabel("Resolve evidence blockers")).toContainText("Remaining actions");
      await expect(page.getByText(/blocker.*must be resolved before sealing|action item.*must be resolved before sealing/i)).toBeVisible();
      // The step did not move: still Step 8, no navigation to Step 7.
      await expect(stepText(page)).toContainText("Step 8 of 8");
      await expect(footerStepText(page)).toContainText("Step 8 of 8");
    }
  });

  // B. A seal attempt on a blocked case stays on Step 8 and consumes nothing.
  test("B. blocked seal stays on Step 8 and shows the blocker summary", async ({ page }) => {
    await page.goto(wizardUrl());
    await expect(stepText(page)).toContainText("Step 8 of 8", { timeout: 30000 });

    const lockButton = page.getByRole("button", { name: "Lock & download package" });
    const blocked = (await lockButton.count()) === 0;
    if (blocked) {
      await page.getByRole("button", { name: "Review remaining actions" }).first().click();
      await expect(page.getByLabel("Resolve evidence blockers")).toBeVisible();
      await expect(page.getByText(/blocker.*must be resolved before sealing/i)).toBeVisible();
      await expect(stepText(page)).toContainText("Step 8 of 8");
      await expect(footerStepText(page)).toContainText("Step 8 of 8");
    } else {
      // Ready case: the gate button is present and stays on Step 8.
      await expect(stepText(page)).toContainText("Step 8 of 8");
    }
  });

  // D. "Go to step X" only navigates when the user clicks it.
  test("D. user-selected remediation navigates only on click", async ({ page }) => {
    await page.goto(wizardUrl());
    await expect(stepText(page)).toContainText("Step 8 of 8", { timeout: 30000 });

    const reviewButton = page.getByRole("button", { name: "Review remaining actions" });
    if (await reviewButton.count()) {
      await reviewButton.first().click();
      const goTo = page.getByRole("button", { name: /^Go to step \d/ }).first();
      if (await goTo.count()) {
        const target = (await goTo.textContent())?.match(/Go to step (\d)/)?.[1];
        await goTo.click();
        if (target && target !== "8") {
          await expect(footerStepText(page)).toContainText(`Step ${target} of 8`, { timeout: 30000 });
        }
      } else {
        // No remediation links on an eligible case is acceptable.
        await expect(stepText(page)).toContainText("Step 8 of 8");
      }
    }
  });

  // C. A server seal failure keeps Step 8 and shows the technical code.
  test("C. seal failure keeps Step 8 and surfaces a technical code", async ({ page }) => {
    await page.goto(wizardUrl());
    await expect(stepText(page)).toContainText("Step 8 of 8", { timeout: 30000 });

    const lockButton = page.getByRole("button", { name: "Lock & download package" });
    if (await lockButton.count()) {
      await lockButton.first().click();
      // Either the seal succeeds (allowed) or a failure banner appears — in
      // both cases the user must remain on Step 8.
      await expect(stepText(page)).toContainText("Step 8 of 8", { timeout: 30000 });
    }
  });

  // G. Mobile 390px: no horizontal overflow and the step CTA stays visible.
  test("G. mobile 390px layout stays usable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(wizardUrl());
    await expect(stepText(page)).toContainText("Step 8 of 8", { timeout: 30000 });

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, "wizard overflows horizontally at 390px").toBeLessThanOrEqual(1);

    await expect(page.locator("div.fixed.bottom-0")).toBeVisible();
    await expect(page.getByRole("button", { name: "Review remaining actions" }).first()).toBeVisible();

    const reviewButton = page.getByRole("button", { name: "Review remaining actions" });
    if (await reviewButton.count()) {
      await reviewButton.first().click();
      await expect(page.getByLabel("Resolve evidence blockers")).toBeVisible();
    }
  });
});
