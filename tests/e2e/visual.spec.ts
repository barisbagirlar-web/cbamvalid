import { test, expect, type Page } from "@playwright/test";

test.describe("Visual Regression E2E Verification", () => {
  let mockJwt: string;

  test.beforeEach(async ({ page }) => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const payload = {
      iss: "https://securetoken.google.com/cbam-desk",
      aud: "cbam-desk",
      sub: "user-e2e-123",
      user_id: "user-e2e-123",
      uid: "user-e2e-123",
      email: "e2e@cbamvalid.com",
      email_verified: true,
      name: "E2E User",
      firebase: {
        identities: {
          email: ["e2e@cbamvalid.com"],
        },
        sign_in_provider: "password",
      },
      auth_time: nowSeconds - 5,
      iat: nowSeconds - 5,
      exp: nowSeconds + 3600,
    };

    const base64Payload = Buffer.from(JSON.stringify(payload))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    mockJwt = `eyJhbGciOiJSUzI1NiIsImtpZCI6IjEifQ.${base64Payload}.c2lnbmF0dXJlU2lnbmF0dXJlU2lnbmF0dXJlU2lnbmF0dXJl`;

    await page.route(/\/api\/auth\/session/, async (route, request) => {
      const method = request.method();
      if (method === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: {
            "set-cookie": `cbam_session_dev=${mockJwt}; Path=/; HttpOnly`,
          },
          body: JSON.stringify({ status: "success" }),
        });
      } else {
        await route.fallback();
      }
    });

    await page.route(/identitytoolkit|securetoken|firestore/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    });
  });

  /** Reject AI-default purple/indigo/neon; allow Institutional Precision forest + seal gold. */
  const assertNoUnapprovedColors = async (page: Page, pageName: string) => {
    const colorViolations = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll("*"));
      const violations: string[] = [];

      function parseRgb(rgbStr: string) {
        if (!rgbStr || rgbStr === "transparent" || rgbStr === "rgba(0, 0, 0, 0)") return null;
        const match = rgbStr.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
        if (!match) return null;
        return {
          r: parseInt(match[1]),
          g: parseInt(match[2]),
          b: parseInt(match[3]),
          a: match[4] ? parseFloat(match[4]) : 1,
        };
      }

      function near(c: { r: number; g: number; b: number }, t: [number, number, number], tol = 28) {
        return Math.abs(c.r - t[0]) <= tol && Math.abs(c.g - t[1]) <= tol && Math.abs(c.b - t[2]) <= tol;
      }

      const allowed = [
        [250, 250, 248],
        [240, 237, 232],
        [255, 255, 255],
        [26, 26, 26],
        [74, 74, 69],
        [138, 138, 130],
        [27, 67, 50],
        [45, 106, 79],
        [20, 83, 45],
        [216, 243, 220],
        [212, 160, 23],
        [232, 197, 71],
        [155, 34, 38],
        [245, 228, 228],
        [187, 107, 0],
        [248, 239, 216],
        [216, 209, 199],
        [168, 162, 158],
        [232, 226, 216],
        [28, 25, 23],
        [231, 229, 228],
        [167, 196, 176],
      ] as [number, number, number][];

      elements.forEach((el) => {
        const style = window.getComputedStyle(el);
        const bg = parseRgb(style.backgroundColor);
        const text = parseRgb(style.color);

        if (
          el.closest("svg") ||
          el.tagName.toLowerCase() === "path" ||
          (el instanceof HTMLElement && el.innerText === "mock")
        ) {
          return;
        }

        [bg, text].forEach((color, idx) => {
          if (!color || color.a === 0) return;
          const { r, g, b } = color;
          const maxVal = Math.max(r, g, b);
          const minVal = Math.min(r, g, b);
          const diff = maxVal - minVal;

          if (diff <= 25) return; // neutrals

          if (allowed.some((t) => near({ r, g, b }, t))) return;

          const isBlueish = b > r + 20 && b > g + 20;
          const isPurpleish = r > g + 20 && b > g + 20;
          const isNeonCyan = g > r + 15 && b > r + 15 && b > 180;
          const isNeonPink = r > 200 && b > 160 && g < 140;

          if (isBlueish || isPurpleish || isNeonCyan || isNeonPink) {
            const type = idx === 0 ? "background" : "text";
            violations.push(
              `<${el.tagName.toLowerCase()}> class="${el.className}" has unapproved ${type} color rgb(${r}, ${g}, ${b})`
            );
          }
        });
      });

      return violations;
    });

    if (colorViolations.length > 0) {
      console.error(`❌ Color violations found on page [${pageName}]:`, colorViolations);
    }
    expect(colorViolations.length).toBe(0);
  };

  test("Landing Page - Desktop & Mobile Viewports", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto("/");
    await page.screenshot({ path: "test-results/visual-screenshots/landing-desktop.png" });
    await assertNoUnapprovedColors(page, "Landing Desktop");

    await page.setViewportSize({ width: 390, height: 800 });
    await page.screenshot({ path: "test-results/visual-screenshots/landing-mobile-390.png" });
    await assertNoUnapprovedColors(page, "Landing Mobile 390");

    await page.setViewportSize({ width: 360, height: 800 });
    await page.screenshot({ path: "test-results/visual-screenshots/landing-mobile-360.png" });
    await assertNoUnapprovedColors(page, "Landing Mobile 360");
  });

  test("Authentication Pages - Login & Register", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });

    await page.goto("/login");
    await page.screenshot({ path: "test-results/visual-screenshots/login-desktop.png" });
    await assertNoUnapprovedColors(page, "Login Desktop");

    await page.setViewportSize({ width: 390, height: 800 });
    await page.screenshot({ path: "test-results/visual-screenshots/login-mobile.png" });
    await assertNoUnapprovedColors(page, "Login Mobile");

    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto("/register");
    await page.screenshot({ path: "test-results/visual-screenshots/register-desktop.png" });
    await assertNoUnapprovedColors(page, "Register Desktop");
  });

  test("Dashboard and Wizard Stages Validation", async ({ page }) => {
    await page.context().addCookies([
      {
        name: "cbam_session_dev",
        value: mockJwt,
        domain: "localhost",
        path: "/",
      },
    ]);

    await page.setViewportSize({ width: 1200, height: 800 });

    await page.goto("/cbam");
    await page.screenshot({ path: "test-results/visual-screenshots/dashboard.png" });
    await assertNoUnapprovedColors(page, "Dashboard");

    await page.goto("/cbam/new");
    await page.screenshot({ path: "test-results/visual-screenshots/wizard-stage-1.png" });
    await assertNoUnapprovedColors(page, "Wizard Stage 1");
  });
});
