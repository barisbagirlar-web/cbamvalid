import type { AuditReadyCase } from "../schema";
import { generateFindingsAndActions } from "../validation/findings-engine";
import { getReportingPeriodAssessment } from "../validation/readiness-score";
import type { PremiumDossierViewModelV2 } from "./premium-dossier-schema";
import { buildPremiumDossierPdf as buildPremiumDossierPdfImpl } from "./premium-dossier-pdf-impl";
import { REQUIRED_TOP_LEVEL_COMPONENTS_V5 } from "./package-components";

/**
 * Source-visible regulatory and package contract for the premium dossier.
 * The implementation lives in a separate renderer module so this boundary
 * remains small, auditable and resistant to accidental legal-source drift.
 */
export const PREMIUM_DOSSIER_REGULATORY_CONTRACT = {
  calculationRegulationId: "IMPL_2025_2547",
  requiredTopLevelComponents: REQUIRED_TOP_LEVEL_COMPONENTS_V5,
  presentationContract: "PREMIUM_ASSURANCE_101_V4",
} as const;

const V5_NON_HASHED_CONTRACT_ENTRIES = 3; // manifest, detached signature, Supporting_Evidence/ directory marker
const V5_SUPPORTING_CONTROL_FILES = 3; // Supporting_Evidence/README.txt + verify/cli.js + verify/README.txt

/**
 * Commercial-acceptance normalization.
 *
 * Sealing may use a tightly-scoped controlled-test assessment clock so the
 * exact TEB232 synthetic annual fixture can exercise a completed-period seal.
 * Customer-facing documents must never rewrite the real package creation
 * clock. Presentation eligibility/findings are therefore recomputed at the
 * immutable generatedAt timestamp while operator preparation remains the
 * canonical V5 operator-readiness score. This keeps three independent truths
 * separate: operator preparation, calendar/submission eligibility, and
 * independent verifier completion.
 */
export function normalizePremiumDossierForCommercialPresentation(
  model: PremiumDossierViewModelV2,
  caseData: AuditReadyCase
): PremiumDossierViewModelV2 {
  const presentationPeriod = getReportingPeriodAssessment(caseData, model.generatedAt);
  const presentationFindings = generateFindingsAndActions(caseData, model.generatedAt).findings;
  const controlledSyntheticAssessment =
    model.reportingPeriodAssessment.definitiveAnnualEligible &&
    !presentationPeriod.definitiveAnnualEligible;

  const canonicalOperatorScore = Number(model.readiness.score);
  const operatorScore = Number.isFinite(canonicalOperatorScore)
    ? Math.max(0, Math.min(100, canonicalOperatorScore))
    : model.honestScoreboard?.operatorPreparationScore;

  const requiredTopLevel = model.manifestSummary.requiredTopLevelComponentCount;
  const projectedHashedEntries =
    requiredTopLevel -
    V5_NON_HASHED_CONTRACT_ENTRIES +
    model.manifestSummary.evidenceFileCount +
    V5_SUPPORTING_CONTROL_FILES;

  const verifierCompleted = model.honestScoreboard?.externalVerifierCompleted ?? 0;
  const verifierTotal = model.honestScoreboard?.externalVerifierTotal ?? 7;

  return {
    ...model,
    reportingPeriodAssessment: presentationPeriod,
    findings: presentationFindings,
    legalBoundary: controlledSyntheticAssessment
      ? `CONTROLLED SYNTHETIC DEMONSTRATION — NOT REAL OPERATOR DATA — NOT FOR REGULATORY RELIANCE. ${model.legalBoundary}`
      : model.legalBoundary,
    manifestSummary: {
      ...model.manifestSummary,
      manifestFileCount: projectedHashedEntries,
    },
    honestScoreboard: model.honestScoreboard
      ? {
          ...model.honestScoreboard,
          operatorReadiness: operatorScore ?? model.honestScoreboard.operatorReadiness,
          operatorPreparationScore:
            operatorScore ?? model.honestScoreboard.operatorPreparationScore,
          scoreboardClaim:
            (operatorScore ?? model.honestScoreboard.operatorPreparationScore ?? 0) >= 100
              ? verifierCompleted < verifierTotal
                ? "OPERATOR CHECKS PASSED — EXTERNAL VERIFIER PENDING"
                : "OPERATOR CHECKS PASSED — EXTERNAL VERIFIER COMPLETE"
              : verifierCompleted < verifierTotal
                ? "OPERATOR CHECKS NOT COMPLETE — EXTERNAL VERIFIER PENDING"
                : "OPERATOR CHECKS NOT COMPLETE",
          productTierLabel: controlledSyntheticAssessment
            ? "Premium Dossier · Controlled Synthetic Demonstration"
            : model.honestScoreboard.productTierLabel,
        }
      : model.honestScoreboard,
  };
}

export function buildPremiumDossierPdf(
  model: PremiumDossierViewModelV2,
  caseData: AuditReadyCase
): Buffer {
  return buildPremiumDossierPdfImpl(
    normalizePremiumDossierForCommercialPresentation(model, caseData),
    caseData
  );
}
