/**
 * WP-08 — honest three-figure scoring model.
 * Never print a single number alone as "readiness".
 */
export interface ScoreBreakdown {
  readonly operatorReadiness: number;
  readonly verifierReservedCount: number;
  readonly verifierReservedTotal: number;
  readonly dossierCompleteness: number;
  readonly status: "NOT_READY" | "NOT_APPLICABLE_CBAM" | "READY_WITH_GAPS" | "OPERATOR_PREPARATION_COMPLETE";
  readonly formula: string;
  readonly findings: readonly string[];
}

export interface ScoreInputs {
  readonly originInScope: boolean;
  readonly dimensionScores: ReadonlyArray<{
    readonly id: string;
    readonly weight: number;
    readonly score01: number;
    readonly chapterNonEmpty: boolean;
    readonly operatorControllable: boolean;
  }>;
  readonly signOffsComplete: boolean;
  readonly verifierReservedComplete: number;
  readonly verifierReservedTotal: number;
  readonly hardBlockers: readonly string[];
}

/**
 * OPERATOR READINESS = weighted score over operator-controllable requirements.
 * VERIFIER-RESERVED = count remaining for accredited verifier.
 * DOSSIER COMPLETENESS = (operator-complete + verifier-complete) / total.
 */
export function computeHonestScores(input: ScoreInputs): ScoreBreakdown {
  const findings: string[] = [];

  if (!input.originInScope) {
    return {
      operatorReadiness: 0,
      verifierReservedCount: input.verifierReservedTotal,
      verifierReservedTotal: input.verifierReservedTotal,
      dossierCompleteness: 0,
      status: "NOT_APPLICABLE_CBAM",
      formula:
        "OPERATOR_READINESS=0; DOSSIER_COMPLETENESS=0; origin out of CBAM scope (hard gate)",
      findings: ["ORIGIN_OUT_OF_SCOPE"],
    };
  }

  if (input.hardBlockers.length > 0) {
    findings.push(...input.hardBlockers);
  }

  let opWeight = 0;
  let opAccum = 0;
  for (const d of input.dimensionScores) {
    if (!d.operatorControllable) continue;
    const effective = d.chapterNonEmpty ? d.score01 : 0;
    if (!d.chapterNonEmpty) findings.push(`DIMENSION_CHAPTER_EMPTY:${d.id}`);
    opWeight += d.weight;
    opAccum += d.weight * effective;
  }

  let operatorReadiness =
    opWeight > 0 ? Math.round((1000 * opAccum) / opWeight) / 10 : 0;

  if (!input.signOffsComplete) {
    findings.push("SIGNOFF_MISSING");
    operatorReadiness = Math.min(operatorReadiness, 90);
  }

  const verifierDone = input.verifierReservedComplete;
  const verifierTotal = Math.max(input.verifierReservedTotal, 0);
  const verifierReservedCount = Math.max(verifierTotal - verifierDone, 0);

  // Completeness: blend operator readiness (as 0..1) with verifier completion ratio
  const operatorPart = operatorReadiness / 100;
  const verifierPart = verifierTotal === 0 ? 1 : verifierDone / verifierTotal;
  const dossierCompleteness =
    Math.round(1000 * ((operatorPart + verifierPart) / 2)) / 10;

  let status: ScoreBreakdown["status"] = "NOT_READY";
  if (input.hardBlockers.length === 0 && operatorReadiness >= 100 && verifierReservedCount === 0) {
    status = "OPERATOR_PREPARATION_COMPLETE";
  } else if (operatorReadiness >= 70 && input.hardBlockers.length === 0) {
    status = "READY_WITH_GAPS";
  }

  // Pre-audit completeness always < 100 if verifier items remain
  const cappedCompleteness =
    verifierReservedCount > 0
      ? Math.min(dossierCompleteness, 99.9)
      : dossierCompleteness;

  return {
    operatorReadiness,
    verifierReservedCount,
    verifierReservedTotal: verifierTotal,
    dossierCompleteness: cappedCompleteness,
    status:
      input.hardBlockers.length > 0 || !input.signOffsComplete || operatorReadiness < 100
        ? status === "OPERATOR_PREPARATION_COMPLETE"
          ? "NOT_READY"
          : status
        : status,
    formula:
      "OPERATOR_READINESS = Σ(weight_i × score_i) / Σ(weight_i) over operator-controllable dimensions (empty chapter → score 0); " +
      "cap 90 if SIGNOFF_MISSING. " +
      "DOSSIER_COMPLETENESS = mean(OPERATOR_READINESS/100, verifier_done/verifier_total); " +
      "always < 100 while verifier-reserved items remain.",
    findings,
  };
}
