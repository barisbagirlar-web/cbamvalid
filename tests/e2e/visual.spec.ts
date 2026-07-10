import { test, expect } from "@playwright/test";

test.describe("Visual Regression E2E Verification", () => {
  let mockJwt: string;

  test.beforeEach(async ({ page }) => {
    // Generate valid mock JWT
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
          email: ["e2e@cbamvalid.com"]
        },
        sign_in_provider: "password"
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

    // Intercept session generation requests
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

    // Mock other Firebase API endpoints to prevent network errors
    await page.route(/identitytoolkit|securetoken|firestore/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    });
  });

  // DOM validation scanner helper
  const assertNoUnapprovedColors = async (page: any, pageName: string) => {
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

      elements.forEach((el: any) => {
        const style = window.getComputedStyle(el);
        const bg = parseRgb(style.backgroundColor);
        const text = parseRgb(style.color);

        // Ignore Google Brand buttons or standard placeholders
        if (el.closest("svg") || el.tagName.toLowerCase() === "path" || el.innerText === "mock") {
          return;
        }

        [bg, text].forEach((color, idx) => {
          if (!color || color.a === 0) return;
          const { r, g, b } = color;
          const maxVal = Math.max(r, g, b);
          const minVal = Math.min(r, g, b);
          const diff = maxVal - minVal;

          // Only analyze colored elements (skip greyscales/whites/blacks)
          if (diff > 25) {
            // Check green/emerald/lime/teal/cyan
            const isGreenish = g > r + 20 && g > b + 20;
            const isTealCyan = g > r + 15 && b > r + 15;
            
            // Check blue/indigo/violet/purple/pink
            const isBlueish = b > r + 20 && b > g + 20;
            const isPurpleish = r > g + 20 && b > g + 20;

            // Check yellow/amber
            const isYellowish = r > 160 && g > 160 && b < 100;

            if (isGreenish || isTealCyan || isBlueish || isPurpleish || isYellowish) {
              const type = idx === 0 ? "background" : "text";
              violations.push(
                `<${el.tagName.toLowerCase()}> class="${el.className}" has unapproved ${type} color rgb(${r}, ${g}, ${b})`
              );
            }
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
    // 1. Desktop Viewport
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto("/");
    await page.screenshot({ path: "test-results/visual-screenshots/landing-desktop.png" });
    await assertNoUnapprovedColors(page, "Landing Desktop");

    // 2. Mobile Viewport (390px)
    await page.setViewportSize({ width: 390, height: 800 });
    await page.screenshot({ path: "test-results/visual-screenshots/landing-mobile-390.png" });
    await assertNoUnapprovedColors(page, "Landing Mobile 390");

    // 3. Mobile Viewport (360px)
    await page.setViewportSize({ width: 360, height: 800 });
    await page.screenshot({ path: "test-results/visual-screenshots/landing-mobile-360.png" });
    await assertNoUnapprovedColors(page, "Landing Mobile 360");
  });

  test("Authentication Pages - Login & Register", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });

    // 1. Login Page
    await page.goto("/login");
    await page.screenshot({ path: "test-results/visual-screenshots/login-desktop.png" });
    await assertNoUnapprovedColors(page, "Login Desktop");

    // 2. Login Mobile (390px)
    await page.setViewportSize({ width: 390, height: 800 });
    await page.screenshot({ path: "test-results/visual-screenshots/login-mobile.png" });
    await assertNoUnapprovedColors(page, "Login Mobile");

    // 3. Register Page
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto("/register");
    await page.screenshot({ path: "test-results/visual-screenshots/register-desktop.png" });
    await assertNoUnapprovedColors(page, "Register Desktop");
  });

  test("Dashboard and Wizard Stages Validation", async ({ page }) => {
    // Authenticate
    await page.context().addCookies([
      {
        name: "cbam_session_dev",
        value: mockJwt,
        domain: "localhost",
        path: "/",
      },
    ]);

    await page.setViewportSize({ width: 1200, height: 800 });

    // 1. Dashboard Page
    await page.goto("/cbam");
    await page.screenshot({ path: "test-results/visual-screenshots/dashboard.png" });
    await assertNoUnapprovedColors(page, "Dashboard");

    // 2. Wizard Page Stage 1
    await page.goto("/cbam/new");
    await page.screenshot({ path: "test-results/visual-screenshots/wizard-stage-1.png" });
    await assertNoUnapprovedColors(page, "Wizard Stage 1");
  });
});
