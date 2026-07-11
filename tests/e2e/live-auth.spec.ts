import { test, expect } from "@playwright/test";

test("Live Production Authentication Acceptance Test", async ({ page, context }) => {
  const email = `test-acceptance-${Date.now()}@cbamvalid.com`;
  const password = "Password123!";

  // 1. Navigate to live registration page
  console.log("Navigating to live registration...");
  await page.goto("https://cbamvalid-prod--cbam-desk.europe-west4.hosted.app/register");

  // 2. Fill out registration
  console.log("Filling out registration...");
  await page.fill('input[type="email"]', email);
  
  // Enter password and confirm password inputs
  const passwordInputs = page.locator('input[type="password"]');
  await passwordInputs.nth(0).fill(password);
  await passwordInputs.nth(1).fill(password);

  // 3. Click submit
  console.log("Clicking submit...");
  await page.click('button[type="submit"]');

  // 4. Verify redirected to /cbam
  console.log("Waiting for redirect...");
  await page.waitForURL("**/cbam", { timeout: 25000 });
  expect(page.url()).toContain("/cbam");

  // 5. Verify cookie __Host-cbam_session is present
  console.log("Checking cookies...");
  const cookies = await context.cookies();
  const sessionCookie = cookies.find(c => c.name === "__Host-cbam_session");
  expect(sessionCookie).toBeDefined();

  // 6. Reload page and verify session is persistent
  console.log("Refreshing page...");
  await page.reload();
  await page.waitForURL("**/cbam");
  expect(page.url()).toContain("/cbam");

  // 7. Click Sign Out
  console.log("Signing out...");
  await page.click('button:has-text("Sign Out")');

  // 8. Verify redirected to login
  console.log("Waiting for login redirect...");
  await page.waitForURL("**/login");
  expect(page.url()).toContain("/login");

  // 9. Verify cookie is cleared
  const cookiesAfterLogout = await context.cookies();
  const sessionCookieAfter = cookiesAfterLogout.find(c => c.name === "__Host-cbam_session");
  expect(sessionCookieAfter).toBeUndefined();

  // 10. Attempt to access protected dashboard directly -> should redirect back to /login
  console.log("Attempting direct access to /cbam...");
  await page.goto("https://cbamvalid-prod--cbam-desk.europe-west4.hosted.app/cbam");
  await page.waitForURL("**/login*");
  expect(page.url()).toContain("/login");
  console.log("All live checks PASSED!");
});
