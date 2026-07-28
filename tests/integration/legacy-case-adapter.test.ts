import { describe, expect, it } from "vitest";
import { AuditReadyCaseSchema } from "../../functions/src/cbam/schema";
import {
  adaptLegacyCaseData,
  isRecognizedLegacyCaseData,
} from "../../functions/src/cbam/storage/legacy-case-adapter";

const LEGACY_CASE = {
  exporterName: "Legacy Steel Exporter Ltd.",
  declarantEORI: "DE123456789012",
  importYear: 2026,
  importQuarter: 2,
  role: "IMPORTER",
  cnCode: "72085120",
  productionVolume: 300,
  shipmentRecordsCount: 4,
  installationName: "Legacy Izmir Steel Plant",
  productionRoute: "Electric arc furnace",
  hasActualData: true,
  directEmissions: 56788,
  electricityConsumed: 456,
  gridEmissionFactor: 4344,
  isComplexGood: true,
  precursorDirectEmissions: 12,
  precursorIndirectEmissions: 3,
  carbonPricePaid: 500,
  isVerified: false,
};

describe("legacy CBAM case compatibility", () => {
  it("recognizes the flat production schema without treating partial modern data as legacy", () => {
    expect(isRecognizedLegacyCaseData(LEGACY_CASE)).toBe(true);
    expect(isRecognizedLegacyCaseData({ directEmissions: { value: 1 } })).toBe(false);
  });

  it("maps every recoverable legacy value into a valid current case without changing scale", () => {
    const adapted = adaptLegacyCaseData({
      rawData: LEGACY_CASE,
      caseId: "case_legacySteel123",
      uid: "legacy_user_123",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-07-16T10:00:00.000Z",
    });

    expect(adapted).not.toBeNull();
    expect(() => AuditReadyCaseSchema.parse(adapted)).not.toThrow();
    expect(adapted?.exporterIdentity.legalName.value).toBe("Legacy Steel Exporter Ltd.");
    expect(adapted?.importerIdentity.eoriNumber.value).toBe("DE123456789012");
    expect(adapted?.reportingPeriod.quarter.value).toBe("Q2");
    expect(adapted?.goods[0]?.cnCode.value).toBe("72085120");
    expect(adapted?.goods[0]?.productionVolume.value).toBe(300);
    expect(adapted?.installation.name.value).toBe("Legacy Izmir Steel Plant");
    expect(adapted?.directEmissions.value).toBe(56788);
    expect(adapted?.electricityConsumed.value).toBe(456);
    expect(adapted?.gridEmissionFactor.value).toBe(4344);
    expect(adapted?.precursors[0]?.directEmissions.value).toBe(12);
    expect(adapted?.evidenceRegister).toEqual([]);
    expect(adapted?.carbonPriceRecords).toEqual([]);
    expect(adapted?.auditEvents[0]?.action).toBe("LEGACY_CASE_ADAPTED");
    expect(adapted?.auditEvents[0]?.metadata?.preservedLegacyValues).toMatchObject({
      carbonPricePaid: 500,
      role: "IMPORTER",
      hasActualData: true,
    });
  });

  it("returns null for unsupported corrupt records instead of inventing business data", () => {
    expect(adaptLegacyCaseData({
      rawData: { directEmissions: { value: 10 } },
      caseId: "case_corrupt123",
      uid: "legacy_user_123",
      createdAt: "invalid",
      updatedAt: "invalid",
    })).toBeNull();
  });
});
