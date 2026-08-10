/**
 * Mandatory case set (mandate §7) — every release must produce the expected
 * state for all seven cases. CASE-G is fail-closed: a package is never
 * produced for an adversarial case.
 */
import { describe, expect, it } from "vitest";
import { performDossierCalculations } from "../../functions/src/cbam/calculator";
import { buildRegistryTemplateMapping } from "../../functions/src/cbam/registry/registry-template-mapping";
import { validateNotApplicableBasis } from "../../functions/src/cbam/report/v6/evidence-gap";
import { createFourDossierCase } from "../fixtures/four-dossiers";
import { buildV6Package, buildV6PackageFromCase } from "./gate-helpers";

describe("mandatory case set", () => {
  it("CASE-A-PERIOD-OPEN → ON_TRACK_PERIOD_OPEN with a high data score", async () => {
    const built = await buildV6Package("CEMENT_EG", "2026-09-15T00:00:00.000Z");
    expect(built.scores.periodEnded).toBe(false);
    expect(built.state).toBe("ON_TRACK_PERIOD_OPEN");
    expect(built.scores.dataEvidenceReadiness).toBeGreaterThanOrEqual(90);
  });

  it("CASE-B-PERIOD-CLOSED-CLEAN → READY_FOR_INDEPENDENT_VERIFICATION", async () => {
    const built = await buildV6Package("ALU_CN", "2027-01-31T00:00:00.000Z");
    expect(built.scores.periodEnded).toBe(true);
    expect(built.state).toBe("READY_FOR_INDEPENDENT_VERIFICATION");
  });

  it("CASE-C-EVIDENCE-GAPS → ACTION_REQUIRED with at least 8 findings", async () => {
    const caseData = createFourDossierCase("CEMENT_EG");
    const stripPaths = [
      "exporterIdentity.legalName",
      "installation.name",
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
    const strip = (datum: { evidenceId?: string }) => {
      datum.evidenceId = undefined;
    };
    strip(caseData.exporterIdentity.legalName);
    strip(caseData.installation.name);
    strip(caseData.reportingPeriod.year);
    strip(caseData.reportingPeriod.startDate!);
    strip(caseData.reportingPeriod.endDate!);
    strip(caseData.goods[0]!.cnCode);
    strip(caseData.goods[0]!.productionVolume);
    strip(caseData.goods[0]!.allocationShare!);
    strip(caseData.directEmissions);
    strip(caseData.electricityConsumed);
    strip(caseData.gridEmissionFactor);
    caseData.evidenceRegister = caseData.evidenceRegister.map((record) => ({
      ...record,
      linkedInputs: record.linkedInputs.filter((path) => !stripPaths.includes(path)),
    }));

    const built = await buildV6PackageFromCase(caseData, "2027-01-31T00:00:00.000Z");
    expect(built.state).toBe("ACTION_REQUIRED");
    expect(built.masterRecordModel.evidenceGaps.length).toBeGreaterThanOrEqual(8);
    expect(
      built.masterRecordModel.evidenceGaps.every((finding) => finding.findingId.startsWith("FND-EVIDENCE-GAP-"))
    ).toBe(true);
  });

  it("CASE-D-NO-PRECURSOR → empty precursor register carries a basis and no empty table", async () => {
    const built = await buildV6Package("FERTILISER_TR");
    const mapping = buildRegistryTemplateMapping(built.caseData, "2027-01-31T00:00:00.000Z");
    const precursorField = mapping.find((field) => field.registryFieldId === "REG-PRECURSORS");
    expect(precursorField?.status).toBe("NOT_APPLICABLE_WITH_BASIS");
    expect(precursorField?.sourcePath.startsWith("N/A - ")).toBe(true);
    expect(validateNotApplicableBasis(mapping)).toEqual([]);
    expect(built.caseData.precursors).toHaveLength(0);
  });

  it("CASE-E-MULTI-PRECURSOR → 3 precursors and 4 goods reconcile with allocation delta 0", async () => {
    const caseData = createFourDossierCase("STEEL_IN");
    caseData.goods = caseData.goods.slice(0, 4).map((good, index) => ({
      ...good,
      cnCode: { ...good.cnCode, value: `7207${1000 + index}` },
      productionVolume: { ...good.productionVolume, value: String(100000 + index * 10000) },
      allocationShare: { ...good.allocationShare!, value: "0.25" },
    }));
    while (caseData.goods.length < 4) {
      const index = caseData.goods.length;
      caseData.goods.push({
        cnCode: { value: `7207${1000 + index}`, sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED", documentReference: "Ref", measurementMethod: "Method", responsiblePerson: "Person" },
        sector: "IRON_AND_STEEL",
        productionVolume: { value: String(100000 + index * 10000), canonicalUnit: "t", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED", documentReference: "Ref", measurementMethod: "Method", responsiblePerson: "Person" },
        shipmentRecords: { value: "Reconciled production ledger line", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED", documentReference: "Ref", measurementMethod: "Method", responsiblePerson: "Person" },
        allocationShare: { value: "0.25", canonicalUnit: "fraction", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED", documentReference: "Ref", measurementMethod: "Method", responsiblePerson: "Person" },
      });
    }
    caseData.precursors = ["HBI", "Scrap substitute", "Ferroalloy"].map((name, index) => ({
      name: { value: name, sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED", documentReference: "Ref", measurementMethod: "Method", responsiblePerson: "Person" },
      quantity: { value: String(30000 + index * 5000), canonicalUnit: "t", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED", documentReference: "Ref", measurementMethod: "Method", responsiblePerson: "Person" },
      directEmissions: { value: String(20000 + index * 5000), canonicalUnit: "tCO2e", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED", documentReference: "Ref", measurementMethod: "Method", responsiblePerson: "Person" },
      indirectEmissions: { value: String(5000 + index * 1000), canonicalUnit: "tCO2e", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED", documentReference: "Ref", measurementMethod: "Method", responsiblePerson: "Person" },
      countryOfOrigin: { value: "TR", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED", documentReference: "Ref", measurementMethod: "Method", responsiblePerson: "Person" },
    }));

    const built = await buildV6PackageFromCase(caseData, "2027-01-31T00:00:00.000Z");
    expect(built.calculation.goods).toHaveLength(4);
    expect(built.model.totals.allocationShareTotal).toBe("1");
    expect(built.model.totals.allocationReconciliationDelta).toBe("0");
  });

  it("CASE-F-CARBON-PRICE-PAID → deduction record and evidence are populated", async () => {
    const built = await buildV6Package("STEEL_IN");
    expect(built.caseData.carbonPriceRecords.length).toBeGreaterThan(0);
    expect(built.caseData.carbonPriceRecords[0]!.proofOfPaymentEvidenceId?.length).toBeGreaterThan(0);
    const mapping = buildRegistryTemplateMapping(built.caseData, "2027-01-31T00:00:00.000Z");
    const carbonField = mapping.find((field) => field.registryFieldId === "REG-CARBON-PRICE-0");
    expect(carbonField?.evidenceIds.length).toBeGreaterThan(0);
    expect(built.model.totals.eligibleCertificateReduction).toBe("150000");
  });

  it("CASE-G-ADVERSARIAL → clear error, no package is produced", () => {
    const caseData = createFourDossierCase("STEEL_IN");
    caseData.goods[0]!.productionVolume = { ...caseData.goods[0]!.productionVolume!, value: "0" };
    expect(() => performDossierCalculations(caseData)).toThrow(/CALCULATION_PRODUCTION_VOLUME_REQUIRED/);

    const negative = createFourDossierCase("STEEL_IN");
    negative.directEmissions = { ...negative.directEmissions!, value: "-100" };
    expect(() => performDossierCalculations(negative)).toThrow(/CALCULATION_NEGATIVE_INPUT/);
  });
});
