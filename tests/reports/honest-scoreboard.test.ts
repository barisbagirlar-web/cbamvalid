import { describe, it, expect } from "vitest";
import type { AuditReadyCase } from "../../functions/src/cbam/schema";
import type { EvidenceSufficiencyRow } from "../../functions/src/cbam/report/premium-dossier-schema";
import type { ScoreBreakdown } from "../../functions/src/dossier/40-readiness/score";
import {
  buildHonestScoreboard,
  countExternalVerifierCompletion,
  computeEvidenceAssuranceScore,
} from "../../functions/src/cbam/report/honest-scoreboard";
import { createVerifierGradeCase } from "../fixtures/verifier-grade-case";

function score(overrides: Partial<ScoreBreakdown> = {}): ScoreBreakdown {
  return {
    operatorReadiness: 100,
    verifierReservedCount: 7,
    verifierReservedTotal: 7,
    dossierCompleteness: 50,
    status: "OPERATOR_PREPARATION_COMPLETE",
    formula: "test formula",
    findings: [],
    ...overrides,
  };
}

function materialRow(
  overrides: Partial<EvidenceSufficiencyRow> = {}
): EvidenceSufficiencyRow {
  return {
    requirementId: "REQ-A",
    inputPath: "directEmissions",
    evidenceIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
    state: "SUPPORTED_BY_EVIDENCE",
    coverageNumerator: "1",
    coverageDenominator: "1",
    blocksOperatorReadiness: true,
    blocksSealing: true,
    isMaterial: true,
    reasonCodes: [],
    evidencePeriodStart: "2026-01-01",
    evidencePeriodEnd: "2026-12-31",
    coverageDays: 365,
    requiredPeriodStart: "2026-01-01",
    requiredPeriodEnd: "2026-12-31",
    coveragePercent: "100.00",
    supportBasis: "SUPPORTED_BY_EVIDENCE",
    evidenceQualityGrade: "A",
    ...overrides,
  };
}

describe("FAZ 7 — honest scoreboard", () => {
  it("exposes the four independent indicators", () => {
    const caseData = createVerifierGradeCase() as AuditReadyCase;
    const sb = buildHonestScoreboard({
      caseData,
      dossierScores: score(),
      sufficiency: [materialRow()],
      packageIntegrity: "PASS",
      premiumChapterContract: "COMPLETE",
      productTierLabel: "Premium Dossier",
    });

    expect(sb.operatorPreparationScore).toBe(100);
    expect(sb.evidenceAssuranceScore).toBe(100);
    expect(sb.packageIntegrity).toBe("PASS");
    expect(sb.externalVerifierTotal).toBe(7);
    expect(sb.externalVerifierCompleted).toBe(0);
    expect(sb.scoreboardClaim).toContain("OPERATOR CHECKS PASSED");
    expect(sb.scoreboardClaim).toContain("EXTERNAL VERIFIER PENDING");
    expect(sb.scoreboardClaim).not.toContain("all checks passed");
  });

  it("scores evidence assurance with NOT_ASSESSED / DATA_GAP rows contributing zero", () => {
    const sufficiency = [
      materialRow({ state: "MISSING", evidenceIds: [], supportBasis: null, evidenceQualityGrade: null }),
      materialRow({ state: "PARTIALLY_SUPPORTED", supportBasis: null, evidenceQualityGrade: "C" }),
    ];
    const result = computeEvidenceAssuranceScore(sufficiency);
    expect(result.assessedMaterialRows).toBe(2);
    expect(result.supportedMaterialRows).toBe(0);
    expect(result.score).toBe(0); // only the two supported states contribute; everything else is zero
  });

  it("halves the contribution of material rows grounded only in D/E evidence", () => {
    const sufficiency = [
      materialRow({ requirementId: "REQ-A", evidenceQualityGrade: "A" }),
      materialRow({ requirementId: "REQ-B", evidenceQualityGrade: "E" }),
    ];
    const result = computeEvidenceAssuranceScore(sufficiency);
    expect(result.score).toBe(75);
    expect(result.qualityBlockedMaterialRows).toBe(1);
  });

  it("never lets verifier-reserved fields inflate the operator score", () => {
    const caseData = createVerifierGradeCase() as AuditReadyCase;
    const withVerifier = {
      ...caseData,
      verifierReserved: {
        verifierLegalName: "ACME Verifier",
        accreditationNumber: "AC-123",
        finalOpinion: "FAIR_PRESENTATION",
        signature: "signed",
      },
    } as AuditReadyCase;

    const sb = buildHonestScoreboard({
      caseData: withVerifier,
      dossierScores: score({ operatorReadiness: 88 }),
      sufficiency: [],
      packageIntegrity: "PASS",
      premiumChapterContract: "COMPLETE",
      productTierLabel: "Premium Dossier",
    });

    expect(sb.operatorPreparationScore).toBe(88);
    expect(sb.externalVerifierCompleted).toBeGreaterThan(0);
  });

  it("hides the Premium name when premium chapters have gaps", () => {
    const caseData = createVerifierGradeCase() as AuditReadyCase;
    const withGap = buildHonestScoreboard({
      caseData,
      dossierScores: score(),
      sufficiency: [],
      packageIntegrity: "PASS",
      premiumChapterContract: "GAP",
      productTierLabel: "CBAMValid Pack (2 premium chapter gap(s))",
    });
    expect(withGap.productTierLabel).not.toContain("Premium");
    expect(withGap.premiumChapterContract).toBe("GAP");
  });

  it("counts seven external verifier completion items", () => {
    expect(countExternalVerifierCompletion(undefined)).toEqual({ completed: 0, total: 7 });

    const almostComplete = {
      verifierLegalName: "ACME Verifier",
      accreditationNumber: "AC-123",
      nationalAccreditationBody: "NAB",
      teamLeader: "T Lead",
      cbamLeadAuditor: "Lead",
      independentReviewer: "IR",
      siteVisitType: "PHYSICAL",
      siteVisitDates: "2026-08-01",
      verificationObjectives: "obj",
      verificationScope: "scope",
      criteria: "criteria",
      materialityLevelPerGood: { "1": 0.05 },
      finalOpinion: "FAIR_PRESENTATION",
      signature: "signed",
      certificateReference: "CERT-2026-001",
    } as const;
    expect(countExternalVerifierCompletion(almostComplete).completed).toBe(7);

    const missingCertificate = { ...almostComplete, certificateReference: undefined };
    expect(countExternalVerifierCompletion(missingCertificate).completed).toBe(6);
  });

  it("forbids an all-clear claim while the verifier is pending", () => {
    const caseData = createVerifierGradeCase() as AuditReadyCase;
    const sb = buildHonestScoreboard({
      caseData,
      dossierScores: score({ operatorReadiness: 100 }),
      sufficiency: [materialRow()],
      packageIntegrity: "PASS",
      premiumChapterContract: "COMPLETE",
      productTierLabel: "Premium Dossier",
    });
    expect(sb.scoreboardClaim).not.toMatch(/all checks passed/i);
    expect(sb.scoreboardClaim).toContain("OPERATOR CHECKS PASSED");
  });
});
