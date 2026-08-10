/**
 * G-05 — component contract full parity.
 *
 * Three lists must match exactly: the sealed component contract
 * (requiredTopLevelComponents), the manifest file list (plus declared
 * exclusions) and every primary-document reference found in the delivered
 * documents. A document may never reference a deliverable that is not in the
 * package, and a claimed "N primary documents" count must equal reality.
 */
export interface ComponentContractInputs {
  readonly contract: readonly string[];
  readonly manifestFiles: readonly string[];
  readonly manifestExclusions: readonly string[];
  readonly documentReferences: readonly string[];
  readonly primaryDocumentCountClaim?: number;
  readonly primaryDocumentCountActual?: number;
}

export function validateComponentContractParity(
  inputs: ComponentContractInputs
): string[] {
  const errors: string[] = [];
  // The contract is the list of top-level sealed components. Nested package
  // files (Supporting_Evidence/README.txt, Supporting_Evidence/verify/cli.js)
  // belong to evidence and tooling, not to the component contract. A contract
  // entry ending in "/" is a directory component and is compared as-is.
  const contract = new Set(inputs.contract);
  const manifestTopLevel = new Set(
    inputs.manifestFiles.filter(
      (component) => contract.has(component) || !component.includes("/")
    )
  );
  const exclusions = new Set(inputs.manifestExclusions);

  const missingFromManifest = [...contract].filter((component) => !manifestTopLevel.has(component));
  if (missingFromManifest.length > 0) {
    errors.push(`contract components missing from manifest: ${missingFromManifest.join(", ")}`);
  }

  const unmanifested = [...manifestTopLevel].filter(
    (component) => !contract.has(component) && !exclusions.has(component)
  );
  if (unmanifested.length > 0) {
    errors.push(`manifest components missing from contract and not excluded: ${unmanifested.join(", ")}`);
  }

  const danglingReferences = [...new Set(inputs.documentReferences)].filter(
    (reference) => !contract.has(reference)
  );
  if (danglingReferences.length > 0) {
    errors.push(`document references with no package component: ${danglingReferences.join(", ")}`);
  }

  if (
    inputs.primaryDocumentCountClaim !== undefined &&
    inputs.primaryDocumentCountActual !== undefined &&
    inputs.primaryDocumentCountClaim !== inputs.primaryDocumentCountActual
  ) {
    errors.push(
      `primary-document count claim ${inputs.primaryDocumentCountClaim} does not match actual ${inputs.primaryDocumentCountActual}`
    );
  }

  return errors;
}
