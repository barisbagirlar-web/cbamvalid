import { defineConfig, devices } from "@playwright/test";

const baseURL =
  process.env.PLAYWRIGHT_TEST_BASE_URL ||
  process.env.BASE_URL ||
  "http://localhost:3000";

const isRemoteTarget = !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(
  baseURL,
);

/**
 * CBAMValid Regression Guard — Playwright Config
 * Stack: Next.js + React + Tailwind CSS + Firebase Hosting (Web Frameworks) + Paddle
 * Features: Auth, Case workflow, Credits/Buy, Seal/Export
 *
 * Local default: http://localhost:3000 + webServer
 * Live regression: BASE_URL / PLAYWRIGHT_TEST_BASE_URL=https://cbamvalid.com
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 60000,
  reporter: process.env.CI
    ? [["html", { open: "never" }], ["list"]]
    : "line",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
  ...(isRemoteTarget
    ? {}
    : {
        webServer: {
          command: "npm run dev",
          url: "http://localhost:3000",
          reuseExistingServer: true,
          timeout: 120000,
        },
      }),
});
