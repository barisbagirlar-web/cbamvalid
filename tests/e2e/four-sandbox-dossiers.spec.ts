import { test, expect, type Page } from "@playwright/test";
import JSZip from "jszip";
import { FOUR_DOSSIER_KEYS, fourDossierCaseId } from "../../tests/fixtures/four-dossiers";
import { DOSSIER_RELEASE_VERSION } from "../../tests/fixtures/four-dossier-package";

/**
 * FAZ UX (2026-08-01) — Four hosted sandbox dossiers (opt-in).
 *
 * Requires a deployed QA sandbox:
 *   E2E_SANDBOX_BASE_URL, E2E_SANDBOX_EMAIL, E2E_SANDBOX_PASSWORD
 *
 * For each scenario (STEEL_IN, CEMENT_EG, ALU_CN, FERTILISER_TR):
 *   - open the working file and reach step 8
 *   - seal / lock & download (HTTP 200)
 *   - open the sealed release and download PDF / XLSX / ZIP
 *   - verify the ZIP has 26 top-level components and a valid manifest
 *   - produce desktop (1440x1000), tablet (768x1024) and mobile (390x844)
 *     screenshots
 */
const SANDBOX_BASE_URL = process.env.E2E_SANDBOX_BASE_URL || "";
const SANDBOX_EMAIL = process.env.E2E_SANDBOX_EMAIL || "";
const SANDBOX_PASSWORD = process.env.E2E_SANDBOX_PASSWORD || "";
const enabled = Boolean(SANDBOX_BASE_URL && SANDBOX_EMAIL && SANDBOX_PASSWORD);

async function loginWithRetry(page: Page, maxAttempts = 5): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await page.goto(`${SANDBOX_BASE_URL}/login`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1500);
    await page.fill('input[type="email"]', SANDBOX_EMAIL);
    await page.fill('input[type="password"]', SANDBOX_PASSWORD);
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
    console.warn(`[SANDBOX LOGIN] attempt ${attempt}/${maxAttempts} did not land (last=${page.url()})`);
  }
  throw new Error(`AUTH_FAILED after ${maxAttempts} login attempts against ${SANDBOX_BASE_URL}`);
}

test.describe("Four sandbox dossiers (hosted, opt-in)", () => {
  test.skip(!enabled, "Set E2E_SANDBOX_BASE_URL/EMAIL/PASSWORD to run the four hosted sandbox dossiers.");

  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => console.error(`[SANDBOX PAGE ERROR] ${err.message}`));
    await loginWithRetry(page);
  });

  for (const scenario of FOUR_DOSSIER_KEYS) {
    test(`scenario ${scenario}: full browser journey`, async ({ page, request }) => {
      const caseId = fourDossierCaseId(scenario);
      const caseUrl = `${SANDBOX_BASE_URL}/cases/${caseId}?step=8`;

      await page.goto(caseUrl);
      await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
      const workingStep = page.locator('section[aria-label="Where you are in this working file"]');
      await expect(workingStep).toContainText("Step 8 of 8", { timeout: 30000 });

      // Step 8 must not show a success claim or a COMPLETE/NOT READY pair.
      await expect(page.getByText(/SUCCESSFUL SEALED RELEASE/i)).toHaveCount(0);
      await expect(page.getByText("COMPLETE", { exact: true })).toHaveCount(0);

      // Lock & download.
      const lockButton = page.getByRole("button", { name: "Lock & download package" });
      if (await lockButton.count()) {
        await lockButton.first().click();
      } else {
        // Already sealed: the CTA becomes "Open sealed release".
        await expect(page.getByRole("link", { name: "Open sealed release" }).first()).toBeVisible({ timeout: 30000 });
      }
      await page.waitForTimeout(4000);

      // Capture viewports.
      const screenshotBase = `test-results/sandbox-${scenario}`;
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(caseUrl);
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${screenshotBase}-1440x1000.png`, fullPage: true });

      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto(caseUrl);
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${screenshotBase}-768x1024.png`, fullPage: true });

      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(caseUrl);
      await page.waitForTimeout(2000);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow, `${scenario} overflows at 390px`).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `${screenshotBase}-390x844.png`, fullPage: true });

      // Open the sealed release report page.
      const reportId = `dossier-${scenario.toLowerCase()}-2026-annual-v${DOSSIER_RELEASE_VERSION}`;
      const reportResponse = await page.goto(`${SANDBOX_BASE_URL}/cbam/reports/${reportId}`);
      expect(reportResponse?.status() ?? 0).toBe(200);

      // Download the package ZIP and verify 26 top-level components.
      const zipResponse = await request.get(`${SANDBOX_BASE_URL}/api/reports/${reportId}/package.zip`);
      expect(zipResponse.status()).toBe(200);
      const zipBytes = await zipResponse.body();
      const zip = await JSZip.loadAsync(zipBytes);
      const topLevel = new Set(
        Object.keys(zip.files).map((name) => name.split("/")[0]).filter((name) => name.length > 0)
      );
      expect(topLevel.size, `${scenario} ZIP top-level components`).toBe(26);

      // The manifest exists and names a release version.
      const manifest = zip.file(/.*manifest.*\.json/i);
      expect(manifest, `${scenario} manifest`).not.toBeNull();
      const manifestText = await manifest![0].async("string");
      expect(manifestText).toContain(DOSSIER_RELEASE_VERSION.toString());

      // PDF and XLSX downloads resolve.
      for (const ext of ["pdf", "xlsx"]) {
        const response = await request.get(`${SANDBOX_BASE_URL}/api/reports/${reportId}/package.${ext}`);
        expect(response.status(), `${scenario} ${ext} download`).toBe(200);
        expect((await response.body()).byteLength).toBeGreaterThan(1000);
      }
    });
  }
});
