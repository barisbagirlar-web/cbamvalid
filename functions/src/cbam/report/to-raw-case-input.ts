/**
 * Bridge AuditReadyCase → RawCaseInput for L0→L6 dossier engine.
 * Maps only operator-provided case fields. Does not invent emission values,
 * processes, meters, or monitoring instrumentation.
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

  const processByGoodIndex = new Map<number, string>();
  for (const process of caseData.productionProcesses || []) {
    for (const goodIndex of process.producedGoodIndexes || []) {
      if (!processByGoodIndex.has(goodIndex)) {
        processByGoodIndex.set(goodIndex, process.processId);
      }
    }
  }

  const goods = caseData.goods.map((g, index) => {
    const share = g.allocationShare?.value;
    const processId = processByGoodIndex.get(index);
    const base = {
      cnCode: datum(g.cnCode?.value),
      sector: String(g.sector || ""),
      netMassTonnes: datum(g.productionVolume?.value),
      ...(processId ? { processId } : {}),
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

  const productionProcesses = (caseData.productionProcesses || []).map((process) => {
    const direct = datum(process.attributedDirectTco2e);
    const indirect = datum(process.attributedIndirectTco2e);
    return {
      processId: datum(process.processId),
      name: datum(process.name),
      ...(process.annexIiDefinition?.trim()
        ? { annexIiDefinition: process.annexIiDefinition.trim() }
        : {}),
      producedGoodIndexes: [...(process.producedGoodIndexes || [])],
      ...(direct ? { attributedDirectTco2e: direct } : {}),
      ...(indirect ? { attributedIndirectTco2e: indirect } : {}),
    };
  });

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
    productionProcesses,
    signOffs,
    evidenceIds,
  };
}
