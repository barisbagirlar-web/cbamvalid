import JSZip from "jszip";
import type { AuditReadyCase } from "../schema";
import type { DossierCalculationResult } from "../calculator";
import type { QualityControlResult } from "../validation/quality-controls";
import { buildVerifierPackageModel, type VerifierPackageModel } from "./verifier-model";

export type WorkbookCellValue = string | number | boolean | null | undefined;

type Cell = {
  value?: WorkbookCellValue;
  formula?: string;
  cachedValue?: WorkbookCellValue;
  style?: number;
  hyperlink?: string;
};

type Sheet = {
  name: string;
  rows: Cell[][];
  widths: number[];
  freezeRows?: number;
  autoFilter?: string;
  statusColumn?: string;
  validationRanges?: Array<{ range: string; values: string[]; prompt: string }>;
  landscape?: boolean;
};

function xml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function columnName(index: number): string {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function safeSheetName(name: string): string {
  return name.replace(/[\\/*?:[\]]/g, "_").slice(0, 31) || "Sheet";
}

function c(value: WorkbookCellValue, style = 1, hyperlink?: string): Cell {
  return { value, style, hyperlink };
}

function f(formula: string, cachedValue: WorkbookCellValue, style = 11): Cell {
  return { formula, cachedValue, style };
}

function header(values: string[]): Cell[] {
  return values.map((value) => c(value, 3));
}

function title(value: string): Cell[] {
  return [c(value, 2)];
}

function statusStyle(status: string): number {
  if (["PASS", "DOCUMENTED", "ACCEPTED", "READY_FOR_INDEPENDENT_VERIFICATION"].includes(status)) return 5;
  if (["WARNING", "IN_REVIEW", "REVIEW_REQUIRED"].includes(status)) return 6;
  if (["BLOCKER", "GAP", "REJECTED", "BLOCKED_BEFORE_INDEPENDENT_VERIFICATION"].includes(status)) return 7;
  return 1;
}

function buildSheets(params: {
  caseData: AuditReadyCase;
  calculation: DossierCalculationResult;
  controls: QualityControlResult[];
  reportId: string;
  releaseVersion: number;
  generatedAt: string;
  model: VerifierPackageModel;
}): Sheet[] {
  const { caseData, calculation, controls, reportId, releaseVersion, generatedAt, model } = params;
  const qcLastRow = Math.max(2, controls.length + 1);
  const evidenceLastRow = Math.max(2, caseData.evidenceRegister.length + 1);
  const monitoringLastRow = Math.max(2, model.monitoringPlan.length + 1);

  return [
    {
      name: "README",
      widths: [34, 82, 28, 30],
      freezeRows: 1,
      rows: [
        title("CBAMValid — Independent Verification Preparation Workspace"),
        [c("Document classification", 4), c(model.documentClassification), c("Release", 4), c(releaseVersion, 8)],
        [c("Report ID", 4), c(reportId), c("Generated", 4), c(generatedAt)],
        [c("Case ID", 4), c(model.caseId), c("Ruleset", 4), c(`${model.ruleset.version} · ${model.ruleset.name}`)],
        [c("Automated readiness", 4), c(model.automatedReadiness, statusStyle(model.automatedReadiness)), c("Independent verifier status", 4), c(model.independentVerifierStatus, 6)],
        [c("Calculation root hash", 4), c(model.calculationRootHash), c("Source registry hash", 4), c(model.ruleset.sourceHash)],
        [c("Quality controls", 4), c("Calculated below"), c("Materiality rate", 4), c(`${model.ruleset.materialityRate}% per good`)],
        [c("Passed", 4), f('COUNTIF(QUALITY_CONTROLS!C:C,"PASS")', model.qualitySummary.passed), c("Blockers", 4), f('COUNTIF(QUALITY_CONTROLS!C:C,"BLOCKER")', model.qualitySummary.blockers)],
        [c("Warnings", 4), f('COUNTIF(QUALITY_CONTROLS!C:C,"WARNING")', model.qualitySummary.warnings), c("Monitoring-plan gaps", 4), f('COUNTIF(MONITORING_PLAN!C:C,"GAP")', model.monitoringPlan.filter((item) => item.status === "GAP").length)],
        [c("Evidence files", 4), f("COUNTA(EVIDENCE!A2:A1048576)", model.evidenceSummary.totalEvidenceFiles), c("Approved clean evidence", 4), c(model.evidenceSummary.approvedCleanEvidenceFiles, 8)],
        [c("Evidence coverage", 4), c(`${model.evidenceSummary.coverageRate}%`), c("Duplicate hashes", 4), c(model.evidenceSummary.duplicateHashCount, model.evidenceSummary.duplicateHashCount === 0 ? 5 : 7)],
        [c("Package boundary", 4), c(model.disclaimer)],
        [c("Instructions", 4), c("Review QUALITY_CONTROLS, MONITORING_PLAN, EVIDENCE, METHODS and CALCULATION_TRACE. Record independent conclusions only in VERIFIER_SIGN_OFF. Do not overwrite sealed source data.")],
      ],
    },
    {
      name: "CASE",
      widths: [32, 88, 32, 58],
      freezeRows: 1,
      autoFilter: "A1:D11",
      rows: [
        header(["Field", "Value", "Evidence / control", "Status"]),
        [c("Case ID"), c(model.caseId), c("Immutable snapshot"), c("SEALED", 5)],
        [c("Importer"), c(model.identity.importer), c("Corporate identity"), c(model.identity.importer ? "DOCUMENTED" : "GAP", statusStyle(model.identity.importer ? "DOCUMENTED" : "GAP"))],
        [c("EORI"), c(model.identity.eori), c(caseData.importerIdentity.eoriNumber.evidenceId), c(caseData.importerIdentity.eoriNumber.evidenceId ? "DOCUMENTED" : "GAP", statusStyle(caseData.importerIdentity.eoriNumber.evidenceId ? "DOCUMENTED" : "GAP"))],
        [c("Exporter / operator"), c(model.identity.exporterOperator), c("Operator identity"), c(model.identity.exporterOperator ? "DOCUMENTED" : "GAP", statusStyle(model.identity.exporterOperator ? "DOCUMENTED" : "GAP"))],
        [c("Installation"), c(model.identity.installation), c("Installation record"), c(model.identity.installation ? "DOCUMENTED" : "GAP", statusStyle(model.identity.installation ? "DOCUMENTED" : "GAP"))],
        [c("Country"), c(model.identity.country), c("Installation record"), c(model.identity.country ? "DOCUMENTED" : "GAP", statusStyle(model.identity.country ? "DOCUMENTED" : "GAP"))],
        [c("Production route"), c(model.identity.productionRoute), c("Monitoring plan"), c(model.identity.productionRoute ? "DOCUMENTED" : "GAP", statusStyle(model.identity.productionRoute ? "DOCUMENTED" : "GAP"))],
        [c("Reporting period"), c(model.identity.reportingPeriod), c("Definitive period"), c("DOCUMENTED", 5)],
        [c("System boundary"), c(model.identity.systemBoundary), c("Monitoring plan"), c(model.identity.systemBoundary ? "DOCUMENTED" : "GAP", statusStyle(model.identity.systemBoundary ? "DOCUMENTED" : "GAP"))],
      ],
      statusColumn: "D",
    },
    {
      name: "GOODS",
      widths: [9, 16, 24, 16, 12, 15, 20, 20, 17, 20, 35],
      freezeRows: 1,
      autoFilter: `A1:K${Math.max(2, model.goods.length + 1)}`,
      landscape: true,
      rows: [
        header(["Index", "CN code", "Sector", "Production", "Unit", "Allocation share", "Allocated tCO2e", "Specific tCO2e/t", "Materiality %", "Materiality tCO2e/t", "Trace ID"]),
        ...model.goods.map((good) => [
          c(good.goodIndex, 8), c(good.cnCode), c(good.sector), c(Number(good.productionVolume), 8), c(good.productionUnit),
          c(Number(good.allocationShare), 8), c(Number(good.allocatedEmbeddedEmissions), 8), c(Number(good.specificEmbeddedEmissions), 8),
          c(Number(good.materialityRate), 8), c(Number(good.materialityThresholdSpecific), 8), c(good.traceCalculationId),
        ]),
      ],
    },
    {
      name: "EMISSIONS_SUMMARY",
      widths: [42, 24, 20, 70],
      freezeRows: 1,
      autoFilter: "A1:D13",
      rows: [
        header(["Metric", "Value", "Unit", "Control identity"]),
        [c("Installation direct emissions"), c(Number(model.totals.installationDirectEmissions), 8), c("tCO2e"), c("CBAM_TOTAL_EMBEDDED_EMISSIONS")],
        [c("Electricity indirect emissions"), c(Number(model.totals.electricityIndirectEmissions), 8), c("tCO2e"), c("CBAM_INDIRECT_EMISSIONS")],
        [c("Precursor direct emissions"), c(Number(model.totals.precursorDirectEmissions), 8), c("tCO2e"), c("CBAM_PRECURSOR_EMISSIONS_SUM")],
        [c("Precursor indirect emissions"), c(Number(model.totals.precursorIndirectEmissions), 8), c("tCO2e"), c("CBAM_PRECURSOR_EMISSIONS_SUM")],
        [c("Total direct emissions"), c(Number(model.totals.totalDirectEmissions), 8), c("tCO2e"), c("Direct + precursor direct")],
        [c("Total indirect emissions"), c(Number(model.totals.totalIndirectEmissions), 8), c("tCO2e"), c("Electricity + precursor indirect")],
        [c("Total embedded emissions"), c(Number(model.totals.totalEmbeddedEmissions), 8), c("tCO2e"), c("Direct + indirect")],
        [c("Production volume"), c(Number(model.totals.productionVolume), 8), c("t"), c("Sum of good production")],
        [c("Aggregate specific embedded emissions"), c(Number(model.totals.aggregateSpecificEmbeddedEmissions), 8), c("tCO2e/t"), c("Aggregate diagnostic")],
        [c("Allocation share total"), c(Number(model.totals.allocationShareTotal), 8), c("fraction"), c("Expected 1")],
        [c("Allocation reconciliation delta"), c(Number(model.totals.allocationReconciliationDelta), 8), c("fraction"), c("Tolerance 0.000001")],
        [c("Eligible certificate reduction"), c(Number(model.totals.eligibleCertificateReduction), 8), c("certificate-equivalent"), c("Subject to evidence and applicable law")],
      ],
    },
    {
      name: "INPUTS",
      widths: [34, 20, 18, 20, 40, 30, 25],
      freezeRows: 1,
      autoFilter: "A1:G4",
      rows: [
        header(["Input", "Value", "Unit", "Source type", "Evidence ID", "Measurement method", "Responsible person"]),
        [c("Direct emissions"), c(caseData.directEmissions.value), c(caseData.directEmissions.canonicalUnit), c(caseData.directEmissions.sourceType), c(caseData.directEmissions.evidenceId), c(caseData.directEmissions.measurementMethod), c(caseData.directEmissions.responsiblePerson)],
        [c("Electricity consumed"), c(caseData.electricityConsumed.value), c(caseData.electricityConsumed.canonicalUnit), c(caseData.electricityConsumed.sourceType), c(caseData.electricityConsumed.evidenceId), c(caseData.electricityConsumed.measurementMethod), c(caseData.electricityConsumed.responsiblePerson)],
        [c("Grid emission factor"), c(caseData.gridEmissionFactor.value), c(caseData.gridEmissionFactor.canonicalUnit), c(caseData.gridEmissionFactor.sourceType), c(caseData.gridEmissionFactor.evidenceId), c(caseData.gridEmissionFactor.measurementMethod), c(caseData.gridEmissionFactor.responsiblePerson)],
      ],
    },
    {
      name: "PRECURSORS",
      widths: [9, 28, 18, 18, 14, 18, 18, 38],
      freezeRows: 1,
      autoFilter: `A1:H${Math.max(2, caseData.precursors.length + 1)}`,
      rows: [
        header(["Index", "Name", "Country", "Quantity", "Unit", "Direct tCO2e", "Indirect tCO2e", "Evidence links"]),
        ...caseData.precursors.map((item, index) => [c(index + 1, 8), c(item.name.value), c(item.countryOfOrigin.value), c(item.quantity.value), c(item.quantity.canonicalUnit), c(item.directEmissions.value), c(item.indirectEmissions.value), c([item.quantity.evidenceId, item.directEmissions.evidenceId, item.indirectEmissions.evidenceId].filter(Boolean).join(" | "))]),
      ],
    },
    {
      name: "EVIDENCE",
      widths: [38, 30, 45, 28, 16, 68, 14, 17, 20, 16, 48],
      freezeRows: 1,
      autoFilter: `A1:K${evidenceLastRow}`,
      statusColumn: "H",
      landscape: true,
      rows: [
        header(["Evidence ID", "Type", "File", "Issuer", "Issue date", "SHA-256", "Bytes", "Review", "Support", "Malware", "Linked inputs"]),
        ...caseData.evidenceRegister.map((item) => [c(item.evidenceId), c(item.documentType), c(item.fileName), c(item.issuer), c(item.issueDate), c(item.fileHash), c(item.sizeBytes, 8), c(item.reviewStatus, statusStyle(item.reviewStatus)), c(item.supportStatus, statusStyle(item.supportStatus)), c(item.malwareScanStatus, statusStyle(item.malwareScanStatus)), c(item.linkedInputs.join(" | "))]),
      ],
    },
    {
      name: "METHODS",
      widths: [38, 28, 48, 60, 68, 20, 30, 48],
      freezeRows: 1,
      autoFilter: `A1:H${Math.max(2, caseData.methodologyDecisions.length + 1)}`,
      statusColumn: "F",
      landscape: true,
      rows: [
        header(["Decision ID", "Topic", "Selected method", "Reason", "Legal / technical basis", "Review", "Ruleset", "Evidence IDs"]),
        ...caseData.methodologyDecisions.map((item) => [c(item.decisionId), c(item.topic), c(item.selectedMethod), c(item.reason), c(item.legalOrTechnicalBasis), c(item.reviewStatus, statusStyle(item.reviewStatus)), c(item.rulesetVersion), c(item.evidenceIds.join(" | "))]),
      ],
    },
    {
      name: "MONITORING_PLAN",
      widths: [15, 76, 18, 90],
      freezeRows: 1,
      autoFilter: `A1:D${monitoringLastRow}`,
      statusColumn: "C",
      landscape: true,
      rows: [
        header(["Requirement", "Definitive-period monitoring-plan element", "Status", "Evidence / basis"]),
        ...model.monitoringPlan.map((item) => [c(item.requirementId), c(item.requirement), c(item.status, statusStyle(item.status)), c(item.evidence)]),
      ],
    },
    {
      name: "QUALITY_CONTROLS",
      widths: [18, 48, 18, 78, 38],
      freezeRows: 1,
      autoFilter: `A1:E${qcLastRow}`,
      statusColumn: "C",
      landscape: true,
      rows: [
        header(["Rule", "Name", "Status", "Message", "Remediation"]),
        ...controls.map((item) => [c(item.ruleId), c(item.name), c(item.status, statusStyle(item.status)), c(item.message), c(item.remediationCode)]),
      ],
    },
    {
      name: "CALCULATION_TRACE",
      widths: [40, 42, 22, 18, 68, 58],
      freezeRows: 1,
      autoFilter: `A1:F${Math.max(2, calculation.trace.length + 1)}`,
      landscape: true,
      rows: [
        header(["Calculation ID", "Formula", "Output", "Unit", "SHA-256", "Warnings / assumptions"]),
        ...calculation.trace.map((item) => [c(item.calculationId), c(item.formulaId), c(item.outputValue), c(item.outputUnit), c(item.calculationHash), c([...item.warnings, ...item.assumptions].join(" | "))]),
      ],
    },
    {
      name: "CARBON_PRICE",
      widths: [38, 18, 22, 12, 20, 58, 38, 22],
      freezeRows: 1,
      autoFilter: `A1:H${Math.max(2, caseData.carbonPriceRecords.length + 1)}`,
      landscape: true,
      rows: [
        header(["Record ID", "Amount paid", "Applicable emissions", "Currency", "Period", "Legal reference", "Payment evidence", "Eligible reduction"]),
        ...caseData.carbonPriceRecords.map((item) => [c(item.id), c(item.amountPaid), c(item.applicableEmissions), c(item.currency), c(item.paymentPeriod), c(item.legislationReference), c(item.proofOfPaymentEvidenceId), c(item.eligibleCertificateReduction)]),
      ],
    },
    {
      name: "LEGAL_SOURCES",
      widths: [20, 18, 64, 74, 16, 16, 66],
      freezeRows: 1,
      autoFilter: `A1:G${model.legalSources.length + 1}`,
      landscape: true,
      rows: [
        header(["Source ID", "CELEX", "Title", "Official EUR-Lex", "Applies from", "Status", "Methodology scope"]),
        ...model.legalSources.map((item) => [c(item.id), c(item.celexId), c(item.title), c(item.eliUri, 9, item.eliUri), c(item.appliesFrom), c(item.legalStatus, 5), c(item.methodologyScope.join(" | "))]),
      ],
    },
    {
      name: "VERIFIER_SIGN_OFF",
      widths: [42, 70, 42, 68],
      freezeRows: 1,
      validationRanges: [
        { range: "B2", values: ["NOT_REVIEWED", "IN_REVIEW", "ACCEPTED", "REJECTED"], prompt: "Independent verifier review status" },
        { range: "B8", values: ["NO_OPINION", "SATISFACTORY", "SATISFACTORY_WITH_COMMENTS", "NOT_SATISFACTORY"], prompt: "Independent verification opinion" },
        { range: "D8", values: ["OPEN", "IN_PROGRESS", "CLOSED"], prompt: "Findings closure status" },
      ],
      rows: [
        header(["Verifier-controlled field", "Value", "Control", "Value"]),
        [c("Review status", 4), c("NOT_REVIEWED", 10), c("Package automated readiness", 4), c(model.automatedReadiness, statusStyle(model.automatedReadiness))],
        [c("Verifier legal entity", 4), c("", 10), c("Accreditation body", 4), c("", 10)],
        [c("Lead verifier", 4), c("", 10), c("Accreditation number", 4), c("", 10)],
        [c("Review start date", 4), c("", 10), c("Review completion date", 4), c("", 10)],
        [c("Physical / virtual site visit", 4), c("", 10), c("Site visit date", 4), c("", 10)],
        [c("Materiality rate", 4), c(`${model.ruleset.materialityRate}% per good`), c("Reasonable assurance", 4), c("NOT_ASSESSED", 10)],
        [c("Independent opinion", 4), c("NO_OPINION", 10), c("Findings closure", 4), c("OPEN", 10)],
        [c("Verifier conclusion", 4), c("", 10), c("Verifier signature reference", 4), c("", 10)],
        [c("Boundary notice", 4), c("CBAMValid does not populate or assert verifier-controlled fields. Completion requires an independent accredited verifier.")],
      ],
    },
  ];
}

function cellXml(cell: Cell, reference: string): string {
  const style = cell.style ?? 1;
  if (cell.formula) {
    const cached = cell.cachedValue === undefined || cell.cachedValue === null ? "" : String(cell.cachedValue);
    return `<c r="${reference}" s="${style}"><f>${xml(cell.formula)}</f><v>${xml(cached)}</v></c>`;
  }
  if (typeof cell.value === "number" && Number.isFinite(cell.value)) {
    return `<c r="${reference}" s="${style}"><v>${cell.value}</v></c>`;
  }
  if (typeof cell.value === "boolean") {
    return `<c r="${reference}" t="b" s="${style}"><v>${cell.value ? 1 : 0}</v></c>`;
  }
  return `<c r="${reference}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xml(cell.value)}</t></is></c>`;
}

function sheetXml(sheet: Sheet): { xml: string; relationships?: string } {
  const hyperlinks: Array<{ reference: string; relationshipId: string; target: string }> = [];
  const rows = sheet.rows.map((row, rowIndex) => {
    const cells = row.map((cell, columnIndex) => {
      const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
      if (cell.hyperlink) hyperlinks.push({ reference, relationshipId: `rId${hyperlinks.length + 1}`, target: cell.hyperlink });
      return cellXml(cell, reference);
    }).join("");
    return `<row r="${rowIndex + 1}"${rowIndex === 0 ? ' ht="24" customHeight="1"' : ""}>${cells}</row>`;
  }).join("");

  const columns = sheet.widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("");
  const freezeRows = sheet.freezeRows || 0;
  const pane = freezeRows > 0 ? `<pane ySplit="${freezeRows}" topLeftCell="A${freezeRows + 1}" activePane="bottomLeft" state="frozen"/>` : "";
  const autoFilter = sheet.autoFilter ? `<autoFilter ref="${sheet.autoFilter}"/>` : "";
  const hyperlinkXml = hyperlinks.length > 0 ? `<hyperlinks>${hyperlinks.map((item) => `<hyperlink ref="${item.reference}" r:id="${item.relationshipId}"/>`).join("")}</hyperlinks>` : "";
  const conditionalFormatting = sheet.statusColumn ? `<conditionalFormatting sqref="${sheet.statusColumn}2:${sheet.statusColumn}1048576"><cfRule type="containsText" dxfId="0" priority="1" operator="containsText" text="PASS"><formula>NOT(ISERROR(SEARCH("PASS",${sheet.statusColumn}2)))</formula></cfRule><cfRule type="containsText" dxfId="0" priority="2" operator="containsText" text="DOCUMENTED"><formula>NOT(ISERROR(SEARCH("DOCUMENTED",${sheet.statusColumn}2)))</formula></cfRule><cfRule type="containsText" dxfId="1" priority="3" operator="containsText" text="WARNING"><formula>NOT(ISERROR(SEARCH("WARNING",${sheet.statusColumn}2)))</formula></cfRule><cfRule type="containsText" dxfId="2" priority="4" operator="containsText" text="BLOCKER"><formula>NOT(ISERROR(SEARCH("BLOCKER",${sheet.statusColumn}2)))</formula></cfRule><cfRule type="containsText" dxfId="2" priority="5" operator="containsText" text="GAP"><formula>NOT(ISERROR(SEARCH("GAP",${sheet.statusColumn}2)))</formula></cfRule></conditionalFormatting>` : "";
  const validations = sheet.validationRanges?.length ? `<dataValidations count="${sheet.validationRanges.length}">${sheet.validationRanges.map((item) => `<dataValidation type="list" allowBlank="0" showInputMessage="1" showErrorMessage="1" errorStyle="stop" sqref="${item.range}" promptTitle="Controlled value" prompt="${xml(item.prompt)}" errorTitle="Invalid controlled value" error="Select a value from the approved list."><formula1>&quot;${xml(item.values.join(","))}&quot;</formula1></dataValidation>`).join("")}</dataValidations>` : "";

  const result = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="17"/><cols>${columns}</cols><sheetData>${rows}</sheetData>${autoFilter}${conditionalFormatting}${validations}${hyperlinkXml}<printOptions horizontalCentered="0" verticalCentered="0"/><pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="${sheet.landscape ? "landscape" : "portrait"}" fitToWidth="1" fitToHeight="0" paperSize="9"/></worksheet>`;
  const relationships = hyperlinks.length > 0 ? `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${hyperlinks.map((item) => `<Relationship Id="${item.relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xml(item.target)}" TargetMode="External"/>`).join("")}</Relationships>` : undefined;
  return { xml: result, relationships };
}

function stylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="0.000000"/><numFmt numFmtId="165" formatCode="0.00%"/></numFmts><fonts count="5"><font><sz val="10"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Aptos Display"/></font><font><b/><color rgb="FF142A4A"/><sz val="11"/><name val="Aptos Display"/></font><font><color rgb="FF0563C1"/><u/><sz val="10"/><name val="Aptos"/></font><font><b/><color rgb="FF142A4A"/><sz val="16"/><name val="Aptos Display"/></font></fonts><fills count="8"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4068"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE7EDF4"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDFF2E3"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF1CC"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFDE2E2"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF6F8FA"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FFD4DAE2"/></left><right style="thin"><color rgb="FFD4DAE2"/></right><top style="thin"><color rgb="FFD4DAE2"/></top><bottom style="thin"><color rgb="FFD4DAE2"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="12"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="4" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="5" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="6" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="7" borderId="1" xfId="0" applyProtection="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/><protection locked="0"/></xf><xf numFmtId="164" fontId="2" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="3"><dxf><fill><patternFill patternType="solid"><fgColor rgb="FFDFF2E3"/></patternFill></fill></dxf><dxf><fill><patternFill patternType="solid"><fgColor rgb="FFFFF1CC"/></patternFill></fill></dxf><dxf><fill><patternFill patternType="solid"><fgColor rgb="FFFDE2E2"/></patternFill></fill></dxf></dxfs><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/></styleSheet>`;
}

export async function buildVerifierWorkbook(params: {
  caseData: AuditReadyCase;
  calculation: DossierCalculationResult;
  controls: QualityControlResult[];
  reportId: string;
  releaseVersion: number;
  generatedAt: string;
  model?: VerifierPackageModel;
}): Promise<Buffer> {
  const model = params.model || buildVerifierPackageModel(params);
  const sheets = buildSheets({ ...params, model }).map((sheet) => ({ ...sheet, name: safeSheetName(sheet.name) }));
  if (new Set(sheets.map((sheet) => sheet.name)).size !== sheets.length) throw new Error("XLSX_DUPLICATE_SHEET_NAME");
  if (sheets.length < 12) throw new Error("XLSX_VERIFIER_SHEET_CONTRACT_FAILED");

  const zip = new JSZip();
  const date = new Date(params.generatedAt);
  const fileOptions = { date, createFolders: true };

  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`, fileOptions);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`, fileOptions);
  zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${sheets.map((sheet, index) => `<sheet name="${xml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets><calcPr calcId="191029" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>`, fileOptions);
  zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`, fileOptions);
  zip.file("xl/styles.xml", stylesXml(), fileOptions);

  sheets.forEach((sheet, index) => {
    const built = sheetXml(sheet);
    zip.file(`xl/worksheets/sheet${index + 1}.xml`, built.xml, fileOptions);
    if (built.relationships) zip.file(`xl/worksheets/_rels/sheet${index + 1}.xml.rels`, built.relationships, fileOptions);
  });

  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 9 }, platform: "UNIX" });
  const validation = await JSZip.loadAsync(buffer, { checkCRC32: true });
  const required = ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/styles.xml", ...sheets.map((_, index) => `xl/worksheets/sheet${index + 1}.xml`)];
  for (const path of required) if (!validation.file(path)) throw new Error(`XLSX_COMPONENT_MISSING:${path}`);
  const workbookXml = await validation.file("xl/workbook.xml")?.async("string");
  const styles = await validation.file("xl/styles.xml")?.async("string");
  const worksheetXml = (await Promise.all(
    sheets.map((_, index) => validation.file(`xl/worksheets/sheet${index + 1}.xml`)!.async("string"))
  )).join("\n");
  if (
    !workbookXml?.includes("VERIFIER_SIGN_OFF") ||
    !styles?.includes('<dxfs count="3">') ||
    !worksheetXml.includes("<conditionalFormatting") ||
    !worksheetXml.includes("<dataValidations")
  ) {
    throw new Error("XLSX_VERIFIER_STRUCTURE_INVALID");
  }
  return buffer;
}
