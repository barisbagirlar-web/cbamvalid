/**
 * G-08 / INV-05 — mandatory evidence gaps.
 *
 * Every registry field marked COMPLETE_OPERATOR whose evidence requirement is
 * MANDATORY and whose evidenceIds are empty produces an automatic
 * FND-EVIDENCE-GAP-<FIELD_ID> finding. The operator can close the gap, so it
 * drives ACTION_REQUIRED, never BLOCKED.
 */
import type {
  EvidenceGapFinding,
  EvidenceRequirementStatus,
  RegistryEvidenceRequirement,
} from "./types";
import type { RegistryTemplateFieldMapping } from "../../registry/registry-template-mapping";

/**
 * Evidence requirement per registry field. Verifier-reserved fields never
 * demand operator evidence; system-derived period fields are covered by the
 * period basis evidence; N/A fields carry an inline basis.
 */
const MANDATORY_PREFIXES = [
  "REG-OP-LEGAL-NAME",
  "REG-OP-REG-NO",
  "REG-OP-ADDRESS",
  "REG-OP-COUNTRY",
  "REG-INST-NAME",
  "REG-INST-COUNTRY",
  "REG-INST-PRODUCTION-ROUTE",
  "REG-INST-SYSTEM-BOUNDARY",
  "REG-INST-MONITORING-PLAN",
  "REG-PERIOD-YEAR",
  "REG-PERIOD-START",
  "REG-PERIOD-END",
  "REG-GOOD-CN-",
  "REG-GOOD-PROD-",
  "REG-GOOD-ALLOC-",
  "REG-DIRECT-EM",
  "REG-ELECTRICITY",
  "REG-GRID-FACTOR",
  "REG-PREC-QTY-",
  "REG-PREC-COUNTRY-",
  "REG-PREC-DIRECT-",
  "REG-PREC-INDIRECT-",
  "REG-ALLOC-METHOD",
  "REG-CARBON-PRICE-",
];

export function evidenceRequirementFor(fieldId: string, sourcePath?: string): EvidenceRequirementStatus {
  if (sourcePath?.startsWith("N/A - ")) {
    return "NOT_APPLICABLE_WITH_BASIS";
  }
  if (MANDATORY_PREFIXES.some((prefix) => fieldId === prefix || fieldId.startsWith(prefix))) {
    return "MANDATORY";
  }
  if (fieldId === "REG-PRECURSORS" || fieldId === "REG-CARBON-PRICE") {
    return "NOT_APPLICABLE_WITH_BASIS";
  }
  return "OPTIONAL";
}

export function buildRegistryEvidenceRequirements(
  fields: readonly RegistryTemplateFieldMapping[]
): RegistryEvidenceRequirement[] {
  return fields.map((field) => ({
    registryFieldId: field.registryFieldId,
    requirement: evidenceRequirementFor(field.registryFieldId),
    basis:
      field.sourcePath.startsWith("N/A - ")
        ? field.sourcePath.slice("N/A - ".length)
        : undefined,
  }));
}

export function findEvidenceGaps(
  fields: readonly RegistryTemplateFieldMapping[]
): EvidenceGapFinding[] {
  const findings: EvidenceGapFinding[] = [];
  for (const field of fields) {
    const requirement = evidenceRequirementFor(field.registryFieldId, field.sourcePath);
    if (requirement !== "MANDATORY") continue;
    if (field.evidenceIds.length > 0) continue;
    findings.push({
      findingId: `FND-EVIDENCE-GAP-${field.registryFieldId}`,
      severity: "P2",
      responsibleRole: "OPERATOR",
      category: "EVIDENCE_GAP",
      registryFieldId: field.registryFieldId,
      state: field.status,
      title: `Registry field ${field.registryFieldId} requires evidence and none is linked.`,
      closureCondition: `Link one or more approved evidence records to registry field ${field.registryFieldId}.`,
      targetDate: "NOT_YET_SET",
    });
  }
  return findings;
}

export function validateNotApplicableBasis(
  fields: readonly RegistryTemplateFieldMapping[]
): string[] {
  const errors: string[] = [];
  for (const field of fields) {
    if (evidenceRequirementFor(field.registryFieldId, field.sourcePath) !== "NOT_APPLICABLE_WITH_BASIS") continue;
    if (!field.sourcePath.startsWith("N/A - ")) {
      errors.push(`NOT_APPLICABLE_WITH_BASIS field ${field.registryFieldId} has no basis text`);
    }
  }
  return errors;
}
