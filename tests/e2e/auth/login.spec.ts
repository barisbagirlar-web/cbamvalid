import { test, expect } from "@playwright/test";

test.describe("Authentication E2E Flow", () => {
  let mockJwt: string;

  test.beforeEach(async ({ page }) => {
    // Dynamically generate a valid mock JWT with proper expiration and issued-at timestamps
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
      exp: nowSeconds + 3600, // Valid for 1 hour
    };
    
    // Encode to base64url format
    const base64Payload = Buffer.from(JSON.stringify(payload))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
      
    // Use a valid base64url signature segment (e.g. encoded dummy signature) to avoid client parser crash
    mockJwt = `eyJhbGciOiJSUzI1NiIsImtpZCI6IjEifQ.${base64Payload}.c2lnbmF0dXJlU2lnbmF0dXJlU2lnbmF0dXJlU2lnbmF0dXJl`;

    // Pipe browser console and errors to task log for E2E diagnostics
    page.on("console", (msg) => console.log(`[BROWSER LOG]: ${msg.text()}`));
    page.on("pageerror", (err) => console.error(`[BROWSER ERROR]: ${err.message}`));
    page.on("request", (req) => console.log(`[REQUEST]: ${req.method()} ${req.url()}`));
    page.on("response", (res) => {
      if (res.status() >= 400) {
        console.log(`[RESPONSE ERROR] ${res.status()} for ${res.url()}`);
      }
    });

    // Automatically mock other external network requests to prevent sandbox hangs
    await page.route(
      (url) => !url.href.includes("localhost") && !url.href.includes("127.0.0.1"),
      async (route, request) => {
        const url = request.url();
        if (
          url.includes("verifyPassword") ||
          url.includes("signInWithPassword") ||
          url.includes("lookup") ||
          url.includes("getAccountInfo") ||
          url.includes("getProjectConfig") ||
          url.includes("token")
        ) {
          await route.fallback();
        } else {
          const isJs = url.includes(".js") || url.includes("onload") || url.includes("gapi");
          let jsBody = "/* mock script */";
          if (isJs) {
            try {
              const urlObj = new URL(url);
              const callback = urlObj.searchParams.get("onload");
              if (url.includes("apis.google.com/js/api.js")) {
                console.log(`[MOCKING GAPI SCRIPT]: ${url}`);
                jsBody = `
                  console.log('[BROWSER GAPI MOCK ACTIVE]');
                  window.gapi = {
                    load: function(module, config) {
                      console.log('[BROWSER GAPI LOAD CALLED]', module);
                      if (config && typeof config.callback === 'function') {
                        setTimeout(config.callback, 0);
                      }
                    },
                    iframes: {
                      CROSS_ORIGIN_IFRAMES_FILTER: 'mock-filter',
                      getContext: function() {
                        console.log('[BROWSER GAPI GETCONTEXT CALLED]');
                        return {
                          register: function() {
                            return {
                              reopen: function() {},
                              close: function() {}
                            };
                          }
                        };
                      }
                    }
                  };
                  if (typeof window !== 'undefined' && typeof window['${callback}'] === 'function') {
                    console.log('[BROWSER GAPI TRIGGERING ONLOAD CALLBACK]: ${callback}');
                    window['${callback}']();
                  }
                `;
              } else if (callback) {
                jsBody = `if (typeof window !== 'undefined' && typeof window['${callback}'] === 'function') { window['${callback}'](); }`;
              }
            } catch (e) {
              // fallback if url parsing failed
            }
          }
          await route.fulfill({
            status: 200,
            contentType: isJs ? "application/javascript" : "text/html",
            body: isJs ? jsBody : "<html><body>mock</body></html>",
          });
        }
      }
    );

    const mockSignInResponse = async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "identitytoolkit#VerifyPasswordResponse",
          localId: "user-e2e-123",
          email: "e2e@cbamvalid.com",
          displayName: "E2E User",
          idToken: mockJwt,
          registered: true,
          refreshToken: "mock-refresh-token",
          expiresIn: "3600",
        }),
      });
    };

    // Intercept Google Identity Toolkit (Firebase Auth client SDK requests) via RegExp
    await page.route(/\/identitytoolkit\/v3\/relyingparty\/verifyPassword/, mockSignInResponse);
    await page.route(/\/v1\/accounts:signInWithPassword/, mockSignInResponse);

    // Intercept accounts lookup to return mock profile details via RegExp
    const mockLookupResponse = async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "identitytoolkit#GetAccountInfoResponse",
          users: [
            {
              localId: "user-e2e-123",
              email: "e2e@cbamvalid.com",
              emailVerified: true,
              displayName: "E2E User",
              createdAt: "1782259200000",
              lastLoginAt: "1782259200000"
            }
          ]
        }),
      });
    };
    await page.route(/\/v1\/accounts:lookup/, mockLookupResponse);
    await page.route(/\/identitytoolkit\/v3\/relyingparty\/getAccountInfo/, mockLookupResponse);

    // Intercept project config requests
    await page.route(/\/identitytoolkit\/v3\/relyingparty\/getProjectConfig/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          projectId: "cbam-desk",
          authorizedDomains: ["localhost"]
        }),
      });
    });

    // Intercept token refresh requests to return mock ID token via RegExp
    await page.route(/\/securetoken\.googleapis\.com\/v1\/token/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          expires_in: "3600",
          token_type: "Bearer",
          refresh_token: "mock-refresh-token",
          id_token: mockJwt,
          access_token: mockJwt, // Crucial: mapped to accessToken in client SDK
          user_id: "user-e2e-123",
          project_id: "cbam-desk",
        }),
      });
    });

    // Intercept session generation requests via RegExp
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
      } else if (method === "DELETE") {
        await route.fulfill({
          status: 204,
          headers: {
            "set-cookie": "cbam_session_dev=; Path=/; Max-Age=0; HttpOnly",
          },
        });
      } else {
        // GET check
        const headers = request.headers();
        const hasCookie = headers["cookie"]?.includes("cbam_session_dev=");
        if (hasCookie) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              authenticated: true,
              user: {
                uid: "user-e2e-123",
                email: "e2e@cbamvalid.com",
                name: "E2E User",
              },
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ authenticated: false, user: null }),
          });
        }
      }
    });

    // Mock Firestore user profiles collection fetch via RegExp
    await page.route(/\/firestore/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          fields: {
            email: { stringValue: "e2e@cbamvalid.com" },
            tokens: { integerValue: "5" },
            role: { stringValue: "user" },
          },
        }),
      });
    });
  });

  test("Successful email/password login and redirect", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

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
    // Unset any cookies for this request
    await page.context().clearCookies();
    
    // Visit dashboard directly
    await page.goto("/dashboard");

    // Should redirect to login page with next param
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
  });

  test("Logout clears session and redirects back", async ({ page }) => {
    // Set active session cookie
    await page.context().addCookies([
      {
        name: "cbam_session_dev",
        value: mockJwt,
        domain: "localhost",
        path: "/",
      },
    ]);

    await page.goto("/cbam");
    await expect(page).toHaveURL(/\/cbam/);

    // Trigger logout
    await page.click('button:has-text("Sign Out")');

    // Should redirect back to login page
    await expect(page).toHaveURL(/\/login/);

    // Verify cookie has been removed
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name === "cbam_session_dev");
    expect(sessionCookie).toBeUndefined();
  });
});
