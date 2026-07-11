import { test, expect } from "@playwright/test";

test.describe("Authentication E2E Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Pipe browser console and errors to task log for E2E diagnostics
    page.on("console", (msg) => console.log(`[BROWSER LOG]: ${msg.text()}`));
    page.on("pageerror", (err) => console.error(`[BROWSER ERROR]: ${err.message}`));
    
    // Clear cookies and state before each test
    await page.context().clearCookies();
  });

  test("Successful email/password login and redirect", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // Enter values
    await page.fill('input[type="email"]', "e2e@cbamvalid.com");
    await page.fill('input[type="password"]', "password123");

    // Click Login
    await page.click('button[type="submit"]');

    // Should redirect to dashboard and display email
    await page.waitForURL(/\/cbam/, { timeout: 30000 });
    await expect(page).toHaveURL(/\/cbam/);
    await expect(page.locator("body")).toContainText("e2e@cbamvalid.com", { timeout: 30000 });
  });

  test("Redirect to login when visiting dashboard unauthenticated", async ({ page }) => {
    // Visit dashboard directly
    await page.goto("/dashboard");

    // Should redirect to login page with next param
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
  });

  test("Logout clears session and redirects back", async ({ page }) => {
    // 1. Perform genuine login first to establish the real session cookie
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.fill('input[type="email"]', "e2e@cbamvalid.com");
    await page.fill('input[type="password"]', "password123");
    await page.click('button[type="submit"]');

    // Wait for redirect to protected route
    await page.waitForURL(/\/cbam/, { timeout: 30000 });
    await expect(page).toHaveURL(/\/cbam/);

    // 2. Trigger logout
    await page.click('button:has-text("Sign Out")');

    // 3. Should redirect back to login page
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });

    // Verify cookie has been removed
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name.includes("cbam_session"));
    expect(sessionCookie).toBeUndefined();
  });
});
