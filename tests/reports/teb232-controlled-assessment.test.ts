import { describe, expect, it } from "vitest";
import {
  assessReadiness,
  getReportingPeriodAssessment,
} from "../../functions/src/cbam/validation/readiness-score";
import {
  CONTROLLED_TEST_ASSESSMENT_TIMESTAMP,
  resolveControlledCaseAssessmentTimestamp,
  resolveSealAssessmentTimestamp,
} from "../../functions/src/cbam/report/controlled-test-assessment";
import { FOUR_DOSSIER_KEYS } from "../fixtures/four-dossiers";
import {
  TEB232_EMAIL,
  TEB232_UID,
  buildTeb232Case,
} from "../../scripts/refresh-teb232-four-complete-cases";

const LIVE_TIMESTAMP_DURING_REPORTING_YEAR = "2026-08-03T18:30:00.000Z";
const TARGET_CASE_ID =
  "case_80aeb60175ce08a0d3acb7bc46617f152f0442f97ee652435280a2f2dff5e7cc";

async function buildExactTargetCase() {
  const prepared = await buildTeb232Case("STEEL_IN");
  const target = structuredClone(prepared.data);
  target.caseId = TARGET_CASE_ID;
  target.ownerId = TEB232_UID;
  target.evidenceRegister = target.evidenceRegister.map((record) => ({
    ...record,
    storagePath: `evidence/${TEB232_UID}/${TARGET_CASE_ID}/${record.evidenceId}/${record.fileName}`,
    reviewEnvironment: "PRODUCTION" as const,
  }));
  target.auditEvents = [
    ...target.auditEvents,
    {
      eventId: "controlled-target-test-event",
      timestamp: LIVE_TIMESTAMP_DURING_REPORTING_YEAR,
      actor: TEB232_UID,
      action: "CONTROLLED_TEST_TARGET_PREPARED",
      metadata: {
        targetPreparationVersion: "TEB232_TARGET_SEAL_READY_V1",
        fixtureKey: "STEEL_IN",
        syntheticTest: true,
        paymentBypass: false,
      },
    },
  ];
  return target;
}

describe("Teb232 controlled assessment clock", () => {
  for (const key of FOUR_DOSSIER_KEYS) {
    it(`${key} passes the V5 production readiness gate at its declared assessment date`, async () => {
      const prepared = await buildTeb232Case(key);
      const readiness = assessReadiness({
        caseData: prepared.data,
        isDraft: false,
        assessmentTimestamp: LIVE_TIMESTAMP_DURING_REPORTING_YEAR,
        sealMode: "PRODUCTION",
      });

      expect(readiness.operatorStatus).not.toBe("NOT_READY");
      expect(readiness.criticalBlockerCount).toBe(0);
      expect(readiness.missingMaterialEvidenceCount).toBe(0);
      expect(readiness.decisionReasonCodes).not.toContain(
        "FUTURE_REPORTING_PERIOD_END"
      );

      const period = getReportingPeriodAssessment(
        prepared.data,
        LIVE_TIMESTAMP_DURING_REPORTING_YEAR,
        "PRODUCTION"
      );
      expect(period.definitiveAnnualEligible).toBe(true);
      expect(period.hardBlockerFindingIds).not.toContain(
        "FND-PERIOD-FUTURE-END-DATE"
      );
    }, 60_000);
  }

  it("uses the controlled date only for the exact verified Teb232 identity", async () => {
    const prepared = await buildTeb232Case("STEEL_IN");
    expect(
      resolveSealAssessmentTimestamp({
        caseData: prepared.data,
        uid: TEB232_UID,
        generatedAt: LIVE_TIMESTAMP_DURING_REPORTING_YEAR,
        auth: {
          uid: TEB232_UID,
          token: { email: TEB232_EMAIL, email_verified: true },
        },
      })
    ).toBe(CONTROLLED_TEST_ASSESSMENT_TIMESTAMP);

    expect(
      resolveSealAssessmentTimestamp({
        caseData: prepared.data,
        uid: TEB232_UID,
        generatedAt: LIVE_TIMESTAMP_DURING_REPORTING_YEAR,
        auth: {
          uid: TEB232_UID,
          token: { email: "other@example.com", email_verified: true },
        },
      })
    ).toBe(LIVE_TIMESTAMP_DURING_REPORTING_YEAR);
  });

  it("recognizes the exact prepared target case for chronology without widening normal production", async () => {
    const target = await buildExactTargetCase();
    expect(
      resolveControlledCaseAssessmentTimestamp(
        target,
        LIVE_TIMESTAMP_DURING_REPORTING_YEAR
      )
    ).toBe(CONTROLLED_TEST_ASSESSMENT_TIMESTAMP);

    const spoofed = structuredClone(target);
    spoofed.auditEvents = spoofed.auditEvents.filter(
      (event) => event.action !== "CONTROLLED_TEST_TARGET_PREPARED"
    );
    expect(
      resolveControlledCaseAssessmentTimestamp(
        spoofed,
        LIVE_TIMESTAMP_DURING_REPORTING_YEAR
      )
    ).toBe(LIVE_TIMESTAMP_DURING_REPORTING_YEAR);
  });

  it("keeps the normal production future-period blocker for non-controlled cases", async () => {
    const prepared = await buildTeb232Case("STEEL_IN");
    const ordinaryCase = structuredClone(prepared.data);
    ordinaryCase.caseId = "case_ordinary_future_period_test";
    ordinaryCase.ownerId = "ordinary-user";

    const period = getReportingPeriodAssessment(
      ordinaryCase,
      LIVE_TIMESTAMP_DURING_REPORTING_YEAR,
      "PRODUCTION"
    );
    expect(period.definitiveAnnualEligible).toBe(false);
    expect(period.hardBlockerFindingIds).toContain(
      "FND-PERIOD-FUTURE-END-DATE"
    );
  });
});
