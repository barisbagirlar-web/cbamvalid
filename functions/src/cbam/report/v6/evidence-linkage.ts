/**
 * G-07 / INV-06 — evidence linkage integrity.
 *
 * An evidence item may be linked only to fields inside its declared
 * supportedFields, and may be linked to a calculation node only when it
 * directly evidences one of that node's inputs. Every link carries a
 * supportType. Cartesian linkage is forbidden.
 */
export type SupportType = "DIRECTLY_EVIDENCES" | "CORROBORATES" | "CONTEXTUAL";

export interface EvidenceLink {
  readonly evidenceId: string;
  readonly linkedField: string;
  readonly supportType?: SupportType;
}

export interface CalculationNodeInput {
  readonly nodeId: string;
  readonly inputPaths: readonly string[];
}

export interface EvidenceLinkageInputs {
  readonly links: readonly EvidenceLink[];
  readonly supportedFieldsByEvidence: Readonly<Record<string, readonly string[]>>;
  readonly calculationNodes?: readonly CalculationNodeInput[];
}

export function resolveSupportType(evidenceId: string, linkedField: string, supportedFields: readonly string[]): SupportType {
  if (supportedFields.includes(linkedField)) return "DIRECTLY_EVIDENCES";
  if (supportedFields.some((field) => linkedField.startsWith(`${field}.`) || field.startsWith(`${linkedField}.`))) {
    return "CORROBORATES";
  }
  return "CONTEXTUAL";
}

export function validateEvidenceLinkage(inputs: EvidenceLinkageInputs): string[] {
  const errors: string[] = [];
  const nodeInputsByNode = new Map(
    (inputs.calculationNodes ?? []).map((node) => [node.nodeId, node.inputPaths])
  );
  const supportedByEvidence = inputs.supportedFieldsByEvidence;

  for (const link of inputs.links) {
    const supportedFields = supportedByEvidence[link.evidenceId] ?? [];
    const isFieldLink =
      link.linkedField.startsWith("goods.") ||
      link.linkedField.startsWith("directEmissions") ||
      link.linkedField.startsWith("electricityConsumed") ||
      link.linkedField.startsWith("gridEmissionFactor") ||
      link.linkedField.startsWith("precursors.") ||
      link.linkedField.startsWith("installation.") ||
      link.linkedField.startsWith("exporterIdentity.") ||
      link.linkedField.startsWith("importerIdentity.");

    if (isFieldLink && supportedFields.length > 0 && !supportedFields.some((field) => link.linkedField === field || link.linkedField.startsWith(`${field}.`))) {
      errors.push(`evidence ${link.evidenceId} links field ${link.linkedField} outside its supportedFields`);
    }

    if (!link.supportType) {
      errors.push(`evidence ${link.evidenceId} link ${link.linkedField} has no supportType`);
    }

    if (nodeInputsByNode.has(link.linkedField)) {
      const inputPaths = nodeInputsByNode.get(link.linkedField)!;
      const supportedInput = supportedFields.find((field) => inputPaths.includes(field));
      if (!supportedInput) {
        errors.push(`evidence ${link.evidenceId} links calculation node ${link.linkedField} without supporting one of its inputs`);
      }
    }
  }

  const countsByEvidence = new Map<string, number>();
  for (const link of inputs.links) {
    countsByEvidence.set(link.evidenceId, (countsByEvidence.get(link.evidenceId) ?? 0) + 1);
  }
  for (const [evidenceId, count] of countsByEvidence) {
    const supported = supportedByEvidence[evidenceId] ?? [];
    if (count > supported.length && supported.length > 0) {
      errors.push(`evidence ${evidenceId} links ${count} targets but declares only ${supported.length} supported fields`);
    }
  }

  return errors;
}
