import { describe, expect, it } from "vitest";
import { createFourDossierCase } from "../fixtures/four-dossiers";
import {
  summarizeStep8Actions,
  summarizeWizardCompletion,
  validateWizardStep,
} from "../../lib/cbam/wizard-validation";

describe("Step 8 readiness deduplication", () => {
  it("never marks the evidence step complete while material evidence is missing", () => {
    const caseData = createFourDossierCase("ALU_CN");
    caseData.evidenceRegister = [];

    const validation = validateWizardStep(7, caseData);

    expect(validation.missingEvidenceCount).toBeGreaterThan(0);
    expect(validation.state).toBe("NEEDS_DOCUMENTS");
    expect(validation.state).not.toBe("COMPLETE");
  });

  it("lists each missing evidence path once instead of duplicating Step 7 and Step 8 aggregation", () => {
    const caseData = createFourDossierCase("STEEL_IN");
    caseData.evidenceRegister = [];

    const actions = summarizeStep8Actions(caseData);
    const documents = actions.filter((item) => item.category === "Documents to upload");
    const documentPaths = documents.map((item) => item.fieldPath);

    expect(documentPaths.length).toBeGreaterThan(0);
    expect(new Set(documentPaths).size).toBe(documentPaths.length);
  });

  it("does not ask for evidence for a required value that is still missing", () => {
    const caseData = createFourDossierCase("STEEL_IN");
    caseData.importerIdentity.eoriNumber.value = "";
    caseData.evidenceRegister = [];

    const actions = summarizeStep8Actions(caseData);

    expect(actions.some(
      (item) =>
        item.category === "Required information" &&
        item.fieldPath === "importerIdentity.eoriNumber"
    )).toBe(true);
    expect(actions.some(
      (item) =>
        item.category === "Documents to upload" &&
        item.fieldPath === "importerIdentity.eoriNumber"
    )).toBe(false);
  });

  it("reports a unique evidence requirement count in the completion summary", () => {
    const caseData = createFourDossierCase("STEEL_IN");
    caseData.evidenceRegister = [];

    const summary = summarizeWizardCompletion(caseData);
    const actions = summarizeStep8Actions(caseData);
    const uniqueDocumentPaths = new Set(
      actions
        .filter((item) => item.category === "Documents to upload")
        .map((item) => item.fieldPath)
    );

    expect(summary.missingEvidence).toBeGreaterThan(0);
    expect(summary.missingEvidence).toBe(uniqueDocumentPaths.size);
  });
});
