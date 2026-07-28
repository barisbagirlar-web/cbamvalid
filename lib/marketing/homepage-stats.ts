import { getQcRuleFamilyCount } from "@/lib/cbam/validation/qc-rule-registry";
import { WORKFLOW_STEPS_PLAIN } from "@/lib/product/customer-language";
import sampleManifest from "@/public/sample-dossier/v1/manifest.json";

/**
 * Homepage proof-strip stats — static source of truth for SSR.
 * CountUp may only animate from a lower value TO these values.
 */
export const HOMEPAGE_STATS = {
  dossierPages: sampleManifest.pageCount,
  workflowStages: WORKFLOW_STEPS_PLAIN.length,
  /** Derived from QC_RULE_REGISTRY — never a guessed marketing figure. */
  qcChecks: getQcRuleFamilyCount(),
  exportFormats: 3,
} as const;

export type HomepageStatKey = keyof typeof HOMEPAGE_STATS;
