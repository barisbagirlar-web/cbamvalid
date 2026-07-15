"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildWorkbook = buildWorkbook;
/**
 * Builds a multi-sheet spreadsheet workbook and returns it as a Buffer
 */
function buildWorkbook(data, calc) {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1" />
    </Style>
  </Styles>
  `;
    const tabs = [
        {
            name: "README",
            rows: [
                ["CBAM Definitive-Period Cost & Emissions Workbook"],
                ["This workbook contains calculation trace records locked by the sealing service."],
                ["Document Hash:", calc.pricing.datasetVersion],
            ],
        },
        {
            name: "DECLARANT",
            rows: [
                ["Declarant EORI", data.declarantEORI || "N/A"],
                ["Role", calc.inputs.role],
                ["Import Year", calc.inputs.importYear],
            ],
        },
        {
            name: "IMPORT_LINES",
            rows: [
                ["CN Code", "Installation", "Volume", "Unit"],
                [calc.inputs.cnCode, data.installationName, calc.inputs.productionVolume, calc.applicability.sector === "ELECTRICITY" ? "MWh" : "t"],
            ],
        },
        {
            name: "CN_SCOPE",
            rows: [
                ["Chapter", "Sector", "Applicable"],
                [calc.applicability.chapter, calc.applicability.sector, calc.applicability.isApplicable ? "Yes" : "No"],
            ],
        },
        {
            name: "INSTALLATIONS",
            rows: [
                ["Installation Name", "Operator"],
                [data.installationName, "Operator Legal Name"],
            ],
        },
        {
            name: "PRODUCTION_ROUTES",
            rows: [
                ["Route Name", "Process boundaries"],
                ["Standard Process Route", "Default boundaries"],
            ],
        },
        {
            name: "PRECURSORS",
            rows: [
                ["Has Precursors", "Direct Emissions", "Indirect Emissions"],
                [data.isComplexGood ? "Yes" : "No", calc.inputs.precursorDirectEmissionsInput || 0, calc.inputs.precursorIndirectEmissionsInput || 0],
            ],
        },
        {
            name: "ACTUAL_EMISSIONS",
            rows: [
                ["Source", "Direct Input", "Indirect Input"],
                [calc.pathway.pathway, calc.inputs.directEmissionsInput || 0, calc.inputs.electricityConsumedInput || 0],
            ],
        },
        {
            name: "DEFAULT_VALUES",
            rows: [
                ["Sector", "Direct Factor", "Indirect Factor"],
                [calc.applicability.sector, calc.specificDirectEmissions, calc.specificIndirectEmissions],
            ],
        },
        {
            name: "BENCHMARKS",
            rows: [
                ["Sector", "Benchmark Factor", "Deduction"],
                [calc.applicability.sector, "5%", calc.freeAllocationAdjustment],
            ],
        },
        {
            name: "CARBON_PRICE_PAID",
            rows: [
                ["Price Paid Per Tonne", "Deduction Amount"],
                [calc.inputs.carbonPricePaidInput || 0, calc.carbonPriceDeduction],
            ],
        },
        {
            name: "CERTIFICATE_PRICES",
            rows: [
                ["Price EUR", "Cadence", "State"],
                [calc.pricing.priceEurPerTonne, calc.pricing.cadence, calc.pricing.state],
            ],
        },
        {
            name: "CALCULATION_TRACE",
            rows: [
                ["Formula ID", "Formula", "Result"],
                ["totalEmbedded", calc.formulasUsed.totalEmbedded, calc.totalEmbeddedEmissions],
                ["netCertificates", calc.formulasUsed.netCertificates, calc.netCertificatesDue],
                ["cost", calc.formulasUsed.cost, calc.estimatedCertificateCostEur],
            ],
        },
        {
            name: "DATA_GAPS",
            rows: [
                ["Completeness Score", "Missing Data Check"],
                [calc.dataCompletenessScore, calc.pathway.remediationMessage || "None"],
            ],
        },
        {
            name: "SOURCE_REGISTER",
            rows: [
                ["Source Name", "Reference URL"],
                ["EU CBAM Regulation", "https://eur-lex.europa.eu/"],
            ],
        },
    ];
    for (const tab of tabs) {
        xml += `  <Worksheet ss:Name="${tab.name}">
    <Table>
    `;
        for (const row of tab.rows) {
            xml += `      <Row>
      `;
            for (const cell of row) {
                const type = typeof cell === "number" ? "Number" : "String";
                xml += `        <Cell><Data ss:Type="${type}">${cell}</Data></Cell>
        `;
            }
            xml += `      </Row>
      `;
        }
        xml += `    </Table>
  </Worksheet>
  `;
    }
    xml += `</Workbook>`;
    return Buffer.from(xml, "utf8");
}
//# sourceMappingURL=workbook-builder.js.map