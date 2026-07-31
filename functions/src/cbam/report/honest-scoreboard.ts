/**
 * WP-08 — Honest Scoreboard (FAZ 7).
 *
 * Four independent indicators replace any single overall 100/100:
 *   1. OPERATOR PREPARATION        (operator-controllable readiness, 0-100)
 *   2. EVIDENCE ASSURANCE          (material evidence support + quality, 0-100)
 *   3. PACKAGE INTEGRITY           (PASS only after manifest + signature + ZIP verify)
 *   4. EXTERNAL VERIFIER COMPLETION (accredited verifier work, completed/total)
 *
 * Rules enforced here:
 *   - NOT_ASSESSED / DATA_GAP rows contribute zero.
 *   - Verifier-reserved fields never add to the operator score.
 *   - "all checks passed" is forbidden while the verifier is pending;
 *     "OPERATOR CHECKS PASSED" is the allowed claim.
 *   - The Premium product name is hidden when premium chapters have gaps.
 */
import type { AuditReadyCase, VerifierReservedFields } from "../schema";
import type { EvidenceSufficiencyRow } from "./premium-dossier-schema";
import { isEvidenceSupportedState } from "../validation/evidence-sufficiency";
import type { ScoreBreakdown } from "../../dossier/40-readiness/score";

export const EXTERNAL_VERIFIER_COMPLETION_TOTAL = 7;

export type PackageIntegrityState = "PASS" | "FAIL" | "NOT_ASSESSED";
export type PremiumChapterContractState = "COMPLETE" | "GAP" | "NOT_ASSESSED";

export interface HonestScoreboard {
  // Legacy three-figure fields (kept for backward-compatible rendering).
  operatorReadiness: number;
  verifierReservedCount: number;
  verifierReservedTotal: number;
  dossierCompleteness: number;
  status: string;
  formula: string;
  // FAZ 7 four indicators.
  operatorPreparationScore: number;
  evidenceAssuranceScore: number;
  packageIntegrity: PackageIntegrityState;
  externalVerifierCompleted: number;
  externalVerifierTotal: number;
  scoreboardClaim: string;
  premiumChapterContract: PremiumChapterContractState;
  premiumNameVisible: boolean;
  productTierLabel: string;
}

interface VerifierCompletionItem {
  readonly id: string;
  readonly label: string;
  readonly complete: boolean;
}

function completionItems(verifierReserved: VerifierReservedFields | undefined): VerifierCompletionItem[] {
  const v = verifierReserved ?? {};
  const nonEmpty = (value: unknown): boolean =>
    value !== undefined && value !== null && value !== "" && (!Array.isArray(value) || value.length > 0);
  return [
    { id: "VERIFIER_IDENTITY", label: "Verifier legal identity and accreditation", complete: nonEmpty(v.verifierLegalName) && nonEmpty(v.accreditationNumber) && nonEmpty(v.nationalAccreditationBody) },
    { id: "VERIFIER_TEAM", label: "Verifier team and independent reviewer", complete: nonEmpty(v.teamLeader) && nonEmpty(v.cbamLeadAuditor) && nonEmpty(v.independentReviewer) },
    { id: "SITE_VISIT", label: "Site visit assignment and dates", complete: Boolean(v.siteVisitType && v.siteVisitType !== "NOT_ASSIGNED") && nonEmpty(v.siteVisitDates) },
    { id: "SCOPE_CRITERIA", label: "Verification objectives, scope and criteria", complete: nonEmpty(v.verificationObjectives) && nonEmpty(v.verificationScope) && nonEmpty(v.criteria) },
    { id: "MATERIALITY", label: "Verifier-confirmed materiality per good", complete: v.materialityLevelPerGood !== undefined && Object.keys(v.materialityLevelPerGood).length > 0 },
    { id: "OPINION", label: "Final opinion and signature", complete: Boolean(v.finalOpinion && v.finalOpinion !== "NO_OPINION") && nonEmpty(v.signature) },
    { id: "CERTIFICATE", label: "Verification certificate reference", complete: nonEmpty(v.certificateReference) },
  ];
}

export function countExternalVerifierCompletion(
  verifierReserved: VerifierReservedFields | undefined
): { completed: number; total: number } {
  const items = completionItems(verifierReserved);
  return {
    completed: items.filter((item) => item.complete).length,
    total: EXTERNAL_VERIFIER_COMPLETION_TOTAL,
  };
}

export function computeEvidenceAssuranceScore(sufficiency: readonly EvidenceSufficiencyRow[]): {
  score: number;
  assessedMaterialRows: number;
  supportedMaterialRows: number;
  qualityBlockedMaterialRows: number;
} {
  let assessedMaterialRows = 0;
  let supportedMaterialRows = 0;
  let qualityBlockedMaterialRows = 0;
  let total = 0;

  for (const row of sufficiency) {
    if (!row.blocksSealing) continue;
    assessedMaterialRows += 1;

    if (!isEvidenceSupportedState(row.state)) {
      // MISSING / PARTIALLY_SUPPORTED / unapproved / hash mismatch / etc. → zero.
      continue;
    }
    supportedMaterialRows += 1;

    let weight = 1;
    if (row.evidenceQualityGrade === "D" || row.evidenceQualityGrade === "E") {
      // Material fields grounded only in D/E evidence cannot achieve a full score.
      weight = 0.5;
      qualityBlockedMaterialRows += 1;
    } else if (row.materialQualityGateBlocked) {
      weight = 0.5;
      qualityBlockedMaterialRows += 1;
    }
    total += weight;
  }

  const score =
    assessedMaterialRows === 0
      ? 0
      : Math.round((1000 * total) / assessedMaterialRows) / 10;

  return {
    score,
    assessedMaterialRows,
    supportedMaterialRows,
    qualityBlockedMaterialRows,
  };
}

function buildClaim(operatorScore: number, verifierCompleted: number, verifierTotal: number): string {
  const verifierPending = verifierCompleted < verifierTotal;
  if (verifierPending) {
    return operatorScore >= 100
      ? "OPERATOR CHECKS PASSED — EXTERNAL VERIFIER PENDING"
      : "OPERATOR CHECKS NOT COMPLETE — EXTERNAL VERIFIER PENDING";
  }
  return operatorScore >= 100
    ? "OPERATOR CHECKS PASSED — EXTERNAL VERIFIER COMPLETE"
    : "OPERATOR CHECKS NOT COMPLETE";
}

export function buildHonestScoreboard(params: {
  caseData: AuditReadyCase;
  dossierScores: ScoreBreakdown;
  sufficiency: readonly EvidenceSufficiencyRow[];
  packageIntegrity: PackageIntegrityState;
  premiumChapterContract: PremiumChapterContractState;
  premiumNameVisible?: boolean;
  productTierLabel: string;
}): HonestScoreboard {
  const { caseData, dossierScores, sufficiency, packageIntegrity, premiumChapterContract, premiumNameVisible, productTierLabel } = params;

  const operatorPreparationScore = dossierScores.operatorReadiness;
  const evidence = computeEvidenceAssuranceScore(sufficiency);
  const verifier = countExternalVerifierCompletion(caseData.verifierReserved);

  return {
    operatorReadiness: dossierScores.operatorReadiness,
    verifierReservedCount: dossierScores.verifierReservedCount,
    verifierReservedTotal: dossierScores.verifierReservedTotal,
    dossierCompleteness: dossierScores.dossierCompleteness,
    status: dossierScores.status,
    formula:
      "OPERATOR PREPARATION = weighted operator-controllable readiness (0-100). " +
      "EVIDENCE ASSURANCE = material evidence rows supported with A-C quality / assessed material rows (0-100; D/E or gated rows weigh 0.5). " +
      "PACKAGE INTEGRITY = PASS only when manifest hashes, KMS signature and ZIP readback verify. " +
      "EXTERNAL VERIFIER COMPLETION = completed verifier-reserved items / total.",
    operatorPreparationScore,
    evidenceAssuranceScore: evidence.score,
    packageIntegrity,
    externalVerifierCompleted: verifier.completed,
    externalVerifierTotal: verifier.total,
    scoreboardClaim: buildClaim(operatorPreparationScore, verifier.completed, verifier.total),
    premiumChapterContract,
    premiumNameVisible: premiumNameVisible ?? premiumChapterContract === "COMPLETE",
    productTierLabel,
  };
}
