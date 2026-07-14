"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCsvDossier = buildCsvDossier;
function buildCsvDossier(caseData, calcResult) {
    // Cross-format parity: matching XML and JSON precisely
    // The CSV provides a flat projection of the same data structure
    var _a, _b, _c;
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
        ((_a = caseData.goods[0]) === null || _a === void 0 ? void 0 : _a.cnCode.value) || "",
        ((_b = calcResult.applicability) === null || _b === void 0 ? void 0 : _b.sector) || "",
        ((_c = calcResult.applicability) === null || _c === void 0 ? void 0 : _c.isApplicable) ? "APPLICABLE" : "EXEMPT",
        calcResult.totalEmbeddedEmissions || "0",
        calcResult.specificDirectEmissions || "0",
        calcResult.specificIndirectEmissions || "0",
        calcResult.netCertificatesDue || "0",
        calcResult.estimatedCertificateCostEur || "0"
    ];
    // Basic CSV escaping
    const escapeCsv = (str) => {
        const s = String(str);
        if (s.includes(",") || s.includes('"') || s.includes("\n")) {
            return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
    };
    return `${headers.join(",")}\n${row.map(escapeCsv).join(",")}\n`;
}
//# sourceMappingURL=csv-builder.js.map