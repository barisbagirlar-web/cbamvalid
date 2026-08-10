/**
 * G-22 — currency and unit consistency.
 *
 * SectorCalc's ALLOWED_CURRENCIES pattern is carried into CBAMValid and
 * extended: only the defined ISO 4217 currencies are accepted for monetary
 * fields, and every emission field must carry the tCO2e unit family on the
 * canonical unit (with any raw-unit divergence recorded in `conversions`).
 */
import type { AuditReadyCase, CarbonPricePaidRecord, InputDatum } from "../../schema";

export const ALLOWED_CURRENCIES = ["EUR", "USD", "GBP", "TRY"] as const;
export type AllowedCurrency = (typeof ALLOWED_CURRENCIES)[number];

export const EMISSION_CANONICAL_UNITS = new Set(["tCO2e", "tCO2e/MWh"]);

export interface CurrencyUnitFinding {
  readonly path: string;
  readonly message: string;
}

/** Emission-bearing datum paths within an audit-ready case. */
const EMISSION_DATUM_PATHS = [
  "directEmissions",
  "gridEmissionFactor",
] as const;

export function isAllowedCurrency(currency: string): boolean {
  return (ALLOWED_CURRENCIES as readonly string[]).includes(currency);
}

function checkCurrency(record: CarbonPricePaidRecord, index: number, findings: CurrencyUnitFinding[]): void {
  if (!isAllowedCurrency(record.currency)) {
    findings.push({
      path: `carbonPriceRecords[${index}].currency`,
      message: `Currency not in ALLOWED_CURRENCIES (${ALLOWED_CURRENCIES.join(", ")}): ${record.currency}`,
    });
  }
}

function checkEmissionDatum(
  path: string,
  datum: InputDatum | undefined,
  findings: CurrencyUnitFinding[]
): void {
  if (!datum) return;
  const canonicalUnit = datum.canonicalUnit ?? datum.unit;
  if (!canonicalUnit) {
    findings.push({
      path,
      message: "Emission field has no canonical unit (tCO2e family required)",
    });
    return;
  }
  if (!EMISSION_CANONICAL_UNITS.has(canonicalUnit)) {
    findings.push({
      path: `${path}.canonicalUnit`,
      message: `Emission field uses non-emission unit: ${canonicalUnit}`,
    });
  }
  if (datum.rawUnit && datum.rawUnit !== canonicalUnit && !datum.unit) {
    // A divergent raw unit must be recorded in conversions; the schema keeps
    // that in the calculation trace. Without it the value is ambiguous.
    findings.push({
      path: `${path}.rawUnit`,
      message: `Raw unit ${datum.rawUnit} diverges from canonical unit ${canonicalUnit} with no conversions record`,
    });
  }
}

/**
 * Returns every currency/unit inconsistency in a case. The mandate gate
 * requires an empty result for all sealable cases.
 */
export function assertCurrencyUnitConsistency(caseData: AuditReadyCase): CurrencyUnitFinding[] {
  const findings: CurrencyUnitFinding[] = [];
  for (const [index, record] of caseData.carbonPriceRecords.entries()) {
    checkCurrency(record, index, findings);
  }
  for (const path of EMISSION_DATUM_PATHS) {
    checkEmissionDatum(path, caseData[path] as InputDatum | undefined, findings);
  }
  for (const [index, precursor] of caseData.precursors.entries()) {
    checkEmissionDatum(`precursors[${index}].directEmissions`, precursor.directEmissions, findings);
    checkEmissionDatum(`precursors[${index}].indirectEmissions`, precursor.indirectEmissions, findings);
  }
  return findings;
}
