import { AuditReadyCase } from "../schema";


export function buildCsvDossier(caseData: AuditReadyCase, calcResult: any): string {
  // Cross-format parity: matching XML and JSON precisely
  // The CSV provides a flat projection of the same data structure
  
  const headers = [
    "CaseId",
    "Version",
    "Status",
    "DeclarantEORI",
    "ImportYear",
    "CNCode",
    "Sector",
    "ApplicabilityStatus",
    "TotalEmbeddedEmissions_tCO2e",
    "SpecificDirectEmissions_tCO2e_unit",
    "SpecificIndirectEmissions_tCO2e_unit",
    "NetCertificatesDue",
    "EstimatedCertificateCostEur"
  ];

  const row = [
    caseData.caseId || "",
    caseData.version || "1",
    "SEALED",
    caseData.importerIdentity.eoriNumber.value || "",
    caseData.reportingPeriod.year.value || "",
    caseData.goods[0]?.cnCode.value || "",
    calcResult.applicability?.sector || "",
    calcResult.applicability?.isApplicable ? "APPLICABLE" : "EXEMPT",
    calcResult.totalEmbeddedEmissions || "0",
    calcResult.specificDirectEmissions || "0",
    calcResult.specificIndirectEmissions || "0",
    calcResult.netCertificatesDue || "0",
    calcResult.estimatedCertificateCostEur || "0"
  ];

  // Basic CSV escaping
  const escapeCsv = (str: string | number) => {
    const s = String(str);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  return `${headers.join(",")}\n${row.map(escapeCsv).join(",")}\n`;
}
