/**
 * L1 — normalize RawCaseInput → CanonicalCase (immutable, unit-typed).
 * PURE relative to wall-clock: no Date.now().
 */
import { Decimal } from "../00-schema/units";
import { parseRawCaseInput, type RawCaseInput, type ReportingPeriod } from "../00-schema/case.schema";
import { getSectorRule, type CbamSector, type SectorRule } from "../01-ruleset/sectors.rules";
import { resolveCn } from "../01-ruleset/cn.registry";
import { assessOrigin, type OriginScope } from "../01-ruleset/origin.rules";
import {
  fraction,
  mwh,
  tco2e,
  tco2ePerMWh,
  tonne,
  type Fraction,
  type MWh,
  type TCO2e,
  type TCO2ePerMWh,
  type Tonne,
} from "../00-schema/units";

export interface CanonicalGood {
  readonly index: number;
  readonly cnCode: string;
  readonly sector: CbamSector;
  readonly sectorRule: SectorRule;
  readonly netMass: Tonne;
  readonly allocationShare: Fraction | null;
  readonly allocationJustification: string | null;
  readonly processId: string | null;
}

export interface CanonicalProcess {
  readonly processId: string;
  readonly name: string;
  readonly annexIiDefinition: string | null;
  readonly producedGoodIndexes: readonly number[];
  readonly attributedDirect: TCO2e | null;
  readonly attributedIndirect: TCO2e | null;
}

export interface CanonicalSignOff {
  readonly role: "OPERATOR_PREPARER" | "INTERNAL_REVIEWER" | "DATA_OWNER";
  readonly name: string;
  readonly title: string;
  readonly signedAt: string;
}

export interface CanonicalCase {
  readonly caseId: string;
  readonly operatorLegalName: string;
  readonly installationName: string;
  readonly installationCountry: string;
  readonly originScope: OriginScope;
  readonly reportingPeriod: ReportingPeriod;
  readonly directEmissions: TCO2e;
  readonly electricity: MWh;
  readonly gridFactor: TCO2ePerMWh;
  readonly goods: readonly CanonicalGood[];
  readonly productionProcesses: readonly CanonicalProcess[];
  readonly signOffs: readonly CanonicalSignOff[];
  readonly evidenceIds: readonly string[];
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
  }
  return value;
}

export function normalizeCase(input: unknown): CanonicalCase {
  const raw: RawCaseInput = parseRawCaseInput(input);
  const originScope = assessOrigin(raw.installationCountry);

  const goods: CanonicalGood[] = raw.goods.map((g, index) => {
    const cn = resolveCn(g.cnCode);
    if (!cn.inScope || !cn.sector) {
      throw new Error(`CN_OUT_OF_SCOPE_OR_MALFORMED:${g.cnCode}:${cn.reason}`);
    }
    const sectorRule = getSectorRule(g.sector || cn.sector);
    if (g.sector && g.sector !== cn.sector && getSectorRule(g.sector).sector !== cn.sector) {
      // Allow explicit sector if it matches CN family; otherwise fail closed on mismatch of annex behaviour
      if (sectorRule.annexII !== cn.sectorRule!.annexII) {
        throw new Error(`CN_SECTOR_ANNEX_MISMATCH:${g.cnCode}:${g.sector}:${cn.sector}`);
      }
    }
    const share =
      g.allocationShare !== undefined && g.allocationShare !== ""
        ? fraction(g.allocationShare)
        : null;
    if (share !== null && (!g.allocationJustification || !g.allocationJustification.trim())) {
      throw new Error("SIMPLIFIED_ALLOCATION_JUSTIFICATION_REQUIRED");
    }
    return {
      index,
      cnCode: cn.cnCode,
      sector: sectorRule.sector,
      sectorRule,
      netMass: tonne(g.netMassTonnes),
      allocationShare: share,
      allocationJustification: g.allocationJustification?.trim() || null,
      processId: g.processId ?? null,
    };
  });

  const shareSum = goods.reduce((acc, g) => {
    if (g.allocationShare === null) return acc;
    return acc.plus(g.allocationShare);
  }, new Decimal(0));
  const anyShare = goods.some((g) => g.allocationShare !== null);
  if (anyShare && shareSum.minus(1).abs().gt(new Decimal("0.000001"))) {
    throw new Error(`ALLOCATION_SHARE_SUM_NOT_ONE:${shareSum.toString()}`);
  }

  const productionProcesses: CanonicalProcess[] = raw.productionProcesses.map((p) => ({
    processId: p.processId,
    name: p.name,
    annexIiDefinition: p.annexIiDefinition ?? null,
    producedGoodIndexes: p.producedGoodIndexes,
    attributedDirect:
      p.attributedDirectTco2e !== undefined ? tco2e(p.attributedDirectTco2e) : null,
    attributedIndirect:
      p.attributedIndirectTco2e !== undefined ? tco2e(p.attributedIndirectTco2e) : null,
  }));

  const canonical: CanonicalCase = {
    caseId: raw.caseId,
    operatorLegalName: raw.operatorLegalName,
    installationName: raw.installationName,
    installationCountry: raw.installationCountry,
    originScope,
    reportingPeriod: raw.reportingPeriod,
    directEmissions: tco2e(raw.directEmissionsTco2e),
    electricity: mwh(raw.electricityMwh),
    gridFactor: tco2ePerMWh(raw.gridFactorTco2ePerMwh),
    goods,
    productionProcesses,
    signOffs: raw.signOffs,
    evidenceIds: raw.evidenceIds,
  };

  return deepFreeze(canonical);
}
