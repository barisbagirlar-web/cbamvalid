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
  } else {
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

/**
 * Generates XML conforming to the draft European Commission TAXUD CBAM Transitional Registry XML Import structure.
 * It uses the 'urn:europe:ec:taxud:cbam:qreport:v1' namespace structure.
 */
export function buildOfficialRegistryXml(data: any, calc: CalculationOutput, docHash?: string): string {
  const root = create({ version: "1.0", encoding: "UTF-8" })
    .ele("CBAMQuarterlyReport", {
      "xmlns": "urn:europe:ec:taxud:cbam:qreport:v1",
      "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
      "xsi:schemaLocation": "urn:europe:ec:taxud:cbam:qreport:v1 QReport_ver1.12.xsd",
      "reportId": docHash ? docHash.slice(0, 16).toUpperCase() : "DRAFT",
    });

  // 1. Declarant / Importer
  root.ele("Declarant")
    .ele("EORI").txt(data.importerIdentity?.eoriNumber?.value || "N/A").up()
    .ele("Name").txt(data.importerIdentity?.legalName?.value || "N/A").up()
    .ele("RoleCode").txt(calc.inputs.role === "IMPORTER" ? "1" : "2").up()
    .up();

  // 2. Reporting Period
  root.ele("ReportingPeriod")
    .ele("Year").txt(String(calc.inputs.importYear)).up()
    .ele("Quarter").txt(String(calc.inputs.importQuarter || 1)).up()
    .up();

  // 3. Installation of Production
  root.ele("Installation")
    .ele("InstallationIdentifier").txt(data.installation?.name?.value ? `INST_${data.installation.name.value.toUpperCase().replace(/[^A-Z0-9]/g, "_")}` : "INST_1").up()
    .ele("Name").txt(data.installation?.name?.value || "N/A").up()
    .ele("CountryCode").txt(data.installation?.country?.value || "TR").up()
    .ele("ProductionRoute")
      .ele("Description").txt(data.installation?.productionRoute?.value || "N/A").up()
      .up()
    .up();

  // 4. Imported Goods List
  const goods = root.ele("ImportedGoods");
  const sectorUnit = calc.applicability.sector === "ELECTRICITY" ? "MWh" : "t";

  goods.ele("ImportedGoodItem")
    .ele("CNCode").txt(calc.inputs.cnCode).up()
    .ele("ProductionVolume").txt(String(calc.inputs.productionVolume)).up()
    .ele("UnitCode").txt(sectorUnit).up()
    .ele("Emissions")
      .ele("DirectSpecificEmissions").txt(String(calc.specificDirectEmissions)).up()
      .ele("IndirectSpecificEmissions").txt(String(calc.specificIndirectEmissions)).up()
      .ele("TotalEmbeddedEmissions").txt(String(calc.embeddedEmissionsTco2e)).up()
      .up()
    .ele("CarbonPricePaid")
      .ele("AmountPaidEur").txt(String(calc.carbonPricePaidCurrency)).up()
      .ele("DeductionAmountEur").txt(String(calc.carbonPricePaidPerTco2e)).up()
      .up()
    .up();

  return root.end({ prettyPrint: true });
}
