/**
 * G-22 — currency and unit consistency.
 *
 * Every monetary field must use an allowed ISO 4217 currency and every emission
 * field must carry the tCO2e unit family on its canonical unit. The checker is
 * run over all four sealable dossier fixtures.
 *
 * Evidence: artifacts/gates/G-22/currency-unit-consistency-report.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createFourDossierCase, type FourDossierKey } from "../fixtures/four-dossiers";
import {
  ALLOWED_CURRENCIES,
  EMISSION_CANONICAL_UNITS,
  assertCurrencyUnitConsistency,
  isAllowedCurrency,
} from "../../functions/src/cbam/report/v6/currency-units";

const ARTIFACT_DIR = join(process.cwd(), "artifacts", "gates", "G-22");
const KEYS: FourDossierKey[] = ["STEEL_IN", "CEMENT_EG", "ALU_CN", "FERTILISER_TR"];

const report: Array<{ caseKey: string; findings: string[] }> = [];

describe("G-22 currency-unit-consistency", () => {
  it("defines the allowed currency set", () => {
    expect(ALLOWED_CURRENCIES).toEqual(["EUR", "USD", "GBP", "TRY"]);
    for (const currency of ALLOWED_CURRENCIES) expect(isAllowedCurrency(currency)).toBe(true);
    expect(isAllowedCurrency("INR")).toBe(false);
  });

  it("accepts tCO2e-family canonical units for emission fields", () => {
    expect(EMISSION_CANONICAL_UNITS.has("tCO2e")).toBe(true);
    expect(EMISSION_CANONICAL_UNITS.has("tCO2e/MWh")).toBe(true);
    expect(EMISSION_CANONICAL_UNITS.has("kgCO2e")).toBe(false);
  });

  for (const key of KEYS) {
    it(`finds no currency/unit inconsistency in the ${key} fixture`, () => {
      const caseData = createFourDossierCase(key);
      const findings = assertCurrencyUnitConsistency(caseData);
      expect(findings).toEqual([]);
      report.push({ caseKey: key, findings: findings.map((finding) => finding.message) });
    });
  }

  it("flags an out-of-set currency", () => {
    const caseData = createFourDossierCase("STEEL_IN");
    const findings = assertCurrencyUnitConsistency({
      ...caseData,
      carbonPriceRecords: caseData.carbonPriceRecords.map((record, index) =>
        index === 0 ? { ...record, currency: "INR" as never } : record
      ),
    });
    expect(findings.some((finding) => finding.path === "carbonPriceRecords[0].currency")).toBe(true);
  });

  it("flags an emission field with a non-emission canonical unit", () => {
    const caseData = createFourDossierCase("CEMENT_EG");
    const findings = assertCurrencyUnitConsistency({
      ...caseData,
      directEmissions: { ...caseData.directEmissions, canonicalUnit: "kgCO2e" },
    });
    expect(findings.some((finding) => finding.path === "directEmissions.canonicalUnit")).toBe(true);
  });

  it("writes the G-22 evidence artifact", () => {
    mkdirSync(ARTIFACT_DIR, { recursive: true });
    writeFileSync(
      join(ARTIFACT_DIR, "currency-unit-consistency-report.json"),
      JSON.stringify(
        {
          allowedCurrencies: ALLOWED_CURRENCIES,
          emissionCanonicalUnits: [...EMISSION_CANONICAL_UNITS],
          fixtures: report,
          allClean: report.every((entry) => entry.findings.length === 0),
        },
        null,
        2
      )
    );
    expect(report.every((entry) => entry.findings.length === 0)).toBe(true);
  });
});
