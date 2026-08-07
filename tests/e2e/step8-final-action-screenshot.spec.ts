import { test, expect, type Page } from "@playwright/test";
import { createVerifierGradeCase } from "../fixtures/verifier-grade-case";
import { AuditReadyCaseSchema, type AuditReadyCase } from "../../lib/cbam/schema";
import { STEP8_FINAL_TITLE } from "../../lib/cbam/wizard-validation";

/**
 * FAZ UX (2026-08-06) — local Step 8 screenshot harness (opt-in).
 *
 * Runs against the local dev server (Playwright starts `npm run dev` on
 * localhost:3000). It emulates Firebase Auth (identitytoolkit/securetoken)
 * and the hosted Functions callables so the real CaseWizardClient can be
 * exercised in-browser without a deployed sandbox.
 *
 * Requires: E2E_LOCAL_SCREENSHOT=1 (deliberately opt-in — this is a local
 * visual utility, not part of the hosted-sandbox regression suite).
 *
 * Produces, for BLOCKED / PAYMENT_REQUIRED / READY_TO_LOCK / LOCKED:
 *   artifacts/step8-final-action/step8-<state>-full.png
 *   artifacts/step8-final-action/step8-<state>-footer.png
 *
 * LOCKED is derived from a real completed release (the entitlement bound to
 * the case reports releasesCount > 0), so the harness feeds a release-bearing
 * entitlement to exercise the "Open sealed package" state.
 */
const ENABLED = process.env.E2E_LOCAL_SCREENSHOT === "1";
const BASE_URL = "http://localhost:3000";
const MOCK_UID = "user-e2e-123";
const MOCK_CASE_ID = "case_verifier_grade_fixture";
const OUT_DIR = "artifacts/step8-final-action";

function buildMockJwt(): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload = {
    iss: "https://securetoken.google.com/cbam-desk",
    aud: "cbam-desk",
    sub: MOCK_UID,
    user_id: MOCK_UID,
    uid: MOCK_UID,
    email: "e2e@cbamvalid.com",
    email_verified: true,
    name: "E2E User",
    firebase: {
      identities: { email: ["e2e@cbamvalid.com"] },
      sign_in_provider: "password",
    },
    auth_time: nowSeconds - 5,
    iat: nowSeconds - 5,
    exp: nowSeconds + 3600,
  };
  const base64Url = (value: object) =>
    Buffer.from(JSON.stringify(value))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  return `eyJhbGciOiJSUzI1NiIsImtpZCI6IjEifQ.${base64Url(payload)}.c2lnbmF0dXJlU2lnbmF0dXJlU2lnbmF0dXJlU2lnbmF0dXJl`;
}

/** Strips required data/evidence so readiness reports open critical blockers. */
function blankedBlockedCase(): AuditReadyCase {
  type MutableRecord = Record<string, unknown>;
  const raw = createVerifierGradeCase() as unknown as MutableRecord;
  const value = structuredClone(raw);
  const datum = (owner: MutableRecord | undefined, field: string) => {
    if (owner?.[field] && typeof owner[field] === "object") {
      (owner[field] as MutableRecord).value = "";
    }
  };
  datum(value.importerIdentity as MutableRecord, "legalName");
  datum(value.importerIdentity as MutableRecord, "eoriNumber");
  datum(value.exporterIdentity as MutableRecord, "legalName");
  datum(value.reportingPeriod as MutableRecord, "year");
  datum(value.installation as MutableRecord, "name");
  value.directEmissions = { ...(value.directEmissions as MutableRecord), value: "" };
  value.electricityConsumed = { ...(value.electricityConsumed as MutableRecord), value: "" };
  value.gridEmissionFactor = { ...(value.gridEmissionFactor as MutableRecord), value: "" };
  value.evidenceRegister = [];
  return AuditReadyCaseSchema.parse(value);
}

type Scenario = {
  state: "BLOCKED" | "PAYMENT_REQUIRED" | "READY_TO_LOCK" | "LOCKED";
  caseData: AuditReadyCase;
  entitlements: Array<Record<string, unknown>>;
};

const SCENARIOS: Scenario[] = [
  {
    state: "BLOCKED",
    caseData: blankedBlockedCase(),
    entitlements: [],
  },
  {
    state: "PAYMENT_REQUIRED",
    caseData: createVerifierGradeCase(),
    entitlements: [],
  },
  {
    state: "READY_TO_LOCK",
    caseData: createVerifierGradeCase(),
    entitlements: [
      {
        entitlementId: "ent_e2e_ready",
        caseId: MOCK_CASE_ID,
        scopeCaseId: MOCK_CASE_ID,
        status: "AVAILABLE",
        releasesCount: 0,
        releasesRemaining: 1,
      },
    ],
  },
  {
    state: "LOCKED",
    caseData: createVerifierGradeCase(),
    entitlements: [
      {
        entitlementId: "ent_e2e_locked",
        caseId: MOCK_CASE_ID,
        scopeCaseId: MOCK_CASE_ID,
        status: "ACTIVE",
        releasesCount: 1,
        releasesRemaining: 0,
      },
    ],
  },
];

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "*",
  "access-control-max-age": "600",
};

async function installMocks(page: Page, scenario: Scenario): Promise<void> {
  const jwt = buildMockJwt();

  const corsFulfill = async (
    route: Parameters<Parameters<Page["route"]>[1]>[0],
    body: unknown,
    status = 200
  ) => {
    await route.fulfill({
      status,
      contentType: "application/json",
      headers: CORS_HEADERS,
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  };

  await page.route(/identitytoolkit\.googleapis\.com\//, async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    const url = route.request().url();
    if (url.includes("signInWithPassword")) {
      await corsFulfill(route, {
        idToken: jwt,
        email: "e2e@cbamvalid.com",
        refreshToken: "mock-refresh-token",
        expiresIn: "3600",
        localId: MOCK_UID,
        registered: true,
      });
      return;
    }
    // accounts:lookup (getAccountInfo) and any other identitytoolkit call
    // expect a `users` array; returning {} broke the Firebase SDK's parse.
    await corsFulfill(route, {
      users: [
        {
          localId: MOCK_UID,
          email: "e2e@cbamvalid.com",
          emailVerified: true,
          displayName: "E2E User",
          disabled: false,
          createdAt: String(Date.now()),
        },
      ],
    });
  });

  await page.route(/securetoken\.googleapis\.com\//, async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    await corsFulfill(route, {
      access_token: jwt,
      expires_in: "3600",
      id_token: jwt,
      project_id: "cbam-desk",
      refresh_token: "mock-refresh-token",
      token_type: "Bearer",
      user_id: MOCK_UID,
    });
  });

  await page.route("**/api/auth/session", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          // The edge proxy.ts gates workspace routes on the presence of
          // `__session`; dev SSR readers accept the same cookie name.
          "set-cookie": [
            `__session=${jwt}; Path=/; HttpOnly`,
            `cbam_session_dev=${jwt}; Path=/; HttpOnly`,
          ].join(", "),
        },
        body: JSON.stringify({ status: "success" }),
      });
      return;
    }
    await route.continue();
  });

  const callable = async (route: Parameters<Parameters<Page["route"]>[1]>[0], body: unknown) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    await corsFulfill(route, body);
  };
  await page.route(/cloudfunctions\.net\/getCbamCase/, (route) =>
    callable(route, { result: { case: scenario.caseData } })
  );
  await page.route(/cloudfunctions\.net\/getEntitlements/, (route) =>
    callable(route, { result: { entitlements: scenario.entitlements } })
  );
  await page.route(/cloudfunctions\.net\/getAccountOverview/, (route) =>
    callable(route, {
      result: { credits: { availableCredits: 0 }, profile: { organisationId: "", role: "" } },
    })
  );
  await page.route(/cloudfunctions\.net\/getCbamCases/, (route) =>
    callable(route, { result: { cases: [] } })
  );

  // Seed the workspace cache so the wizard renders even if a callable mock
  // ever misses; the server-side read stays authoritative for the screenshot.
  await page.addInitScript(({ uid, caseId, value }) => {
    const envelope = {
      version: 3,
      ownerUid: uid,
      cachedAt: Date.now(),
      value,
    };
    window.localStorage.setItem(`cbam_case_cache_${uid}_${caseId}`, JSON.stringify(envelope));
  }, { uid: MOCK_UID, caseId: MOCK_CASE_ID, value: scenario.caseData });
}

async function loginAndOpenStep8(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState("domcontentloaded");
  await page.fill('input[type="email"]', "e2e@cbamvalid.com");
  await page.fill('input[type="password"]', "password123");
  await page.click('button[type="submit"]');
  // Sign-in replaces the location to /cbam (normal-user route).
  await page.waitForURL(/\/cbam(\/|$)/, { timeout: 30000 });
  await page.goto(`${BASE_URL}/cases/${MOCK_CASE_ID}?step=8`);
  await page.waitForLoadState("domcontentloaded");
}

test.describe("Step 8 local screenshot harness", () => {
  test.skip(!ENABLED, "Set E2E_LOCAL_SCREENSHOT=1 to render local Step 8 screenshots.");

  for (const scenario of SCENARIOS) {
    test(`capture ${scenario.state}`, async ({ page }) => {
      page.on("pageerror", (err) => console.error(`[SHOT PAGE ERROR] ${err.message}`));
      await installMocks(page, scenario);
      await loginAndOpenStep8(page);

      await expect(page.getByRole("heading", { name: STEP8_FINAL_TITLE })).toBeVisible({
        timeout: 30000,
      });

      const footer = page.locator("div.fixed.bottom-0");
      await expect(footer.locator('[data-testid="step8-primary-action"]')).toBeVisible();
      const label = (await footer
        .locator('[data-testid="step8-primary-action"]')
        .textContent())?.trim();

      if (scenario.state === "BLOCKED") {
        expect(label).toMatch(/^Complete \d+ requirements to seal$/);
      }
      if (scenario.state === "PAYMENT_REQUIRED") {
        expect(label).toMatch(/^Pay .* and seal package$/);
      }
      if (scenario.state === "READY_TO_LOCK") {
        expect(label).toBe("Seal package and create downloads");
      }
      if (scenario.state === "LOCKED") {
        expect(label).toBe("Open sealed package");
      }

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.screenshot({ path: `${OUT_DIR}/step8-${scenario.state}-full.png`, fullPage: true });
      await footer.screenshot({ path: `${OUT_DIR}/step8-${scenario.state}-footer.png` });
    });
  }
});
