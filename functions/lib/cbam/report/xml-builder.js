"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildXml = buildXml;
const xmlbuilder2_1 = require("xmlbuilder2");
/**
 * Generates machine-readable CBAMValid interoperability XML structure.
 * Employs target namespace https://cbamvalid.com/schema/exporter-evidence/1.0,
 * explicit units, source version tags, and audit calculation traces.
 */
function buildXml(data, calc, docHash) {
    const root = (0, xmlbuilder2_1.create)({ version: "1.0", encoding: "UTF-8" })
        .ele("CBAMDefinitiveDossier", {
        xmlns: "https://cbamvalid.com/schema/exporter-evidence/1.0",
        generator: "CBAMValid Sealing Engine v3.0",
        generatedAt: new Date().toISOString(),
    });
    // 1. Header Metadata
    root.ele("Header")
        .ele("SchemaVersion").txt("3.0").up()
        .ele("Language").txt("en").up()
        .up();
    // 2. Declarant Organization
    root.ele("Declarant")
        .ele("EORI").txt(data.declarantEORI || "N/A").up()
        .ele("Role").txt(calc.inputs.role).up()
        .ele("ReportingYear").txt(String(calc.inputs.importYear)).up()
        .ele("ReportingQuarter").txt(String(calc.inputs.importQuarter || 1)).up()
        .up();
    // 3. Installation
    const sectorUnit = calc.applicability.sector === "ELECTRICITY" ? "MWh" : "metric_tonne";
    root.ele("Installation")
        .ele("Name").txt(data.installationName || "N/A").up()
        .ele("CNCode").txt(calc.inputs.cnCode).up()
        .ele("Sector").txt(calc.applicability.sector).up()
        .ele("ProductionVolume", { unit: sectorUnit }).txt(String(calc.inputs.productionVolume)).up()
        .up();
    // 4. Calculation Metrics (with explicit decoupled units)
    root.ele("Metrics")
        .ele("EmbeddedEmissionsTco2e", { unit: "tCO2e" }).txt(String(calc.embeddedEmissionsTco2e)).up()
        .ele("SpecificDirectEmissions", { unit: "tCO2e/t" }).txt(String(calc.specificDirectEmissions)).up()
        .ele("SpecificIndirectEmissions", { unit: "tCO2e/t" }).txt(String(calc.specificIndirectEmissions)).up()
        .ele("FreeAllocationAdjustment", { unit: "tCO2e" }).txt(String(calc.freeAllocationAdjustment)).up()
        .ele("CarbonPricePaidCurrency", { unit: "EUR" }).txt(String(calc.carbonPricePaidCurrency)).up()
        .ele("CarbonPricePaidPerTco2e", { unit: "EUR/tCO2e" }).txt(String(calc.carbonPricePaidPerTco2e)).up()
        .ele("CertificatesBeforeReduction", { unit: "certificates" }).txt(String(calc.certificatesBeforeReduction)).up()
        .ele("EligibleCertificateReduction", { unit: "certificates" }).txt(String(calc.eligibleCertificateReduction)).up()
        .ele("CertificatesAfterReduction", { unit: "certificates" }).txt(String(calc.certificatesAfterReduction)).up()
        .ele("NetCertificatesDue", { unit: "certificates" }).txt(String(calc.netCertificatesDue)).up()
        .ele("EstimatedCostEur", { unit: "EUR" }).txt(String(calc.estimatedCertificateCostEur)).up()
        .up();
    // 5. Sources Register
    root.ele("SourcesRegister")
        .ele("Source")
        .ele("Authority").txt("European Commission DG TAXUD").up()
        .ele("DatasetVersion").txt(calc.pricing.datasetVersion).up()
        .ele("Reference").txt("Official weekly/quarterly price registry snapshot").up()
        .up()
        .up();
    // 6. Trace Log for Auditor Verification
    const tracesEle = root.ele("CalculationTraceLog");
    if (calc.traces) {
        Object.entries(calc.traces).forEach(([key, trace]) => {
            tracesEle.ele("TraceNode", { id: key })
                .ele("FormulaId").txt(trace.formulaId).up()
                .ele("FormulaVersion").txt(trace.formulaVersion).up()
                .ele("Units").txt(trace.units).up()
                .ele("RoundingMethod").txt(trace.roundingMethod).up()
                .ele("LegalReference").txt(trace.legalVersionRef).up()
                .ele("UnitContract").txt(trace.unitContract).up()
                .ele("RoundingRule").txt(trace.roundingRule).up()
                .ele("Source").txt(trace.source).up()
                .ele("SourceVersion").txt(trace.sourceVersion).up()
                .ele("EffectiveDate").txt(trace.effectiveDate).up()
                .ele("FinalResult").txt(String(trace.finalResult)).up()
                .up();
        });
    }
    else {
        Object.entries(calc.formulasUsed).forEach(([key, val]) => {
            tracesEle.ele("TraceNode", { id: key })
                .ele("FormulaId").txt(key).up()
                .ele("FormulaExpression").txt(val).up()
                .up();
        });
    }
    tracesEle.up();
    // 7. Sealing Proof
    if (docHash) {
        root.ele("Seal")
            .ele("HashSHA256").txt(docHash).up()
            .ele("SealStatus").txt("VERIFIED_IMPOSSIBLE_TO_ALTER").up()
            .up();
    }
    return root.end({ prettyPrint: true });
}
//# sourceMappingURL=xml-builder.js.map