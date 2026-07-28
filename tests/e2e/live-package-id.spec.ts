import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const tokenPath = path.join(__dirname, ".auth/package-id-custom-token.txt");

test.describe("Live Package ID operator UI", () => {
  test.skip(!fs.existsSync(tokenPath), "Run scripts/bootstrap-live-package-id-session.ts first");

  test("reports and cbam lists show Package ID like Y7654, not truncated report_ hashes", async ({
    page,
  }) => {
    const customToken = fs.readFileSync(tokenPath, "utf8").trim();
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!;
    const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!;
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "cbam-desk";
    const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID!;

    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");

    // Establish Firebase client auth (AuthProvider listens to onAuthStateChanged),
    // which also posts a fresh __session cookie for SSR-protected routes.
    await page.addScriptTag({
      url: "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js",
    });
    await page.addScriptTag({
      url: "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js",
    });

    await page.evaluate(
      async ({ customToken, apiKey, authDomain, projectId, appId }) => {
        // @ts-expect-error firebase compat globals
        const firebase = window.firebase;
        if (!firebase.apps.length) {
          firebase.initializeApp({ apiKey, authDomain, projectId, appId });
        }
        const cred = await firebase.auth().signInWithCustomToken(customToken);
        const idToken = await cred.user.getIdToken(true);
        const res = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        if (!res.ok) throw new Error(`SESSION_${res.status}`);
        (window as unknown as { __sessionEstablished?: boolean }).__sessionEstablished = true;
      },
      { customToken, apiKey, authDomain, projectId, appId }
    );

    await page.goto("/reports");
    await expect(page.getByText(/Loading Reports/i)).toBeHidden({ timeout: 45000 });
    const packageId = page.locator("text=/Package ID:\\s*[A-Z][0-9]{4}/");
    await expect(packageId.first()).toBeVisible({ timeout: 30000 });
    await expect(page.locator("text=/report_[0-9a-f]{8}…/")).toHaveCount(0);

    const shown = (await packageId.first().innerText()).match(/[A-Z][0-9]{4}/)?.[0];
    expect(shown).toMatch(/^[A-Z][0-9]{4}$/);

    await page.goto("/cbam");
    await expect(page.locator("text=/Package ID:\\s*[A-Z][0-9]{4}/").first()).toBeVisible({
      timeout: 45000,
    });
    await expect(page.locator("text=/report_[0-9a-f]{8}…/")).toHaveCount(0);
  });
});
