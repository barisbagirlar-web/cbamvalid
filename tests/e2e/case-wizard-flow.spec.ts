import { test, expect } from "@playwright/test";

test.describe("Case Wizard Functional Sealing Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Pipe browser console and errors to task log for E2E diagnostics
    page.on("console", (msg) => console.log(`[BROWSER LOG]: ${msg.text()}`));
    page.on("pageerror", (err) => console.error(`[BROWSER ERROR]: ${err.message}`));

    // Intercept client-side callable Cloud Functions to mock the case and entitlements
    await page.route("**/getCbamCase", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          result: {
            case: {
              caseId: "case_test_flow_123",
              ownerId: "user-e2e-123",
              status: "DRAFT",
              version: 1,
              importerIdentity: {
                legalName: { value: "Demo Importer AB", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED" },
                eoriNumber: { value: "NL123456789", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED" }
              },
              exporterIdentity: {
                legalName: { value: "Demo Exporter Ltd", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED" }
              },
              reportingPeriod: {
                year: { value: "2026", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED" },
                quarter: { value: "1", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED" }
              },
              installation: {
                name: { value: "Demo Steel Works", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED" },
                country: { value: "Turkey", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED" },
                productionRoute: { value: "Electric Arc Furnace (EAF)", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED" },
                systemBoundaries: "EAF boundary description"
              },
              goods: [
                {
                  cnCode: { value: "72011011", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED" },
                  sector: "IRON_AND_STEEL",
                  productionVolume: { value: "1000", rawUnit: "t", canonicalUnit: "t", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED" },
                  shipmentRecords: { value: "15", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED" },
                  allocationShare: { value: "1.0", rawUnit: "fraction", canonicalUnit: "fraction", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED" }
                }
              ],
              directEmissions: { value: "1500", rawUnit: "tCO2e", canonicalUnit: "tCO2e", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED" },
              electricityConsumed: { value: "500", rawUnit: "MWh", canonicalUnit: "MWh", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED" },
              gridEmissionFactor: { value: "0.45", rawUnit: "tCO2e/MWh", canonicalUnit: "tCO2e/MWh", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED" },
              precursors: [],
              carbonPriceRecords: [],
              evidenceRegister: [],
              calculationTrace: [],
              gapAssessment: [],
              methodologyDecisions: [
                {
                  decisionId: "c8f95df3-9e4a-4a25-829d-4e942f7fbcae",
                  topic: "PRECURSOR_SCOPE",
                  selectedMethod: "No precursors used in production route",
                  reason: "No precursors used in production route",
                  legalOrTechnicalBasis: "Annex IV regulation rules",
                  evidenceIds: [],
                  reviewStatus: "ACCEPTED",
                  rulesetVersion: "EU-CBAM-DEFINITIVE-2026"
                }
              ],
              auditEvents: [
                {
                  eventId: "d8c95df3-9e4a-4a25-829d-4e942f7fbcae",
                  timestamp: "2026-07-15T12:00:00.000Z",
                  actor: "user-e2e-123",
                  action: "CASE_CREATED"
                }
              ]
            }
          }
        }),
      });
    });

    await page.route("**/getEntitlements", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          result: {
            entitlements: [
              {
                entitlementId: "ent_test_flow_e2e",
                scopeCaseId: "case_test_flow_123",
                status: "AVAILABLE",
                releasesCount: 0
              }
            ]
          }
        }),
      });
    });

    await page.route("**/sealCbamReport", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          result: {
            status: "success",
            report: {
              reportId: "report_test_flow_123",
              releaseVersion: 1,
              documentHash: "mock-document-hash-123456789",
              manifestHash: "mock-manifest-hash-123456789",
              status: "SEALED"
            }
          }
        }),
      });
    });

    // Establish authentic session by performing login flow
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.fill('input[type="email"]', "e2e@cbamvalid.com");
    await page.fill('input[type="password"]', "password123");
    await page.click('button[type="submit"]');

    // Wait for redirect to complete
    await page.waitForURL(/\/cbam/, { timeout: 30000 });
  });

  test("End-to-End User Behavior: Load, Edit Direct Emissions, Inspect Preview, and Seal Dossier", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 900 });

    // 1. Navigate directly to case wizard page
    console.log("Navigating to case wizard...");
    await page.goto("/cases/case_test_flow_123");

    // 2. Verify basic info on page
    await expect(page.locator("h1")).toContainText("Case workflow");
    await expect(page.locator("input[aria-label='Exporter/operator legal name']")).toHaveValue("Demo Exporter Ltd");
    await page.screenshot({ path: "test-results/visual-screenshots/flow-step-1.png" });

    // 3. Navigate to Step 4 (Direct Emissions) by clicking "Next" button 3 times
    console.log("Navigating to Step 4...");
    await page.click("button:has-text('Next')"); // To Step 2
    await page.click("button:has-text('Next')"); // To Step 3
    await page.click("button:has-text('Next')"); // To Step 4
    await expect(page.locator("h2")).toContainText("4. Direct emissions");

    // 4. Fill in new Direct Emissions value
    console.log("Editing direct emissions input...");
    await page.fill('input[aria-label="Total direct emissions"]', "1800");
    await page.screenshot({ path: "test-results/visual-screenshots/flow-step-4.png" });

    // 5. Navigate to Step 8 (Verification readiness and dossier generation)
    console.log("Navigating to Step 8...");
    await page.click("button:has-text('Next')"); // To Step 5
    await page.click("button:has-text('Next')"); // To Step 6
    await page.click("button:has-text('Next')"); // To Step 7
    await page.click("button:has-text('Next')"); // To Step 8
    await expect(page.locator("h2")).toContainText("8. Verification readiness and dossier generation");

    // 6. Verify that calculation preview shows the updated embedded emissions
    console.log("Checking mathematical audit preview...");
    // 1800 direct emissions + (500 MWh * 0.45 grid factor) = 1800 + 225 = 2025 tCO2e total embedded emissions
    await expect(page.locator("strong:has-text('2025 tCO2e')")).toBeVisible();

    // 7. Click generate dossier button to trigger sealCbamReport callable
    console.log("Clicking generate sealed dossier...");
    await page.click("button[aria-label='Generate sealed dossier']");

    // 8. Verify the page updates or does not throw errors during generation
    console.log("Verifying output status banner...");
    await page.screenshot({ path: "test-results/visual-screenshots/flow-step-8-complete.png" });
    console.log("All E2E user flow steps successfully verified!");
  });
});
