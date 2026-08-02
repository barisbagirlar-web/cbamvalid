import { describe, expect, it } from "vitest";
import { assessCaseReadiness } from "@/lib/cbam/validation/readiness-assessor";
import { assessReadiness } from "../../functions/src/cbam/validation/readiness-score";
import { generateFindingsAndActions } from "../../functions/src/cbam/validation/findings-engine";
import {
  buildFourDossierEvidenceFiles,
  createFourDossierCase,
} from "../fixtures/four-dossiers";

const MID_YEAR_ASSESSMENT = "2026-08-02T13:00:00.000Z";

async function completeSteelCase() {
  const caseData = createFourDossierCase("STEEL_IN");
  await buildFourDossierEvidenceFiles(caseData);
  return caseData;
}

function moveOrganisationReviewToPending<T extends Awaited<ReturnType<typeof completeSteelCase>>>(
  caseData: T
): T {
  caseData.evidenceRegister = caseData.evidenceRegister.map((record) => ({
    ...record,
    reviewStatus: "PENDING" as const,
  }));
  caseData.methodologyDecisions = caseData.methodologyDecisions.map((decision) => ({
    ...decision,
    reviewStatus: "PENDING" as const,
  }));
  return caseData;
}

describe("operator working-file readiness", () => {
  it("allows a conditional operator package while organisation review and the annual period are open", async () => {
    const caseData = moveOrganisationReviewToPending(await completeSteelCase());

    const browserAssessment = assessCaseReadiness(caseData);
    expect(browserAssessment.isEligibleForSealing).toBe(true);
    expect(browserAssessment.isReadyForIndependentVerification).toBe(false);
    expect(browserAssessment.criticalBlockers).toHaveLength(0);
    expect(browserAssessment.verificationGaps.length).toBeGreaterThan(0);

    const serverAssessment = assessReadiness({
      caseData,
      isDraft: false,
      assessmentTimestamp: MID_YEAR_ASSESSMENT,
      sealMode: "PRODUCTION",
    });

    expect(serverAssessment.operatorStatus).not.toBe("NOT_READY");
    expect(serverAssessment.criticalBlockerCount).toBe(0);
    expect(serverAssessment.missingMaterialEvidenceCount).toBe(0);
    expect(serverAssessment.canSeal).toBe(true);
    expect(serverAssessment.recommendedDecision).toBe("DO_NOT_SUBMIT");
    expect(serverAssessment.decisionReasonCodes).toContain("FUTURE_REPORTING_PERIOD_END");
    expect(serverAssessment.decisionReasonCodes).toContain("CONDITIONAL_WORKING_FILE_ONLY");

    const { findings } = generateFindingsAndActions(caseData, MID_YEAR_ASSESSMENT);
    const futurePeriod = findings.find(
      (finding) => finding.findingId === "FND-PERIOD-FUTURE-END-DATE"
    );
    expect(futurePeriod?.blocksSealing).toBe(false);
    expect(futurePeriod?.blocksVerifierHandover).toBe(true);

    const reviewFindings = findings.filter((finding) =>
      finding.title.startsWith("Organisation review pending")
    );
    expect(reviewFindings.length).toBeGreaterThan(0);
    expect(reviewFindings.every((finding) => finding.blocksSealing === false)).toBe(true);
    expect(reviewFindings.every((finding) => finding.blocksVerifierHandover === true)).toBe(true);
  });

  it("keeps rejected evidence fail-closed", async () => {
    const caseData = await completeSteelCase();
    caseData.evidenceRegister[0] = {
      ...caseData.evidenceRegister[0],
      reviewStatus: "REJECTED",
    };

    const browserAssessment = assessCaseReadiness(caseData);
    expect(browserAssessment.isEligibleForSealing).toBe(false);

    const serverAssessment = assessReadiness({
      caseData,
      isDraft: false,
      assessmentTimestamp: MID_YEAR_ASSESSMENT,
      sealMode: "PRODUCTION",
    });
    expect(serverAssessment.canSeal).toBe(false);
    expect(
      serverAssessment.criticalBlockerCount > 0 ||
        serverAssessment.missingMaterialEvidenceCount > 0
    ).toBe(true);
  });

  it("keeps malware-uncleared evidence fail-closed", async () => {
    const caseData = moveOrganisationReviewToPending(await completeSteelCase());
    caseData.evidenceRegister[0] = {
      ...caseData.evidenceRegister[0],
      malwareScanStatus: "PENDING",
    };

    const browserAssessment = assessCaseReadiness(caseData);
    expect(browserAssessment.isEligibleForSealing).toBe(false);

    const serverAssessment = assessReadiness({
      caseData,
      isDraft: false,
      assessmentTimestamp: MID_YEAR_ASSESSMENT,
      sealMode: "PRODUCTION",
    });
    expect(serverAssessment.operatorStatus).toBe("NOT_READY");
    expect(serverAssessment.canSeal).toBe(false);
  });

  it("keeps invalid reporting-period chronology fail-closed", async () => {
    const caseData = moveOrganisationReviewToPending(await completeSteelCase());
    caseData.reportingPeriod.startDate = {
      ...caseData.reportingPeriod.startDate!,
      value: "2026-12-31",
    };
    caseData.reportingPeriod.endDate = {
      ...caseData.reportingPeriod.endDate!,
      value: "2026-01-01",
    };

    const serverAssessment = assessReadiness({
      caseData,
      isDraft: false,
      assessmentTimestamp: MID_YEAR_ASSESSMENT,
      sealMode: "PRODUCTION",
    });
    expect(serverAssessment.operatorStatus).toBe("NOT_READY");
    expect(serverAssessment.canSeal).toBe(false);
    expect(serverAssessment.criticalBlockerCount).toBeGreaterThan(0);
  });
});
