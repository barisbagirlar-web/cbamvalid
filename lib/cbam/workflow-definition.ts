/**
 * CBAMValid guided workflow — single source of truth (SSOT).
 *
 * This file is the ONLY step definition in the system. Every consumer derives
 * from it:
 *   - step navigation (wizard client, journey strip, footer)
 *   - progress summary (step X of 8, field/document counters)
 *   - validation registry (field sets per step)
 *   - renderStep matching (renderKey)
 *   - blocker remediation links ("Go to Step X")
 *   - mobile step menu / drawer
 *   - E2E tests and accessibility labels
 *
 * Rule: never hardcode a step title, short title, description or renderKey
 * anywhere else. If a label changes, change it here once.
 */

export type CbamStepKey =
  | "IDENTITY_PERIOD"
  | "GOODS_CN"
  | "INSTALLATION_BOUNDARY"
  | "DIRECT_EMISSIONS"
  | "INDIRECT_EMISSIONS"
  | "PRECURSORS_METHODOLOGY"
  | "EVIDENCE_APPROVALS"
  | "FINAL_REVIEW_RELEASE";

export type CbamStepRenderKey =
  | "identity"
  | "goods"
  | "installation"
  | "directEmissions"
  | "indirectEmissions"
  | "precursors"
  | "evidence"
  | "finalReview";

export interface CbamWorkflowStep {
  readonly id: number;
  readonly key: CbamStepKey;
  readonly title: string;
  readonly shortTitle: string;
  readonly description: string;
  readonly renderKey: CbamStepRenderKey;
}

export const CBAM_WORKFLOW_STEPS = [
  {
    id: 1,
    key: "IDENTITY_PERIOD",
    title: "Company and reporting period",
    shortTitle: "Company & period",
    description:
      "Enter the importer, operator and reporting-period details.",
    renderKey: "identity",
  },
  {
    id: 2,
    key: "GOODS_CN",
    title: "Goods and CN codes",
    shortTitle: "Goods",
    description:
      "Define the CBAM goods, CN codes, quantities and allocation.",
    renderKey: "goods",
  },
  {
    id: 3,
    key: "INSTALLATION_BOUNDARY",
    title: "Installation and system boundary",
    shortTitle: "Installation",
    description:
      "Describe the factory, production route and monitored boundary.",
    renderKey: "installation",
  },
  {
    id: 4,
    key: "DIRECT_EMISSIONS",
    title: "Direct emissions",
    shortTitle: "Direct emissions",
    description:
      "Enter installation-level direct emissions for the reporting period.",
    renderKey: "directEmissions",
  },
  {
    id: 5,
    key: "INDIRECT_EMISSIONS",
    title: "Electricity and indirect emissions",
    shortTitle: "Indirect emissions",
    description:
      "Enter electricity consumption and the applicable emission factor.",
    renderKey: "indirectEmissions",
  },
  {
    id: 6,
    key: "PRECURSORS_METHODOLOGY",
    title: "Precursors and methodology",
    shortTitle: "Precursors",
    description:
      "Enter purchased inputs and record controlled methodology decisions.",
    renderKey: "precursors",
  },
  {
    id: 7,
    key: "EVIDENCE_APPROVALS",
    title: "Documents, approvals and final checks",
    shortTitle: "Evidence & checks",
    description:
      "Upload documents, link evidence and resolve review requirements.",
    renderKey: "evidence",
  },
  {
    id: 8,
    key: "FINAL_REVIEW_RELEASE",
    title: "Final review, payment and download",
    shortTitle: "Final review",
    description:
      "Review readiness and create the controlled verifier package.",
    renderKey: "finalReview",
  },
] as const satisfies readonly CbamWorkflowStep[];

export const CBAM_WORKFLOW_STEP_COUNT = CBAM_WORKFLOW_STEPS.length as 8;

/** Lookup by numeric id (1..8). */
export function getWorkflowStep(step: number): CbamWorkflowStep {
  const match = CBAM_WORKFLOW_STEPS.find((item) => item.id === step);
  if (!match) return CBAM_WORKFLOW_STEPS[0];
  return match;
}

/** Lookup by renderKey. */
export function getWorkflowStepByRenderKey(renderKey: CbamStepRenderKey): CbamWorkflowStep | undefined {
  return CBAM_WORKFLOW_STEPS.find((item) => item.renderKey === renderKey);
}

/** Lookup by step key. */
export function getWorkflowStepByKey(key: CbamStepKey): CbamWorkflowStep | undefined {
  return CBAM_WORKFLOW_STEPS.find((item) => item.key === key);
}
