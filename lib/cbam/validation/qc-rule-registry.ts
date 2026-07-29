/**
 * SSOT for CBAMValid quality-control rule families.
 * Homepage / marketing counts MUST derive from this registry (or from
 * runQualityControls() results), never from a guessed marketing number.
 *
 * Runtime expansions (per-good QC_03_n, per-precursor QC_09_*, etc.) are
 * produced by runQualityControls(); this registry lists the base families.
 */
export const QC_RULE_REGISTRY = [
  {
    ruleId: "QC_SCENARIO",
    name: "Illustrative scenario replacement",
    expansion: "singleton",
  },
  {
    ruleId: "QC_00",
    name: "Operator, installation and boundary identity",
    expansion: "singleton",
  },
  {
    ruleId: "QC_00_ORIGIN",
    name: "Installation country CBAM origin scope",
    expansion: "singleton",
  },
  {
    ruleId: "QC_01",
    name: "EORI format and evidence",
    expansion: "singleton",
  },
  {
    ruleId: "QC_02",
    name: "Definitive-period reporting year",
    expansion: "singleton",
  },
  {
    ruleId: "QC_03",
    name: "Goods CN code and evidence",
    expansion: "per_good",
  },
  {
    ruleId: "QC_04",
    name: "Goods production quantity and evidence",
    expansion: "per_good",
  },
  {
    ruleId: "QC_05",
    name: "Goods sector support",
    expansion: "per_good",
  },
  {
    ruleId: "QC_05A",
    name: "Goods emissions allocation",
    expansion: "singleton",
  },
  {
    ruleId: "QC_06",
    name: "Direct emissions value, unit and evidence",
    expansion: "singleton",
  },
  {
    ruleId: "QC_07",
    name: "Electricity consumed value, unit and evidence",
    expansion: "singleton",
  },
  {
    ruleId: "QC_08",
    name: "Grid emission factor value, unit and evidence",
    expansion: "singleton",
  },
  {
    ruleId: "QC_09",
    name: "Precursor scope or precursor field evidence",
    expansion: "per_precursor_or_scope",
  },
  {
    ruleId: "QC_10",
    name: "Evidence register integrity",
    expansion: "singleton",
  },
  {
    ruleId: "QC_11",
    name: "Carbon price records / proof of payment",
    expansion: "per_carbon_price_or_na",
  },
  {
    ruleId: "QC_12",
    name: "Goods cross-artifact consistency",
    expansion: "singleton",
  },
  {
    ruleId: "QC_13",
    name: "Production process register and attribution reconciliation",
    expansion: "per_process",
  },
  {
    ruleId: "QC_14",
    name: "Source stream register, calibration and uncertainty",
    expansion: "per_source_stream",
  },
  {
    ruleId: "QC_15",
    name: "Emission source register",
    expansion: "per_emission_source",
  },
  {
    ruleId: "QC_16",
    name: "Meter register, calibration and uncertainty",
    expansion: "per_meter",
  },
] as const;

export type QcRuleFamilyId = (typeof QC_RULE_REGISTRY)[number]["ruleId"];

/** Distinct QC rule families implemented by runQualityControls. */
export function getQcRuleFamilyCount(): number {
  return QC_RULE_REGISTRY.length;
}

export function isRegisteredQcFamily(ruleId: string): boolean {
  if (QC_RULE_REGISTRY.some((rule) => rule.ruleId === ruleId)) return true;
  return QC_RULE_REGISTRY.some((rule) => {
    if (rule.expansion === "per_good") {
      return new RegExp(`^${rule.ruleId}_\\d+$`).test(ruleId);
    }
    if (rule.expansion === "per_precursor_or_scope") {
      return ruleId === "QC_09" || ruleId.startsWith("QC_09_");
    }
    if (rule.expansion === "per_carbon_price_or_na") {
      return ruleId === "QC_11" || ruleId.startsWith("QC_11_");
    }
    if (
      rule.expansion === "per_process" ||
      rule.expansion === "per_source_stream" ||
      rule.expansion === "per_emission_source" ||
      rule.expansion === "per_meter"
    ) {
      return ruleId === rule.ruleId || new RegExp(`^${rule.ruleId}_\\d+$`).test(ruleId);
    }
    return false;
  });
}
