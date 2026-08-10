/**
 * G-08 — automatic evidence-gap findings. D-07.
 *
 * Every MANDATORY registry field without linked evidence produces exactly one
 * FND-EVIDENCE-GAP-<FIELD_ID> finding (severity P2, responsible OPERATOR). No
 * MANDATORY field without evidence can be reported COMPLETE_*; NOT_APPLICABLE_WITH_BASIS
 * fields must carry a basis. The D-07 reference defect (8+ fields with
 * Evidence: NONE yet reported complete) must produce at least 8 new findings.
 *
 * Evidence: gap report on the D-07 case under artifacts/gates/G-08/.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AuditReadyCase } from "../../functions/src/cbam/schema";
import { buildRegistryTemplateMapping } from "../../functions/src/cbam/registry/registry-template-mapping";
import { findEvidenceGaps, validateNotApplicableBasis, evidenceRequirementFor } from "../../functions/src/cbam/report/v6/evidence-gap";
import { createFourDossierCase } from "../fixtures/four-dossiers";

const ARTIFACT_DIR = join(process.cwd(), "artifacts", "gates", "G-08");

const STRIP_INPUT_PATHS = [
  "exporterIdentity.legalName",
  "installation.name",
  "installation.systemBoundaries",
  "reportingPeriod.year",
  "reportingPeriod.startDate",
  "reportingPeriod.endDate",
  "goods.0.cnCode",
  "goods.0.productionVolume",
  "goods.0.allocationShare",
  "directEmissions",
  "electricityConsumed",
  "gridEmissionFactor",
];

function stripEvidenceIds(caseData: AuditReadyCase): void {
  const strip = (datum: { evidenceId?: string } | null | undefined) => {
    if (datum) datum.evidenceId = undefined;
  };
  strip(caseData.exporterIdentity.legalName);
  strip(caseData.exporterIdentity.registrationNumber);
  strip(caseData.exporterIdentity.address);
  strip(caseData.exporterIdentity.exporterCountry);
  strip(caseData.installation.name);
  strip(caseData.installation.monitoringPlanId);
  strip(caseData.reportingPeriod.year);
  strip(caseData.reportingPeriod.startDate);
  strip(caseData.reportingPeriod.endDate);
  for (const good of caseData.goods) {
    strip(good.cnCode);
    strip(good.productionVolume);
    strip(good.allocationShare);
  }
  strip(caseData.directEmissions);
  strip(caseData.electricityConsumed);
  strip(caseData.gridEmissionFactor);
  caseData.evidenceRegister = caseData.evidenceRegister.map((record) => ({
    ...record,
    linkedInputs: record.linkedInputs.filter((path) => !STRIP_INPUT_PATHS.includes(path)),
  }));
}

describe("G-08 registry.evidence-gap", () => {
  it("produces exactly one FND-EVIDENCE-GAP finding per MANDATORY field without evidence", () => {
    const caseData = createFourDossierCase("CEMENT_EG");
    stripEvidenceIds(caseData);

    const mapping = buildRegistryTemplateMapping(caseData, "2027-01-31T00:00:00.000Z");
    const mandatoryWithoutEvidence = mapping.filter(
      (field) =>
        evidenceRequirementFor(field.registryFieldId, field.sourcePath) === "MANDATORY" &&
        field.evidenceIds.length === 0
    );
    const findings = findEvidenceGaps(mapping);
    const findingIds = new Set(findings.map((finding) => finding.findingId));

    expect(mandatoryWithoutEvidence.length).toBeGreaterThanOrEqual(8);
    expect(findings.length).toBe(mandatoryWithoutEvidence.length);
    for (const field of mandatoryWithoutEvidence) {
      expect(findingIds.has(`FND-EVIDENCE-GAP-${field.registryFieldId}`)).toBe(true);
    }
    for (const finding of findings) {
      expect(finding.severity).toBe("P2");
      expect(finding.responsibleRole).toBe("OPERATOR");
    }

    // No MANDATORY field without evidence may be reported COMPLETE_*.
    const completeWithoutEvidence = mandatoryWithoutEvidence.filter((field) => field.status.startsWith("COMPLETE_"));
    expect(completeWithoutEvidence.length).toBe(0);

    // NOT_APPLICABLE_WITH_BASIS fields always carry a basis.
    const basisErrors = validateNotApplicableBasis(mapping);
    expect(basisErrors).toEqual([]);

    mkdirSync(ARTIFACT_DIR, { recursive: true });
    writeFileSync(
      join(ARTIFACT_DIR, "evidence-gap-report.json"),
      JSON.stringify(
        {
          mandatoryWithoutEvidence: mandatoryWithoutEvidence.map((field) => ({ id: field.registryFieldId, status: field.status })),
          findings,
          completeWithoutEvidenceCount: completeWithoutEvidence.length,
          basisErrors,
        },
        null,
        2
      )
    );
  });

  it("produces zero evidence-gap findings for a fully evidenced case", () => {
    const caseData = createFourDossierCase("ALU_CN");
    const mapping = buildRegistryTemplateMapping(caseData, "2027-01-31T00:00:00.000Z");
    expect(findEvidenceGaps(mapping)).toEqual([]);
    expect(validateNotApplicableBasis(mapping)).toEqual([]);
  });
});
