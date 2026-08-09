import { describe, expect, it } from "vitest";
import { assessCaseReadiness } from "../../functions/src/cbam/validation/readiness-assessor";
import {
  CONTROLLED_TEST_ASSESSMENT_TIMESTAMP,
  resolveSealAssessmentTimestamp,
} from "../../functions/src/cbam/report/controlled-test-assessment";
import {
  TEB232_ALL_DRAFTS_PREPARATION_VERSION,
  buildTeb232DraftScenario,
  hasTeb232DraftPreparedMarker,
  inferTeb232FixtureKey,
} from "../../lib/cbam/qa/teb232-draft-scenario";

const TEB232_UID = "r3Sv0U5YqEcLLylbw5ndwK1Zg652";
const SCREENSHOT_CASE_ID =
  "case_a8b49873da0838fea94ac7138560be5e55dff5324257ea5c9fc823b0fdfacc3d";
const GENERATED_AT = "2026-08-09T18:46:00.000Z";

describe("Teb232 all-draft seal-ready contract", () => {
  it("upgrades the screenshot draft to a complete seal-ready controlled steel scenario", async () => {
    const prepared = await buildTeb232DraftScenario({
      caseId: SCREENSHOT_CASE_ID,
      fixtureKey: "STEEL_IN",
      version: 2,
      timestamp: GENERATED_AT,
    });

    expect(prepared.caseId).toBe(SCREENSHOT_CASE_ID);
    expect(prepared.fixtureKey).toBe("STEEL_IN");
    expect(prepared.data.caseId).toBe(SCREENSHOT_CASE_ID);
    expect(prepared.data.ownerId).toBe(TEB232_UID);
    expect(prepared.data.status).toBe("DRAFT");
    expect(hasTeb232DraftPreparedMarker(prepared.data)).toBe(true);

    const marker = prepared.data.auditEvents.find(
      (event) => event.action === "CONTROLLED_TEST_DRAFT_PREPARED"
    );
    expect(marker?.metadata).toMatchObject({
      preparationVersion: TEB232_ALL_DRAFTS_PREPARATION_VERSION,
      fixtureKey: "STEEL_IN",
      syntheticTest: true,
      paymentBypass: false,
    });

    const readiness = assessCaseReadiness(prepared.data);
    expect(readiness.isEligibleForSealing).toBe(true);
    expect(readiness.completenessPercentage).toBe(100);
    expect(readiness.criticalBlockers).toHaveLength(0);
    expect(readiness.allGaps).toHaveLength(0);

    expect(prepared.data.evidenceRegister.length).toBeGreaterThanOrEqual(9);
    for (const evidence of prepared.data.evidenceRegister) {
      expect(evidence.storagePath).toMatch(
        new RegExp(`^evidence/${TEB232_UID}/${SCREENSHOT_CASE_ID}/`)
      );
      expect(evidence.reviewEnvironment).toBe("PRODUCTION");
      expect(evidence.reviewStatus).toBe("APPROVED");
      expect(evidence.supportStatus).toBe("SUPPORTED");
      expect(evidence.malwareScanStatus).toBe("CLEAN");
      expect(evidence.sizeBytes).toBeGreaterThan(0);
      expect(evidence.fileHash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it.each([
    ["IRON_AND_STEEL", "STEEL_IN"],
    ["CEMENT", "CEMENT_EG"],
    ["ALUMINIUM", "ALU_CN"],
    ["FERTILISERS", "FERTILISER_TR"],
  ] as const)("maps %s drafts to %s", (sector, fixtureKey) => {
    expect(
      inferTeb232FixtureKey({ goods: [{ sector }] })
    ).toBe(fixtureKey);
  });

  it("uses the controlled assessment clock only for the exact verified Teb232 identity and server-prepared draft", async () => {
    const prepared = await buildTeb232DraftScenario({
      caseId: SCREENSHOT_CASE_ID,
      fixtureKey: "STEEL_IN",
      timestamp: GENERATED_AT,
    });

    const accepted = resolveSealAssessmentTimestamp({
      caseData: prepared.data,
      uid: TEB232_UID,
      auth: {
        token: {
          email: "teb232@gmail.com",
          email_verified: true,
        },
      },
      generatedAt: GENERATED_AT,
    });
    expect(accepted).toBe(CONTROLLED_TEST_ASSESSMENT_TIMESTAMP);

    const refused = resolveSealAssessmentTimestamp({
      caseData: prepared.data,
      uid: TEB232_UID,
      auth: {
        token: {
          email: "other@example.com",
          email_verified: true,
        },
      },
      generatedAt: GENERATED_AT,
    });
    expect(refused).toBe(GENERATED_AT);
  });
});
