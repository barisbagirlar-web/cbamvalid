import { describe, expect, it } from "vitest";
import {
  AuditReadyCaseSchema,
  ProductionProcessRecordSchema,
  SourceStreamRecordSchema,
  EmissionSourceRecordSchema,
  MeterRegisterRecordSchema,
} from "../../lib/cbam/schema";
import { createBlankCaseDraft, createNewCaseDraft } from "../../lib/cbam/new-case";
import { runQualityControls } from "../../lib/cbam/validation/quality-controls";
import { auditReadyCaseToRawCaseInput } from "../../functions/src/cbam/report/to-raw-case-input";
import { createVerifierGradeCase } from "../fixtures/verifier-grade-case";
import { buildChapterPayloadsFromDossier } from "../../src/dossier/50-model/chapter-payloads";
import { assembleDossier } from "../../src/dossier/50-model/assembleDossier";

describe("INT-002/INT-003 monitoring registers", () => {
  it("accepts empty draft defaults and rejects invalid schema shapes", () => {
    const blank = createBlankCaseDraft("owner-draft");
    expect(blank.productionProcesses).toEqual([]);
    expect(blank.sourceStreamRegister).toEqual([]);
    expect(blank.emissionSourceRegister).toEqual([]);
    expect(blank.meterRegister).toEqual([]);

    const illustrative = createNewCaseDraft("owner-scenario");
    expect(illustrative.productionProcesses).toEqual([]);
    expect(illustrative.meterRegister).toEqual([]);

    expect(() =>
      ProductionProcessRecordSchema.parse({
        processId: "",
        name: "x",
      })
    ).toThrow();

    expect(() =>
      SourceStreamRecordSchema.parse({
        streamId: "S1",
        name: "Fuel",
        category: "UNKNOWN",
        instrumentId: "M1",
      })
    ).toThrow();

    expect(() =>
      EmissionSourceRecordSchema.parse({
        sourceId: "E1",
        name: "Stack",
        gas: "CH4",
      })
    ).toThrow();

    expect(() =>
      MeterRegisterRecordSchema.parse({
        meterId: "M1",
        description: "Fuel meter",
        meterType: "PRESSURE",
      })
    ).toThrow();
  });

  it("blocks missing monitoring data and accepts independent complete fixture values", () => {
    const incomplete = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    incomplete.productionProcesses = [];
    incomplete.sourceStreamRegister = [];
    incomplete.emissionSourceRegister = [];
    incomplete.meterRegister = [];
    const blockers = runQualityControls(incomplete).filter((item) => item.status === "BLOCKER");
    expect(blockers.some((item) => item.ruleId === "QC_13")).toBe(true);
    expect(blockers.some((item) => item.ruleId === "QC_14")).toBe(true);
    expect(blockers.some((item) => item.ruleId === "QC_15")).toBe(true);
    expect(blockers.some((item) => item.ruleId === "QC_16")).toBe(true);

    const complete = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    const completeBlockers = runQualityControls(complete).filter((item) => item.status === "BLOCKER");
    expect(completeBlockers).toEqual([]);
    expect(complete.meterRegister.map((meter) => meter.meterId)).toEqual([
      "TEST-METER-FUEL-001",
      "TEST-METER-EL-001",
    ]);
  });

  it("propagates exact case monitoring data into RawCaseInput without inventing processes", () => {
    const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    const raw = auditReadyCaseToRawCaseInput(caseData);

    expect(raw.productionProcesses).toHaveLength(1);
    expect(raw.productionProcesses[0]).toMatchObject({
      processId: "PROC-BF-BOF-001",
      name: "Blast furnace / BOF integrated steelmaking",
      attributedDirectTco2e: "80",
      attributedIndirectTco2e: "40",
      producedGoodIndexes: [0, 1],
    });
    expect(raw.goods[0]?.processId).toBe("PROC-BF-BOF-001");
    expect(raw.goods[1]?.processId).toBe("PROC-BF-BOF-001");
    expect(JSON.stringify(raw)).not.toContain("IMPLICIT_INSTALLATION");
  });

  it("maps exact operator registers into chapter payloads and omits synthetic meter IDs when absent", () => {
    const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    const raw = auditReadyCaseToRawCaseInput(caseData);
    const model = assembleDossier(raw, {
      evidenceDimensionScore01: 0.9,
      chapterNonEmpty: {
        EVIDENCE: true,
        SCOPE_METHODOLOGY: true,
        DATA_QUALITY_UNCERTAINTY: true,
      },
      signOffsComplete: true,
    });

    const payloads = buildChapterPayloadsFromDossier(model, {
      systemBoundary: caseData.installation.systemBoundaries,
      sourceStreams: caseData.sourceStreamRegister,
      emissionSources: caseData.emissionSourceRegister,
      meters: caseData.meterRegister.map((meter) => ({
        id: meter.meterId,
        calibrationValidity: meter.calibrationValidityEnd,
        evidenceId: meter.calibrationEvidenceId,
      })),
    });

    expect(payloads["E-02"].sourceStreams).toEqual(caseData.sourceStreamRegister);
    expect(payloads["E-02"].emissionSources).toEqual(caseData.emissionSourceRegister);
    expect(payloads["E-03"].meters).toEqual(
      caseData.meterRegister.map((meter) => ({
        id: meter.meterId,
        calibrationValidity: meter.calibrationValidityEnd,
        evidenceId: meter.calibrationEvidenceId,
      }))
    );
    expect(JSON.stringify(payloads["E-06"].processes)).toContain("PROC-BF-BOF-001");
    expect(JSON.stringify(payloads["E-06"].processes)).not.toContain("IMPLICIT_INSTALLATION");
  });

  it("preserves monitoring registers through schema save/reopen parse", () => {
    const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    caseData.meterRegister[0].description = "Operator-edited fuel meter label";
    caseData.sourceStreamRegister[0].achievedUncertaintyPercent = "1.1";

    const reopened = AuditReadyCaseSchema.parse(JSON.parse(JSON.stringify(caseData)));
    expect(reopened.meterRegister[0].description).toBe("Operator-edited fuel meter label");
    expect(reopened.sourceStreamRegister[0].achievedUncertaintyPercent).toBe("1.1");
    expect(reopened.productionProcesses[0].processId).toBe("PROC-BF-BOF-001");
  });

  it("blocks boundary and invalid evidence states for calibration linkage", () => {
    const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    caseData.meterRegister[0].maximumPermissibleUncertaintyPercent = "100";
    caseData.meterRegister[0].achievedUncertaintyPercent = "100";
    expect(runQualityControls(caseData).find((item) => item.ruleId === "QC_16")?.status).toBe("PASS");

    caseData.meterRegister[0].achievedUncertaintyPercent = "100.1";
    expect(runQualityControls(caseData).some((item) => item.ruleId.startsWith("QC_16") && item.status === "BLOCKER")).toBe(true);

    const pendingEvidence = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    const calibration = pendingEvidence.evidenceRegister.find((item) => item.evidenceId === pendingEvidence.meterRegister[0].calibrationEvidenceId);
    if (!calibration) throw new Error("calibration evidence missing");
    calibration.reviewStatus = "PENDING";
    calibration.supportStatus = "PENDING";
    expect(runQualityControls(pendingEvidence).some((item) => item.ruleId.startsWith("QC_16") && item.status === "BLOCKER")).toBe(true);
  });

  it("keeps production seal path free of synthetic meter identifiers", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const sealSource = fs.readFileSync(
      path.join(process.cwd(), "functions/src/cbam/report/seal-service.ts"),
      "utf8"
    );
    expect(sealSource).not.toContain("TEST-METER-FUEL-001");
    expect(sealSource).not.toContain("TEST-METER-EL-001");
    expect(sealSource).not.toContain("Test-complete instrumentation");
    expect(sealSource).not.toContain("Blast furnace / process stack");
    expect(sealSource).toContain("caseData.sourceStreamRegister");
    expect(sealSource).toContain("caseData.meterRegister");
    expect(sealSource).toContain("caseData.emissionSourceRegister");
  });
});
