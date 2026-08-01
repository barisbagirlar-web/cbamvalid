/**
 * FAZ UX (2026-08-01) — Live wizard auth bootstrap.
 *
 * Logs in against the live deployment and persists the browser session
 * (HttpOnly __session cookie + Firebase auth localStorage) to a Playwright
 * storageState file. The identitytoolkit call is occasionally flaky, so the
 * login is retried. Success requires BOTH a workspace URL and the __session
 * cookie (the earlier version matched "cases" inside the URL-encoded
 * /login?next=... and saved an unauthenticated state).
 *
 * Usage:
 *   E2E_WIZARD_BASE_URL=... E2E_WIZARD_EMAIL=... E2E_WIZARD_PASSWORD=... \
 *     npx tsx scripts/e2e-wizard-auth.ts [output-path]
 */
import { chromium } from "playwright-core";

const BASE_URL = process.env.E2E_WIZARD_BASE_URL || "https://cbam-desk.web.app";
const EMAIL = process.env.E2E_WIZARD_EMAIL || "";
const PASSWORD = process.env.E2E_WIZARD_PASSWORD || "";
const OUT_PATH = process.argv[2] || ".playwright/wizard-auth.json";

if (!EMAIL || !PASSWORD) {
  console.error("E2E_WIZARD_EMAIL and E2E_WIZARD_PASSWORD are required.");
  process.exit(1);
}

async function attemptLogin(): Promise<boolean> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');

    let ok = false;
    for (let i = 0; i < 40; i += 1) {
      await page.waitForTimeout(1000);
      const url = page.url();
      const cookies = await context.cookies();
      const hasSession = cookies.some((c) => c.name === "__session");
      // Workspace routes are /cbam, /dashboard, /admin, /cases/*. The login
      // URL's "next=" parameter is URL-encoded, so a literal /cases/ match
      // cannot come from /login.
      const onWorkspace = /^https:\/\/[^/]+\/(cbam|dashboard|admin|cases)(\/|$)/.test(url);
      if (onWorkspace && hasSession) {
        ok = true;
        break;
      }
      if (!onWorkspace && hasSession) {
        // Still on /login with a cookie means the session was created but the
        // replace navigation is pending; keep waiting.
      }
    }

    if (!ok) {
      const errorCard = await page.locator(".border.border-border.bg-accent-soft").textContent().catch(() => "");
      console.error(`Login did not reach a workspace route with a session cookie. Last URL=${page.url()} ErrorCard=${(errorCard || "").trim().slice(0, 200)}`);
      return false;
    }

    const cookies = await context.cookies();
    const session = cookies.find((c) => c.name === "__session");
    console.log(`Authenticated as ${EMAIL}. __session cookie len=${session?.value.length ?? 0}. Saving ${OUT_PATH}`);
    await context.storageState({ path: OUT_PATH });
    return true;
  } finally {
    await browser.close();
  }
}

async function main() {
  const maxAttempts = 8;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    console.log(`Auth attempt ${attempt}/${maxAttempts} against ${BASE_URL} ...`);
    if (await attemptLogin()) return;
    if (attempt < maxAttempts) await new Promise((resolve) => setTimeout(resolve, 4000));
  }
  console.error("AUTH_BOOTSTRAP_FAILED after all attempts.");
  process.exit(1);
}

void main();
