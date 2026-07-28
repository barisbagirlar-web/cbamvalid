/**
 * 40-readiness rule modules — one export per requirement family (WP B.3).
 */
export type ReadinessRuleResult =
  | { readonly pass: true; readonly code: string }
  | { readonly pass: false; readonly code: string; readonly detail: string };

export function ruleOriginInScope(inScope: boolean): ReadinessRuleResult {
  return inScope
    ? { pass: true, code: "ORIGIN_IN_SCOPE" }
    : { pass: false, code: "ORIGIN_OUT_OF_SCOPE", detail: "Installation country is outside CBAM scope." };
}

export function ruleSignOffsComplete(complete: boolean): ReadinessRuleResult {
  return complete
    ? { pass: true, code: "SIGNOFF_COMPLETE" }
    : { pass: false, code: "SIGNOFF_MISSING", detail: "Operator sign-off name/role/date required." };
}

export function ruleEvidenceDiversity(ok: boolean): ReadinessRuleResult {
  return ok
    ? { pass: true, code: "EVIDENCE_DIVERSITY_OK" }
    : {
        pass: false,
        code: "EVIDENCE_DIVERSITY_INSUFFICIENT",
        detail: "Distinct evidence document count below minimum.",
      };
}

export function ruleUncertaintyAssessed(assessed: boolean): ReadinessRuleResult {
  return assessed
    ? { pass: true, code: "UNCERTAINTY_ASSESSED" }
    : {
        pass: false,
        code: "UNCERTAINTY_NOT_ASSESSED",
        detail: "Tier/uncertainty chapter empty or tiers dataset MISSING.",
      };
}
