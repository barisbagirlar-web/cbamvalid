/**
 * FAZ P0 — Wizard step validation and stepper state model.
 *
 * validateWizardStep() is the single source of truth used by CaseWizardClient
 * to block unconditional Next transitions, show inline errors, compute the
 * completed/missing counters shown in the stepper and derive each step's
 * stepper state (NOT_STARTED / IN_PROGRESS / NEEDS_ATTENTION /
 * NEEDS_EVIDENCE / COMPLETE).
 *
 * Blocking model:
 *   - Missing required DATA always blocks the step (any step).
 *   - Missing material EVIDENCE hard-blocks from `HARD_BLOCK_START_STEP`
 *     onward (the evidence stage and the seal). On earlier steps the user may
 *     navigate forward to reach the evidence-upload screen, but the step is
 *     surfaced as NEEDS_EVIDENCE so documents can never be silently skipped.
 *
 * The validation registry intentionally mirrors the material-input registry
 * so guidance, validation and evidence linking stay aligned.
 */

import type { AuditReadyCase } from "@/lib/cbam/schema";
import type { MaterialInputRequirement } from "@/lib/cbam/premium-dossier-model";
import { getFieldGuidanceForPath } from "@/lib/cbam/field-guidance";
import { deriveMaterialRequirements } from "@/lib/cbam/validation/material-input-registry";

export const WIZARD_STEP_COUNT = 8;

/** Steps at/after which missing material evidence hard-blocks progression. */
export const HARD_BLOCK_START_STEP = 7;

export type WizardStepperState =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "NEEDS_ATTENTION"
  | "NEEDS_EVIDENCE"
  | "COMPLETE";

export interface WizardStepIssue {
  fieldPath: string;
  label: string;
  message: string;
  kind: "MISSING" | "INVALID" | "EVIDENCE";
}

export interface WizardStepValidation {
  step: number;
  valid: boolean;
  issues: WizardStepIssue[];
  dataIssues: WizardStepIssue[];
  evidenceIssues: WizardStepIssue[];
  completedFieldCount: number;
  missingFieldCount: number;
  missingEvidenceCount: number;
  state: WizardStepperState;
}

export interface WizardFieldSpec {
  fieldPath: string;
  label: string;
  required: boolean;
  evidenceRequired: boolean;
  // Path to the InputDatum holding the value; defaults to fieldPath.
  valuePath?: string;
}

export const WIZARD_STEP_HEADERS: Record<number, { title: string; shortTitle: string }> = {
  1: { title: "Who and where", shortTitle: "Identity" },
  2: { title: "What you sell", shortTitle: "Goods" },
  3: { title: "How you make it", shortTitle: "Installation" },
  4: { title: "Emissions numbers", shortTitle: "Direct emissions" },
  5: { title: "Indirect emissions", shortTitle: "Indirect" },
  6: { title: "Bought inputs", shortTitle: "Precursors" },
  7: { title: "Proof documents", shortTitle: "Evidence" },
  8: { title: "Lock & download", shortTitle: "Seal" },
};

const valueAt = (caseData: AuditReadyCase, path: string): unknown => {
  const parts = path.split(".");
  let current: unknown = caseData;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
};

function datumValueAt(caseData: AuditReadyCase, path: string): unknown {
  const datum = valueAt(caseData, path) as
    | { value?: string | number | null }
    | string
    | null
    | undefined;
  if (datum === null || datum === undefined) return undefined;
  if (typeof datum === "object" && "value" in datum) return datum.value;
  return datum;
}

function isPresent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value) && value >= 0;
  return true;
}

function hasEvidenceId(caseData: AuditReadyCase, path: string): boolean {
  const datum = valueAt(caseData, path) as { evidenceId?: string } | null | undefined;
  return Boolean(datum && datum.evidenceId && datum.evidenceId.trim().length > 0);
}

function findEvidenceForInput(caseData: AuditReadyCase, path: string): boolean {
  return caseData.evidenceRegister.some((record) =>
    record.linkedInputs.some((linked) => linked === path)
  );
}

const STEP_FIELD_SPECS: WizardFieldSpec[][] = [
  // Step 1 — Who and where
  [
    { fieldPath: "importerIdentity.legalName", label: "Importer legal name", required: true, evidenceRequired: false },
    { fieldPath: "importerIdentity.eoriNumber", label: "Declarant EORI number", required: true, evidenceRequired: true },
    { fieldPath: "exporterIdentity.legalName", label: "Exporter/operator legal name", required: true, evidenceRequired: false },
    { fieldPath: "reportingPeriod.year", label: "Reporting year", required: true, evidenceRequired: true },
    { fieldPath: "reportingPeriod.quarter", label: "Reporting period / quarter", required: true, evidenceRequired: false },
  ],
  // Step 2 — What you sell
  [
    { fieldPath: "goods.*.cnCode", label: "CN code", required: true, evidenceRequired: true },
    { fieldPath: "goods.*.sector", label: "CBAM sector", required: true, evidenceRequired: false },
    { fieldPath: "goods.*.productionVolume", label: "Production quantity", required: true, evidenceRequired: true },
    { fieldPath: "goods.*.shipmentRecords", label: "Shipment / product description", required: true, evidenceRequired: false },
    { fieldPath: "goods.*.allocationShare", label: "Allocation share (0–1)", required: false, evidenceRequired: true },
  ],
  // Step 3 — How you make it
  [
    { fieldPath: "installation.name", label: "Installation name", required: true, evidenceRequired: false },
    { fieldPath: "installation.country", label: "Installation country", required: true, evidenceRequired: false },
    { fieldPath: "installation.productionRoute", label: "Production route", required: true, evidenceRequired: false },
    { fieldPath: "installation.monitoringPlanId", label: "Monitoring plan", required: true, evidenceRequired: true },
    { fieldPath: "installation.systemBoundaries", label: "System-boundary statement", required: true, evidenceRequired: true },
  ],
  // Step 4 — Emissions numbers
  [
    { fieldPath: "directEmissions", label: "Total direct emissions", required: true, evidenceRequired: true },
  ],
  // Step 5 — Indirect emissions
  [
    { fieldPath: "electricityConsumed", label: "Electricity consumed", required: true, evidenceRequired: true },
    { fieldPath: "gridEmissionFactor", label: "Grid emission factor", required: true, evidenceRequired: true },
  ],
  // Step 6 — Precursors and methodology decisions
  [
    { fieldPath: "precursors.*.name", label: "Precursor name", required: false, evidenceRequired: true },
    { fieldPath: "precursors.*.quantity", label: "Precursor quantity", required: false, evidenceRequired: true },
    { fieldPath: "precursors.*.directEmissions", label: "Precursor direct emissions", required: false, evidenceRequired: true },
    { fieldPath: "precursors.*.indirectEmissions", label: "Precursor indirect emissions", required: false, evidenceRequired: true },
    { fieldPath: "methodologyDecisions.*.topic", label: "Methodology decision topic", required: false, evidenceRequired: false },
  ],
  // Step 7 — Carbon price and evidence register
  [
    { fieldPath: "carbonPriceRecords.*.amountPaid", label: "Carbon price amount paid", required: false, evidenceRequired: true },
    { fieldPath: "carbonPriceRecords.*.applicableEmissions", label: "Carbon price applicable emissions", required: false, evidenceRequired: true },
  ],
  // Step 8 — Lock & download (no data fields; aggregated evidence posture)
  [],
];

/** Exposed for the wizard stepper and tests. */
export const WIZARD_STEP_FIELD_SPECS: readonly WizardFieldSpec[][] = STEP_FIELD_SPECS;

export function wizardStepTotalFields(step: number): number {
  const specs = STEP_FIELD_SPECS[step - 1] ?? [];
  const unique = new Set(specs.map((spec) => spec.fieldPath));
  return unique.size;
}

function expandSpecs(specs: WizardFieldSpec[], caseData: AuditReadyCase): Array<{ spec: WizardFieldSpec; concretePath: string }> {
  const expanded: Array<{ spec: WizardFieldSpec; concretePath: string }> = [];
  for (const spec of specs) {
    if (!spec.fieldPath.includes("*")) {
      expanded.push({ spec, concretePath: spec.fieldPath });
      continue;
    }
    const starSegments = spec.fieldPath.split(".").map((segment, index) => (segment === "*" ? index : -1)).filter((index) => index >= 0);
    if (starSegments.length !== 1) continue;
    const collectionPath = spec.fieldPath.split(".").slice(0, starSegments[0]!).join(".");
    const collection = valueAt(caseData, collectionPath);
    if (!Array.isArray(collection) || collection.length === 0) {
      if (spec.required) {
        expanded.push({ spec, concretePath: spec.fieldPath });
      }
      continue;
    }
    collection.forEach((_, index) => {
      const parts = spec.fieldPath.split(".");
      parts[starSegments[0]!] = String(index);
      expanded.push({ spec, concretePath: parts.join(".") });
    });
  }
  return expanded;
}

function decisionMatchesRequirement(decision: AuditReadyCase["methodologyDecisions"][number], requirement: MaterialInputRequirement): boolean {
  if (decision.reviewStatus !== "ACCEPTED") return false;
  return (
    decision.topic.includes(requirement.inputPath) ||
    decision.topic.includes(requirement.requirementId) ||
    decision.topic.includes(requirement.displayName)
  );
}

/**
 * Validate the mandatory data + evidence requirements of a single wizard step.
 * Field-level guidance is attached to every issue via the guidance registry so
 * the UI can render the "why", "format", "which document", "from whom" and
 * "period" hints inline.
 */
export function validateWizardStep(step: number, caseData: AuditReadyCase): WizardStepValidation {
  const index = step - 1;
  const specs = STEP_FIELD_SPECS[index] ?? [];
  const expanded = expandSpecs(specs, caseData);

  const dataIssues: WizardStepIssue[] = [];
  const evidenceIssues: WizardStepIssue[] = [];
  let completedFieldCount = 0;
  let missingFieldCount = 0;
  let missingEvidenceCount = 0;

  for (const { spec, concretePath } of expanded) {
    const label = spec.label;
    const guidance = getFieldGuidanceForPath(concretePath);
    const present = isPresent(datumValueAt(caseData, concretePath));

    if (spec.required && !present) {
      dataIssues.push({
        fieldPath: concretePath,
        label,
        message: guidance
          ? `${guidance.whyRequired} Format: ${guidance.expectedFormat}`
          : `Enter a value for ${label}.`,
        kind: "MISSING",
      });
      missingFieldCount += 1;
      continue;
    }
    if (!present) continue;
    completedFieldCount += 1;

    const hasLinkedEvidence =
      hasEvidenceId(caseData, concretePath) || findEvidenceForInput(caseData, concretePath);
    if (spec.evidenceRequired && !hasLinkedEvidence) {
      const coveredByAcceptedDecision =
        concretePath === "installation.systemBoundaries" &&
        caseData.methodologyDecisions.some(
          (decision) => decision.reviewStatus === "ACCEPTED" && decision.topic.includes("SYSTEM_BOUNDARY")
        );
      if (coveredByAcceptedDecision) continue;
      evidenceIssues.push({
        fieldPath: concretePath,
        label,
        message: guidance
          ? `Evidence required. Accepted documents: ${guidance.acceptedEvidenceTypes.join(", ")}. Issuer: ${guidance.preferredIssuerCategories.join(" or ")}. Period: ${guidance.periodGuidance}.`
          : `Link supporting evidence to ${label}.`,
        kind: "EVIDENCE",
      });
      missingEvidenceCount += 1;
    }
  }

  // installation.systemBoundaries is supported by approved evidence OR by a
  // server-reviewed ACCEPTED methodology decision (mirrors the server-side
  // evidence-sufficiency engine).
  if (step === 3 && isPresent(datumValueAt(caseData, "installation.systemBoundaries"))) {
    const hasBoundaryDecision = caseData.methodologyDecisions.some(
      (decision) => decision.reviewStatus === "ACCEPTED" && decision.topic.includes("SYSTEM_BOUNDARY")
    );
    if (!hasBoundaryDecision && !hasEvidenceId(caseData, "installation.systemBoundaries") && !findEvidenceForInput(caseData, "installation.systemBoundaries")) {
      const alreadyReported = evidenceIssues.some((issue) => issue.fieldPath === "installation.systemBoundaries");
      if (!alreadyReported) {
        evidenceIssues.push({
          fieldPath: "installation.systemBoundaries",
          label: "System-boundary statement",
          message: "The system boundary must be supported by approved evidence (monitoring plan, permit/scope, process map or controlled statement) or by a server-reviewed accepted methodology decision.",
          kind: "EVIDENCE",
        });
        missingEvidenceCount += 1;
      }
    }
  }

  // Material evidence is a hard block from the evidence stage onward: every
  // material requirement must be backed by an approved evidence record or an
  // accepted methodology decision before the seal can be attempted.
  if (step >= HARD_BLOCK_START_STEP) {
    const materialRequirements = deriveMaterialRequirements(caseData);
    for (const requirement of materialRequirements) {
      if (requirement.requirementLevel !== "MATERIAL_REQUIRED" && requirement.requirementLevel !== "REQUIRED") continue;
      if (requirement.minimumEvidenceCount <= 0) continue;

      const supportedByEvidence = caseData.evidenceRegister.some(
        (record) =>
          record.linkedInputs.includes(requirement.inputPath) &&
          record.reviewStatus === "APPROVED"
      );
      const acceptedDecision = caseData.methodologyDecisions.some((decision) =>
        decisionMatchesRequirement(decision, requirement)
      );

      if (!supportedByEvidence && !acceptedDecision) {
        const alreadyReported =
          evidenceIssues.some((issue) => issue.fieldPath === requirement.inputPath) ||
          dataIssues.some((issue) => issue.fieldPath === requirement.inputPath);
        if (!alreadyReported) {
          evidenceIssues.push({
            fieldPath: requirement.inputPath,
            label: requirement.displayName,
            message: `Material evidence required for ${requirement.displayName}; the seal is blocked until an approved, malware-clean document is linked or an accepted methodology decision covers it.`,
            kind: "EVIDENCE",
          });
          missingEvidenceCount += 1;
        }
      }
    }
  }

  // Missing material evidence hard-blocks from the evidence stage onward;
  // data gaps always block. Early-step evidence gaps stay advisory so the
  // user can reach the evidence-upload screen.
  const evidenceBlocks = step >= HARD_BLOCK_START_STEP && evidenceIssues.length > 0;
  const valid = dataIssues.length === 0 && !evidenceBlocks;
  const state = deriveStepState(
    index + 1,
    completedFieldCount,
    missingFieldCount,
    missingEvidenceCount,
    valid
  );

  return {
    step,
    valid,
    issues: [...dataIssues, ...evidenceIssues],
    dataIssues,
    evidenceIssues,
    completedFieldCount,
    missingFieldCount,
    missingEvidenceCount,
    state,
  };
}

function deriveStepState(
  step: number,
  completed: number,
  missingFields: number,
  missingEvidence: number,
  valid: boolean
): WizardStepperState {
  const total = STEP_FIELD_SPECS[step - 1]?.length ?? 0;
  if (step === 8) {
    if (missingEvidence > 0) return "NEEDS_EVIDENCE";
    if (missingFields > 0) return "NEEDS_ATTENTION";
    return valid ? "COMPLETE" : "IN_PROGRESS";
  }
  if (total === 0) return "COMPLETE";
  if (missingFields > 0) return "NEEDS_ATTENTION";
  if (missingEvidence > 0) return "NEEDS_EVIDENCE";
  return completed >= total ? "COMPLETE" : "IN_PROGRESS";
}

/**
 * Total stepper metrics across all data steps (used in the case header).
 */
export function summarizeWizardCompletion(caseData: AuditReadyCase): {
  completedFields: number;
  missingFields: number;
  missingEvidence: number;
} {
  let completedFields = 0;
  let missingFields = 0;
  let missingEvidence = 0;
  for (let step = 1; step <= 7; step += 1) {
    const validation = validateWizardStep(step, caseData);
    completedFields += validation.completedFieldCount;
    missingFields += validation.missingFieldCount;
    missingEvidence += validation.missingEvidenceCount;
  }
  return { completedFields, missingFields, missingEvidence };
}

/**
 * FAZ UX (2026-08-01) — final-review navigation policy.
 *
 * Navigation and sealing are deliberately decoupled:
 *   - NAVIGATION_ALLOWED=true — the user may open any step (including the
 *     final review) at any time. goToStep() only clamps the range.
 *   - SEAL_ALLOWED=readiness.isEligibleForSealing — unchanged and fail-closed.
 * Next is blocked only by missing DATA so the user can always reach the
 * evidence-upload and final-review screens; missing evidence is surfaced as
 * NEEDS_EVIDENCE but never silently skipped and never redirects step 8 back.
 */

export function clampWizardStep(step: number): number {
  if (!Number.isFinite(step)) return 1;
  return Math.min(WIZARD_STEP_COUNT, Math.max(1, Math.round(step)));
}

/**
 * Read the ?step=N query value. Out-of-range and malformed values fall back
 * to step 1 so a broken URL can never open an unknown screen.
 */
export function parseStepFromQuery(value: string | string[] | null | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = raw === undefined || raw === null ? Number.NaN : Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? clampWizardStep(parsed) : 1;
}

/** Next is blocked only by missing required DATA; evidence gaps never block. */
export function shouldBlockNext(validation: WizardStepValidation): boolean {
  return validation.dataIssues.length > 0;
}

/** First data path that needs attention, for inline focus. */
export function firstDataIssuePath(validation: WizardStepValidation): string | undefined {
  return validation.dataIssues[0]?.fieldPath;
}

export type SealAttemptDecision =
  | { allowed: true; kind: "PROCEED"; entitlementId: string }
  | { allowed: false; kind: "REVEAL_BLOCKERS" }
  | { allowed: false; kind: "CORRECTION_REASON_REQUIRED" }
  | { allowed: false; kind: "ENTITLEMENT_REQUIRED" };

export interface SealAttemptInput {
  isEligibleForSealing: boolean;
  correctionRequired: boolean;
  correctionReason: string;
  entitlementId?: string;
}

/**
 * Pure seal-attempt gate. It never navigates, never mutates the ledger and
 * never touches payment; it only returns a decision for the UI to render.
 * The "not eligible" branch is REVEAL_BLOCKERS (stay on step 8, open the
 * blocker panel) — step 7 is never forced.
 */
export function evaluateSealAttempt(input: SealAttemptInput): SealAttemptDecision {
  if (!input.isEligibleForSealing) return { allowed: false, kind: "REVEAL_BLOCKERS" };
  if (
    input.correctionRequired &&
    (!input.correctionReason || input.correctionReason.trim().length < 10)
  ) {
    return { allowed: false, kind: "CORRECTION_REASON_REQUIRED" };
  }
  if (!input.entitlementId) return { allowed: false, kind: "ENTITLEMENT_REQUIRED" };
  return { allowed: true, kind: "PROCEED", entitlementId: input.entitlementId };
}

export interface SealErrorTranslation {
  userMessage: string;
  technicalCode: string;
}

/**
 * Map a seal failure to user-facing language with the raw technical code kept
 * separate in a small technical area. Failures never consume an entitlement.
 */
export function translateSealError(error: unknown): SealErrorTranslation {
  const technicalCode =
    error instanceof Error && error.message.trim() ? error.message : String(error || "UNKNOWN_SEAL_ERROR");
  if (technicalCode.includes("SEALED_REPORT_ID_MISSING")) {
    return {
      userMessage:
        "The package was sealed, but its report identifier could not be read. Reload the case and open Locked packages — no extra charge was made.",
      technicalCode,
    };
  }
  if (/ENTITLEMENT|UNPAID|unpaid/i.test(technicalCode)) {
    return {
      userMessage: "This file is unpaid. Pay once to lock this working file before generating the package.",
      technicalCode,
    };
  }
  if (/BLOCKER|QC_|READINESS|blocked/i.test(technicalCode)) {
    return {
      userMessage: "The seal gate is still blocked by unresolved quality controls. Your draft is safe and nothing was charged.",
      technicalCode,
    };
  }
  if (/UNAUTHENTICATED|SESSION/i.test(technicalCode)) {
    return { userMessage: "Your session expired. Sign in again and retry the lock.", technicalCode };
  }
  if (/PERMISSION_DENIED|FORBIDDEN|NOT_FOUND/i.test(technicalCode)) {
    return {
      userMessage: "This case is not available for your account. Reload the case list and reopen the working file.",
      technicalCode,
    };
  }
  return {
    userMessage:
      "Sealing could not be completed. Your draft is safe and nothing was charged. Review the remaining actions and retry.",
    technicalCode,
  };
}

export type Step8ActionCategory =
  | "Required information"
  | "Documents to upload"
  | "Documents awaiting review"
  | "Methodology decisions awaiting approval"
  | "Calculation inconsistencies";

export interface Step8ActionItem {
  category: Step8ActionCategory;
  fieldLabel: string;
  why: string;
  acceptedDocuments: string;
  step: number;
  fieldPath: string;
}

export interface Step8CalculationSummary {
  allocationShareTotal?: string | null;
  allocationReconciliationDelta?: string | null;
  error?: string;
}

function parseCalcValue(value: string | null | undefined): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Step 8 final-review action list, categorized so the user can see exactly
 * what is missing, why, which document is accepted and which step to fix it
 * in. The user chooses the step — this never redirects by itself.
 */
export function summarizeStep8Actions(
  caseData: AuditReadyCase,
  calculation?: Step8CalculationSummary | null
): Step8ActionItem[] {
  const items: Step8ActionItem[] = [];

  const push = (
    category: Step8ActionCategory,
    fieldLabel: string,
    why: string,
    acceptedDocuments: string,
    step: number,
    fieldPath: string
  ) => {
    items.push({ category, fieldLabel, why, acceptedDocuments, step, fieldPath });
  };

  for (let step = 1; step <= 8; step += 1) {
    const validation = validateWizardStep(step, caseData);
    for (const issue of validation.dataIssues) {
      const guidance = getFieldGuidanceForPath(issue.fieldPath);
      push(
        "Required information",
        issue.label,
        issue.message,
        guidance ? guidance.acceptedEvidenceTypes.join(", ") || "Source document" : "Source document",
        step,
        issue.fieldPath
      );
    }
    for (const issue of validation.evidenceIssues) {
      const guidance = getFieldGuidanceForPath(issue.fieldPath);
      push(
        "Documents to upload",
        issue.label,
        issue.message,
        guidance ? guidance.acceptedEvidenceTypes.join(", ") || "Source document" : "Source document",
        step,
        issue.fieldPath
      );
    }
  }

  for (const record of caseData.evidenceRegister) {
    const ready =
      record.reviewStatus === "APPROVED" &&
      record.supportStatus === "SUPPORTED" &&
      record.malwareScanStatus === "CLEAN";
    if (ready) continue;
    const why =
      record.malwareScanStatus !== "CLEAN"
        ? "Uploaded and linked, but blocked on the external malware scan."
        : record.reviewStatus === "PENDING"
          ? "Uploaded and linked, awaiting the internal review workflow."
          : `Internal review is ${record.reviewStatus}.`;
    push("Documents awaiting review", record.fileName, why, record.documentType, 7, `evidenceRegister.${record.evidenceId}`);
  }

  for (const decision of caseData.methodologyDecisions) {
    if (decision.reviewStatus === "ACCEPTED") continue;
    const step = decision.topic.includes("SYSTEM_BOUNDARY") ? 3 : 6;
    push(
      "Methodology decisions awaiting approval",
      decision.topic,
      `Review status is ${decision.reviewStatus}; ACCEPTED is granted only by the server-controlled internal review workflow.`,
      "Monitoring plan, process map or operator declaration supporting the selected method",
      step,
      `methodologyDecisions.${decision.decisionId}`
    );
  }

  if (calculation?.error) {
    push("Calculation inconsistencies", "Dossier calculation", calculation.error, "Calculation trace and allocation workbook", 2, "calculationTrace");
  }
  const allocationTotal = parseCalcValue(calculation?.allocationShareTotal);
  if (allocationTotal !== undefined && Math.abs(allocationTotal - 1) > 0.000001) {
    push(
      "Calculation inconsistencies",
      "Allocation shares",
      `Allocation shares total ${String(calculation?.allocationShareTotal)}; they must reconcile to exactly 1.`,
      "Allocation workbook and production ledger",
      2,
      "goods"
    );
  }
  const reconciliationDelta = parseCalcValue(calculation?.allocationReconciliationDelta);
  if (reconciliationDelta !== undefined && reconciliationDelta > 0.000001) {
    push(
      "Calculation inconsistencies",
      "Allocation reconciliation",
      `Allocated emissions do not reconcile to the installation totals (delta ${String(calculation?.allocationReconciliationDelta)}).`,
      "Allocation workbook, production ledger and emissions reconciliation",
      2,
      "goods"
    );
  }

  return items;
}

/**
 * Dynamic evidence link options generated from the case's real material
 * requirement records (replaces the legacy static EVIDENCE_LINK_OPTIONS).
 */
export interface EvidenceLinkOption {
  value: string;
  label: string;
  required: boolean;
  acceptedEvidenceTypes: readonly string[];
  preferredIssuerCategories: readonly string[];
}

export function buildEvidenceLinkOptions(caseData: AuditReadyCase): EvidenceLinkOption[] {
  const options: EvidenceLinkOption[] = [];
  const push = (path: string, label: string, required: boolean) => {
    const guidance = getFieldGuidanceForPath(path);
    options.push({
      value: path,
      label,
      required,
      acceptedEvidenceTypes: guidance?.acceptedEvidenceTypes ?? [],
      preferredIssuerCategories: guidance?.preferredIssuerCategories ?? [],
    });
  };

  push("importerIdentity.legalName", "Importer legal name", true);
  push("importerIdentity.eoriNumber", "Importer EORI", true);
  push("exporterIdentity.legalName", "Exporter/operator legal name", true);
  push("reportingPeriod.year", "Reporting year", true);
  push("reportingPeriod.quarter", "Reporting period / quarter", true);
  push("installation.name", "Installation identity", true);
  push("installation.country", "Installation country", true);
  push("installation.productionRoute", "Production route", true);
  push("installation.systemBoundaries", "System-boundary statement", true);
  push("installation.monitoringPlanId", "Monitoring plan", true);
  push("directEmissions", "Direct emissions", true);
  push("electricityConsumed", "Electricity consumed", true);
  push("gridEmissionFactor", "Grid emission factor", true);

  for (const good of caseData.goods) {
    const index = caseData.goods.indexOf(good);
    push(`goods.${index}.cnCode`, `Good ${index + 1} CN code`, true);
    push(`goods.${index}.productionVolume`, `Good ${index + 1} production`, true);
    push(`goods.${index}.allocationShare`, `Good ${index + 1} allocation`, caseData.goods.length > 1);
  }

  for (const precursor of caseData.precursors) {
    const index = caseData.precursors.indexOf(precursor);
    push(`precursors.${index}.name`, `Precursor ${index + 1} name`, true);
    push(`precursors.${index}.quantity`, `Precursor ${index + 1} quantity`, true);
    push(`precursors.${index}.directEmissions`, `Precursor ${index + 1} direct emissions`, true);
    push(`precursors.${index}.indirectEmissions`, `Precursor ${index + 1} indirect emissions`, true);
  }

  for (const record of caseData.carbonPriceRecords) {
    const index = caseData.carbonPriceRecords.indexOf(record);
    push(`carbonPriceRecords.${index}.amountPaid`, `Carbon price ${index + 1} amount paid`, true);
    push(`carbonPriceRecords.${index}.applicableEmissions`, `Carbon price ${index + 1} applicable emissions`, true);
    push(`carbonPriceRecords.${index}.proofOfPaymentEvidenceId`, `Carbon price ${index + 1} payment evidence`, true);
  }

  return options;
}

// Guidance integration: expose the step from which material evidence gaps
// hard-block, so Step 6-8 blocking and the seal button stay aligned.
export function getUnblockedStepRange(): { hardBlockStartStep: number } {
  return { hardBlockStartStep: HARD_BLOCK_START_STEP };
}
