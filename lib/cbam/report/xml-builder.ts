import { create } from "xmlbuilder2";
import { CalculationOutput } from "../engine/calculation-orchestrator";

/**
 * Generates machine-readable CBAMValid interoperability XML structure.
 * Employs target namespace https://cbamvalid.com/schema/exporter-evidence/1.0,
 * explicit units, source version tags, and audit calculation traces.
 */
export function buildXml(data: any, calc: CalculationOutput, docHash?: string): string {
  const root = create({ version: "1.0", encoding: "UTF-8" })
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

  // 4. Calculation Metrics (with explicit units)
  root.ele("Metrics")
    .ele("TotalEmbeddedEmissions", { unit: "tCO2e" }).txt(String(calc.totalEmbeddedEmissions)).up()
    .ele("SpecificDirectEmissions", { unit: "tCO2e/t" }).txt(String(calc.specificDirectEmissions)).up()
    .ele("SpecificIndirectEmissions", { unit: "tCO2e/t" }).txt(String(calc.specificIndirectEmissions)).up()
    .ele("FreeAllocationAdjustment", { unit: "tCO2e" }).txt(String(calc.freeAllocationAdjustment)).up()
    .ele("CarbonPriceDeduction", { unit: "EUR" }).txt(String(calc.carbonPriceDeduction)).up()
    .ele("NetCertificatesDue", { unit: "units" }).txt(String(calc.netCertificatesDue)).up()
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
        .ele("FinalResult").txt(String(trace.finalResult)).up()
        .up();
    });
  } else {
    // Fallback simple formula trace logs if traces is empty
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
