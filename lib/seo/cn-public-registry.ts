import { resolveCNCodeScope } from "@/lib/cbam/regulatory/cn-scope-dataset";
import type { CbamCnPublicEntry, CbamSector } from "./types";

const STAGE1_LASTMOD = "2026-07-26";

const SECTOR_PRODUCER_DATA: Record<CbamSector, readonly string[]> = {
  STEEL: [
    "Installation identity and production route",
    "Activity data for fuels, reductants and process materials",
    "Direct emissions measurement or calculation basis",
    "Electricity consumption for indirect emissions where required",
    "Precursor quantities and embedded emissions where applicable",
  ],
  ALUMINIUM: [
    "Installation identity and electrolysis/production route",
    "Anode and process material activity data",
    "Direct process and combustion emissions basis",
    "Electricity consumption for indirect emissions",
    "Precursor aluminium inputs where applicable",
  ],
  CEMENT: [
    "Clinker and cement production quantities",
    "Raw meal and fuel activity data",
    "Process and combustion direct emissions basis",
    "Electricity consumption for indirect emissions",
    "Clinker precursor treatment where applicable",
  ],
  FERTILIZER: [
    "Product and intermediate production quantities",
    "Fuel and feedstock activity data",
    "Direct process emissions basis",
    "Electricity consumption for indirect emissions",
    "Precursor chemical inputs where applicable",
  ],
  HYDROGEN: [
    "Hydrogen production quantity and route",
    "Feedstock and fuel activity data",
    "Direct emissions basis for the production process",
    "Electricity consumption for indirect emissions where required",
  ],
  ELECTRICITY: [
    "Exported electricity quantity",
    "Generation technology and fuel mix evidence",
    "Direct emissions basis for generation",
    "Applicable emission factor methodology",
  ],
};

const SECTOR_EVIDENCE: Record<CbamSector, readonly string[]> = {
  STEEL: [
    "Metering and laboratory records supporting activity data",
    "Production logs reconciled to reporting-period totals",
    "Evidence for precursor embedded emissions where claimed",
  ],
  ALUMINIUM: [
    "Smelter/process operating records",
    "Electricity invoices or meter extracts",
    "Precursor evidence where aluminium inputs are used",
  ],
  CEMENT: [
    "Kiln fuel and raw-material records",
    "Clinker/cement production reconciliations",
    "Calibration evidence for key meters",
  ],
  FERTILIZER: [
    "Process feedstock and production records",
    "Emission measurement or stoichiometric calculation files",
    "Supplier declarations for precursors where used",
  ],
  HYDROGEN: [
    "Production and purity records",
    "Feedstock measurement evidence",
    "Route-specific methodology decision record",
  ],
  ELECTRICITY: [
    "Generation meter extracts",
    "Fuel or technology evidence supporting the emission factor path",
    "Export/settlement records for the reporting period",
  ],
};

const SECTOR_ROUTES: Record<CbamSector, readonly string[]> = {
  STEEL: ["Blast furnace / basic oxygen", "Electric arc furnace", "Direct reduction (where applicable)"],
  ALUMINIUM: ["Primary electrolysis", "Recycling / remelting (where applicable)"],
  CEMENT: ["Dry process clinker kiln", "Integrated cement grinding"],
  FERTILIZER: ["Ammonia synthesis route", "Nitric acid / nitrogenous fertiliser route"],
  HYDROGEN: ["Steam reforming", "Electrolysis (where applicable)"],
  ELECTRICITY: ["Combustion generation", "Other generation technologies as evidenced"],
};

/** Specific CN descriptions where the official dataset only stores a chapter/heading prefix. */
const SPECIFIC_DESCRIPTIONS: Record<string, string> = {
  "72011011":
    "Non-alloy pig iron containing by weight 0.5% or less of phosphorus, in lumps, pellets or similar forms",
  "72085120":
    "Flat-rolled products of iron or non-alloy steel, not in coils, not further worked than hot-rolled, of a thickness exceeding 10 mm",
  "76011000": "Aluminium, not alloyed, unwrought",
  "25231000": "Cement clinkers",
  "25232900": "Portland cement (excluding white Portland cement)",
  "31021010": "Urea, whether or not in aqueous solution",
  "28080000": "Nitric acid; sulphonitric acids",
  "28041000": "Hydrogen",
  "27160000": "Electrical energy",
};

/**
 * Stage-1 public CN pages only. Quantity is not a quota — membership is explicit.
 * Prefix-only chapter acceptance is intentionally rejected by indexability.ts.
 */
const STAGE1_CODES = [
  "72011011",
  "72085120",
  "76011000",
  "25231000",
  "25232900",
  "31021010",
  "28080000",
  "28041000",
  "27160000",
] as const;

function buildEntry(cnCode: string): CbamCnPublicEntry {
  const scope = resolveCNCodeScope(cnCode);
  if (!scope.inScope || !scope.record) {
    throw new Error(`CN public registry: ${cnCode} is not in official CBAM scope dataset`);
  }
  const sector = scope.record.sector;
  const description = SPECIFIC_DESCRIPTIONS[cnCode] ?? scope.record.description;
  return {
    cnCode,
    description,
    sector,
    effectiveFrom: scope.record.effectiveDate,
    legalSourceId: "REG_2023_956",
    productionRoutes: SECTOR_ROUTES[sector],
    publicPageEligible: true,
    requiredProducerData: SECTOR_PRODUCER_DATA[sector],
    evidenceConsiderations: SECTOR_EVIDENCE[sector],
    factualLastModified: STAGE1_LASTMOD,
  };
}

export const CN_PUBLIC_REGISTRY: readonly CbamCnPublicEntry[] = STAGE1_CODES.map(buildEntry);

const BY_CODE = new Map(CN_PUBLIC_REGISTRY.map((entry) => [entry.cnCode, entry]));

export function getPublicCnEntry(cnCode: string): CbamCnPublicEntry | undefined {
  return BY_CODE.get(cnCode.replace(/\s+/g, ""));
}

export function listIndexablePublicCnEntries(): readonly CbamCnPublicEntry[] {
  return CN_PUBLIC_REGISTRY.filter((entry) => entry.publicPageEligible);
}

export function listPublicCnCodes(): readonly string[] {
  return CN_PUBLIC_REGISTRY.map((entry) => entry.cnCode);
}
