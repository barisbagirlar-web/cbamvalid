/**
 * Bridge AuditReadyCase → RawCaseInput for L0→L6 dossier engine.
 * Does not invent emission values; throws when required fields missing.
 */
import type { AuditReadyCase } from "../schema";
import type { RawCaseInput } from "../../dossier/00-schema/case.schema";

function datum(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function auditReadyCaseToRawCaseInput(caseData: AuditReadyCase): RawCaseInput {
  const year = Number(caseData.reportingPeriod?.year?.value);
  if (!Number.isFinite(year)) throw new Error("RAW_CASE_REPORTING_YEAR_REQUIRED");

  const quarterRaw = datum(caseData.reportingPeriod?.quarter?.value);
  const reportingPeriod =
    quarterRaw && /^[1-4]$/.test(quarterRaw)
      ? {
          type: "QUARTERLY" as const,
          year,
          quarter: Number(quarterRaw) as 1 | 2 | 3 | 4,
        }
      : { type: "DEFINITIVE_ANNUAL" as const, year };

  const goods = caseData.goods.map((g) => {
    const share = g.allocationShare?.value;
    const base = {
      cnCode: datum(g.cnCode?.value),
      sector: String(g.sector || ""),
      netMassTonnes: datum(g.productionVolume?.value),
    };
    if (share === null || share === undefined || String(share).trim() === "") {
      return base;
    }
    return {
      ...base,
      allocationShare: String(share),
      allocationJustification:
        "Operator-declared allocation share recorded on the case (simplified allocation pending process-level attribution).",
    };
  });

  const evidenceIds = (caseData.evidenceRegister || []).map((e) => String(e.evidenceId));
  const signOffs = (caseData.operatorSignOffs || []).map((s) => ({
    role: s.role,
    name: datum(s.name),
    title: datum(s.title),
    signedAt: datum(s.signedAt),
  }));

  return {
    caseId: String(caseData.caseId || ""),
    operatorLegalName: datum(caseData.exporterIdentity?.legalName?.value),
    installationName: datum(caseData.installation?.name?.value),
    installationCountry: datum(caseData.installation?.country?.value).toUpperCase(),
    reportingPeriod,
    directEmissionsTco2e: datum(caseData.directEmissions?.value),
    electricityMwh: datum(caseData.electricityConsumed?.value),
    gridFactorTco2ePerMwh: datum(caseData.gridEmissionFactor?.value),
    goods,
    productionProcesses: [],
    signOffs,
    evidenceIds,
  };
}
