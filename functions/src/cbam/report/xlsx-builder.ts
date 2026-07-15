import JSZip from "jszip";
import type { AuditReadyCase } from "../schema";
import type { DossierCalculationResult } from "../calculator";
import type { QualityControlResult } from "../validation/quality-controls";

export type WorkbookRow = Array<string | number | boolean | null | undefined>;
export type WorkbookSheet = { name: string; rows: WorkbookRow[] };

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

function sheetXml(rows: WorkbookRow[]): string {
  const body = rows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => {
      const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
      if (typeof value === "number" && Number.isFinite(value)) {
        return `<c r="${reference}" s="1"><v>${value}</v></c>`;
      }
      if (typeof value === "boolean") {
        return `<c r="${reference}" t="b" s="1"><v>${value ? 1 : 0}</v></c>`;
      }
      return `<c r="${reference}" t="inlineStr" s="1"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><sheetData>${body}</sheetData></worksheet>`;
}

function buildSheets(params: {
  caseData: AuditReadyCase;
  calculation: DossierCalculationResult;
  controls: QualityControlResult[];
  reportId: string;
  releaseVersion: number;
  generatedAt: string;
}): WorkbookSheet[] {
  const { caseData, calculation, controls, reportId, releaseVersion, generatedAt } = params;
  return [
    { name: "README", rows: [["CBAMValid Verifier Workspace"], ["Report ID", reportId], ["Release version", releaseVersion], ["Generated at", generatedAt], ["Ruleset", calculation.ruleset], ["Engine version", calculation.engineVersion], ["Calculation root hash", calculation.calculationRootHash], ["Notice", "Preparation workspace for independent verification; not an accredited opinion or Registry submission."]] },
    { name: "CASE", rows: [["Field", "Value"], ["Case ID", caseData.caseId], ["Importer", caseData.importerIdentity.legalName.value], ["Exporter/operator", caseData.exporterIdentity.legalName.value], ["EORI", caseData.importerIdentity.eoriNumber.value], ["Reporting year", caseData.reportingPeriod.year.value], ["Installation", caseData.installation.name.value], ["Country", caseData.installation.country.value], ["Production route", caseData.installation.productionRoute.value], ["System boundaries", caseData.installation.systemBoundaries]] },
    { name: "GOODS", rows: [["Index", "CN code", "Sector", "Production", "Unit", "Allocation share", "Allocated embedded tCO2e", "Specific tCO2e/t"], ...calculation.goods.map((good) => [good.goodIndex, good.cnCode, good.sector, good.productionVolume, good.productionUnit, good.allocationShare, good.allocatedEmbeddedEmissions, good.specificEmbeddedEmissions])] },
    { name: "INPUTS", rows: [["Input", "Value", "Unit", "Source type", "Evidence ID"], ["Direct emissions", caseData.directEmissions.value, caseData.directEmissions.canonicalUnit, caseData.directEmissions.sourceType, caseData.directEmissions.evidenceId], ["Electricity consumed", caseData.electricityConsumed.value, caseData.electricityConsumed.canonicalUnit, caseData.electricityConsumed.sourceType, caseData.electricityConsumed.evidenceId], ["Grid emission factor", caseData.gridEmissionFactor.value, caseData.gridEmissionFactor.canonicalUnit, caseData.gridEmissionFactor.sourceType, caseData.gridEmissionFactor.evidenceId]] },
    { name: "PRECURSORS", rows: [["Index", "Name", "Country", "Quantity", "Quantity unit", "Direct tCO2e", "Indirect tCO2e"], ...caseData.precursors.map((item, index) => [index + 1, item.name.value, item.countryOfOrigin.value, item.quantity.value, item.quantity.canonicalUnit, item.directEmissions.value, item.indirectEmissions.value])] },
    { name: "EVIDENCE", rows: [["Evidence ID", "Type", "File", "Issuer", "Issue date", "SHA-256", "Bytes", "Review", "Support", "Malware", "Linked inputs"], ...caseData.evidenceRegister.map((item) => [item.evidenceId, item.documentType, item.fileName, item.issuer, item.issueDate, item.fileHash, item.sizeBytes, item.reviewStatus, item.supportStatus, item.malwareScanStatus, item.linkedInputs.join(" | ")])] },
    { name: "METHODS", rows: [["Decision ID", "Topic", "Method", "Reason", "Basis", "Review", "Ruleset", "Evidence IDs"], ...caseData.methodologyDecisions.map((item) => [item.decisionId, item.topic, item.selectedMethod, item.reason, item.legalOrTechnicalBasis, item.reviewStatus, item.rulesetVersion, item.evidenceIds.join(" | ")])] },
    { name: "QUALITY_CONTROLS", rows: [["Rule", "Name", "Status", "Message", "Remediation"], ...controls.map((item) => [item.ruleId, item.name, item.status, item.message, item.remediationCode])] },
    { name: "CALCULATION_TRACE", rows: [["Calculation ID", "Formula", "Output", "Unit", "Hash", "Warnings"], ...calculation.trace.map((item) => [item.calculationId, item.formulaId, item.outputValue, item.outputUnit, item.calculationHash, item.warnings.join(" | ")])] },
    { name: "CARBON_PRICE", rows: [["Record ID", "Amount paid", "Applicable emissions", "Currency", "Period", "Legal reference", "Payment evidence", "Eligible reduction"], ...caseData.carbonPriceRecords.map((item) => [item.id, item.amountPaid, item.applicableEmissions, item.currency, item.paymentPeriod, item.legislationReference, item.proofOfPaymentEvidenceId, item.eligibleCertificateReduction])] },
  ];
}

export async function buildVerifierWorkbook(params: {
  caseData: AuditReadyCase;
  calculation: DossierCalculationResult;
  controls: QualityControlResult[];
  reportId: string;
  releaseVersion: number;
  generatedAt: string;
}): Promise<Buffer> {
  const sheets = buildSheets(params).map((sheet) => ({ ...sheet, name: safeSheetName(sheet.name) }));
  if (new Set(sheets.map((sheet) => sheet.name)).size !== sheets.length) throw new Error("XLSX_DUPLICATE_SHEET_NAME");
  const zip = new JSZip();
  const date = new Date(params.generatedAt);
  const fileOptions = { date, createFolders: true };

  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`, fileOptions);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`, fileOptions);
  zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet, index) => `<sheet name="${xml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets></workbook>`, fileOptions);
  zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`, fileOptions);
  zip.file("xl/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="10"/><name val="Aptos"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`, fileOptions);
  sheets.forEach((sheet, index) => zip.file(`xl/worksheets/sheet${index + 1}.xml`, sheetXml(sheet.rows), fileOptions));

  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 9 } });
  const validation = await JSZip.loadAsync(buffer);
  const required = ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/styles.xml", ...sheets.map((_, index) => `xl/worksheets/sheet${index + 1}.xml`)];
  for (const path of required) if (!validation.file(path)) throw new Error(`XLSX_COMPONENT_MISSING:${path}`);
  return buffer;
}
