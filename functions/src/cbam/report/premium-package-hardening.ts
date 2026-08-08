import JSZip from "jszip";
import { Decimal } from "decimal.js";
import type { AuditReadyCase, CalculationTraceNode } from "../schema";
import type { DossierCalculationResult } from "../calculator";

export type CanonicalCalculationGraph = {
  rootHash: string;
  nodes: ReadonlyArray<{
    id: string;
    label: string;
    formula: string;
    legalBasis: readonly string[];
    inputNodes: readonly string[];
    inputPaths: readonly { path: string }[];
    value: { toString(): string };
    unit: string;
    hash: string;
  }>;
};

export type HardenableArtifact = {
  path: string;
  bytes: Buffer;
  mediaType: string;
};

const EMISSIONS_TOLERANCE = new Decimal("0.001");
const INTENSITY_TOLERANCE = new Decimal("0.000001");
const TIMESTAMP_FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

function d(value: unknown, field: string): Decimal {
  try {
    const parsed = new Decimal(String(value ?? ""));
    if (!parsed.isFinite()) throw new Error("not finite");
    return parsed;
  } catch {
    throw new Error(`PREMIUM_PACKAGE_NUMERIC_INVALID:${field}`);
  }
}

function assertNear(actual: Decimal, expected: Decimal, tolerance: Decimal, code: string): void {
  if (actual.minus(expected).abs().gt(tolerance)) {
    throw new Error(`${code}:${actual.toString()}:${expected.toString()}`);
  }
}

function parseTimestamp(value: unknown, field: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  const ms = Date.parse(String(value));
  if (!Number.isFinite(ms)) throw new Error(`PREMIUM_PACKAGE_TIMESTAMP_INVALID:${field}`);
  return ms;
}

/**
 * Production-grade chronology gate.
 * A sealed package may never rely on evidence, reviews, approvals or sign-offs
 * that claim to exist after the immutable package generation timestamp.
 */
export function assertEvidenceChronology(caseData: AuditReadyCase, generatedAt: string): void {
  const generatedMs = parseTimestamp(generatedAt, "generatedAt");
  if (generatedMs === null) throw new Error("PREMIUM_PACKAGE_GENERATED_AT_REQUIRED");
  const maxAllowed = generatedMs + TIMESTAMP_FUTURE_TOLERANCE_MS;

  for (const [index, evidence] of caseData.evidenceRegister.entries()) {
    const checks: Array<[string, unknown]> = [
      [`evidenceRegister.${index}.issueDate`, evidence.issueDate],
      [`evidenceRegister.${index}.uploadTimestamp`, evidence.uploadTimestamp],
      [`evidenceRegister.${index}.reviewedAt`, evidence.reviewedAt],
      [`evidenceRegister.${index}.qualityAssessedAt`, evidence.qualityAssessedAt],
    ];
    for (const [field, value] of checks) {
      const ms = parseTimestamp(value, field);
      if (ms !== null && ms > maxAllowed) {
        throw new Error(`PREMIUM_PACKAGE_FUTURE_EVIDENCE_TIMESTAMP:${field}:${String(value)}`);
      }
    }
  }

  for (const [index, decision] of caseData.methodologyDecisions.entries()) {
    const ms = parseTimestamp(decision.approvedAt, `methodologyDecisions.${index}.approvedAt`);
    if (ms !== null && ms > maxAllowed) {
      throw new Error(`PREMIUM_PACKAGE_FUTURE_APPROVAL_TIMESTAMP:methodologyDecisions.${index}.approvedAt:${String(decision.approvedAt)}`);
    }
  }

  for (const [index, signOff] of (caseData.operatorSignOffs ?? []).entries()) {
    const ms = parseTimestamp(signOff.signedAt, `operatorSignOffs.${index}.signedAt`);
    if (ms !== null && ms > maxAllowed) {
      throw new Error(`PREMIUM_PACKAGE_FUTURE_SIGNOFF_TIMESTAMP:operatorSignOffs.${index}.signedAt:${String(signOff.signedAt)}`);
    }
  }
}

/**
 * A carbon-price payment amount is monetary; eligibleCertificateReduction is
 * a certificate/emissions-equivalent quantity. The latter cannot exceed the
 * emissions to which the record applies. This prevents EUR values being
 * silently relabelled as certificate-equivalent quantities.
 */
export function assertCarbonPriceSemantics(caseData: AuditReadyCase, calculation: DossierCalculationResult): void {
  let aggregateReduction = new Decimal(0);
  for (const [index, record] of caseData.carbonPriceRecords.entries()) {
    const amountPaid = d(record.amountPaid, `carbonPriceRecords.${index}.amountPaid`);
    const applicable = d(record.applicableEmissions, `carbonPriceRecords.${index}.applicableEmissions`);
    const reduction = d(record.eligibleCertificateReduction ?? "0", `carbonPriceRecords.${index}.eligibleCertificateReduction`);
    if (amountPaid.isNegative() || applicable.isNegative() || reduction.isNegative()) {
      throw new Error(`PREMIUM_PACKAGE_CARBON_PRICE_NEGATIVE:${index}`);
    }
    if (reduction.gt(applicable.plus(INTENSITY_TOLERANCE))) {
      throw new Error(
        `PREMIUM_PACKAGE_CARBON_PRICE_UNIT_MISMATCH:${index}:eligible=${reduction.toString()}:applicable=${applicable.toString()}`
      );
    }
    if (reduction.gt(0) && !record.proofOfPaymentEvidenceId) {
      throw new Error(`PREMIUM_PACKAGE_CARBON_PRICE_EVIDENCE_REQUIRED:${index}`);
    }
    aggregateReduction = aggregateReduction.plus(reduction);
  }
  assertNear(
    d(calculation.eligibleCertificateReduction, "calculation.eligibleCertificateReduction"),
    aggregateReduction,
    INTENSITY_TOLERANCE,
    "PREMIUM_PACKAGE_CARBON_PRICE_TOTAL_MISMATCH"
  );
}

/**
 * Independent arithmetic invariants over the canonical calculation result.
 * The package is not allowed to seal merely because each individual artifact
 * is internally well-formed: all commercial outputs must reconcile here first.
 */
export function assertCalculationConsistency(calculation: DossierCalculationResult): void {
  const installationDirect = d(calculation.installationDirectEmissions, "installationDirectEmissions");
  const precursorDirect = d(calculation.precursorDirectEmissions, "precursorDirectEmissions");
  const electricityIndirect = d(calculation.electricityIndirectEmissions, "electricityIndirectEmissions");
  const precursorIndirect = d(calculation.precursorIndirectEmissions, "precursorIndirectEmissions");
  const totalDirect = d(calculation.totalDirectEmissions, "totalDirectEmissions");
  const totalIndirect = d(calculation.totalIndirectEmissions, "totalIndirectEmissions");
  const totalPriced = d(calculation.totalEmbeddedEmissions, "totalEmbeddedEmissions");
  const production = d(calculation.productionVolume, "productionVolume");

  assertNear(totalDirect, installationDirect.plus(precursorDirect), EMISSIONS_TOLERANCE, "PREMIUM_PACKAGE_TOTAL_DIRECT_MISMATCH");
  assertNear(totalIndirect, electricityIndirect.plus(precursorIndirect), EMISSIONS_TOLERANCE, "PREMIUM_PACKAGE_TOTAL_INDIRECT_MISMATCH");

  const expectedDisclosed = totalDirect.plus(totalIndirect);
  assertNear(
    d(calculation.emissionsByCategory.H_TOTAL_INFORMATIONAL_EMBEDDED, "emissionsByCategory.H"),
    expectedDisclosed,
    EMISSIONS_TOLERANCE,
    "PREMIUM_PACKAGE_DISCLOSED_TOTAL_MISMATCH"
  );
  assertNear(
    d(calculation.emissionsByCategory.G_CERTIFICATE_RELEVANT_EMBEDDED, "emissionsByCategory.G"),
    totalPriced,
    EMISSIONS_TOLERANCE,
    "PREMIUM_PACKAGE_PRICED_TOTAL_MISMATCH"
  );

  const allocatedTotal = calculation.goods.reduce(
    (sum, good) => sum.plus(d(good.allocatedEmbeddedEmissions, `goods.${good.goodIndex}.allocatedEmbeddedEmissions`)),
    new Decimal(0)
  );
  assertNear(allocatedTotal, totalPriced, EMISSIONS_TOLERANCE, "PREMIUM_PACKAGE_GOODS_TOTAL_MISMATCH");

  const productionTotal = calculation.goods.reduce(
    (sum, good) => sum.plus(d(good.productionVolume, `goods.${good.goodIndex}.productionVolume`)),
    new Decimal(0)
  );
  assertNear(productionTotal, production, EMISSIONS_TOLERANCE, "PREMIUM_PACKAGE_PRODUCTION_TOTAL_MISMATCH");

  const shareTotal = calculation.goods.reduce(
    (sum, good) => sum.plus(d(good.allocationShare, `goods.${good.goodIndex}.allocationShare`)),
    new Decimal(0)
  );
  assertNear(shareTotal, new Decimal(1), INTENSITY_TOLERANCE, "PREMIUM_PACKAGE_ALLOCATION_SHARE_MISMATCH");
  assertNear(
    d(calculation.allocationShareTotal, "allocationShareTotal"),
    shareTotal,
    INTENSITY_TOLERANCE,
    "PREMIUM_PACKAGE_ALLOCATION_SHARE_REPORTED_MISMATCH"
  );

  for (const good of calculation.goods) {
    const allocated = d(good.allocatedEmbeddedEmissions, `goods.${good.goodIndex}.allocatedEmbeddedEmissions`);
    const volume = d(good.productionVolume, `goods.${good.goodIndex}.productionVolume`);
    const specific = d(good.specificEmbeddedEmissions, `goods.${good.goodIndex}.specificEmbeddedEmissions`);
    if (volume.lte(0)) throw new Error(`PREMIUM_PACKAGE_PRODUCTION_NON_POSITIVE:${good.goodIndex}`);
    assertNear(
      allocated.dividedBy(volume),
      specific,
      INTENSITY_TOLERANCE,
      `PREMIUM_PACKAGE_GOOD_SPECIFIC_MISMATCH:${good.goodIndex}`
    );
  }

  const traceByFormula = new Map(calculation.trace.map((item) => [item.formulaId, item]));
  const requireTrace = (formulaId: string): CalculationTraceNode => {
    const item = traceByFormula.get(formulaId);
    if (!item) throw new Error(`PREMIUM_PACKAGE_TRACE_NODE_MISSING:${formulaId}`);
    return item;
  };
  assertNear(d(requireTrace("CBAM_INSTALLATION_DIRECT_EMISSIONS").outputValue, "trace.installationDirect"), installationDirect, EMISSIONS_TOLERANCE, "PREMIUM_PACKAGE_TRACE_INSTALLATION_DIRECT_MISMATCH");
  assertNear(d(requireTrace("CBAM_INDIRECT_EMISSIONS").outputValue, "trace.indirect"), electricityIndirect, EMISSIONS_TOLERANCE, "PREMIUM_PACKAGE_TRACE_INDIRECT_MISMATCH");
  assertNear(d(requireTrace("CBAM_TOTAL_EMBEDDED_EMISSIONS_DISCLOSED").outputValue, "trace.disclosed"), expectedDisclosed, EMISSIONS_TOLERANCE, "PREMIUM_PACKAGE_TRACE_DISCLOSED_MISMATCH");
  assertNear(d(requireTrace("CBAM_TOTAL_EMBEDDED_EMISSIONS_PRICED").outputValue, "trace.priced"), totalPriced, EMISSIONS_TOLERANCE, "PREMIUM_PACKAGE_TRACE_PRICED_MISMATCH");
}

function formulaDependencies(formulaId: string, allFormulaIds: readonly string[]): string[] {
  const present = (id: string) => allFormulaIds.includes(id);
  const goodFormulaIds = allFormulaIds.filter((id) => /^CBAM_GOOD_EMISSIONS_ALLOCATION_\d+$/.test(id));
  switch (formulaId) {
    case "CBAM_TOTAL_EMBEDDED_EMISSIONS_DISCLOSED":
      return ["CBAM_INSTALLATION_DIRECT_EMISSIONS", "CBAM_INDIRECT_EMISSIONS", "CBAM_PRECURSOR_EMISSIONS_SUM"].filter(present);
    case "CBAM_TOTAL_EMBEDDED_EMISSIONS_PRICED":
      return goodFormulaIds;
    case "CBAM_GOODS_ALLOCATION_RECONCILIATION":
      return [...goodFormulaIds, "CBAM_TOTAL_EMBEDDED_EMISSIONS_PRICED"].filter(present);
    case "CBAM_AGGREGATE_SPECIFIC_EMBEDDED_EMISSIONS":
      return ["CBAM_TOTAL_EMBEDDED_EMISSIONS_PRICED"].filter(present);
    default:
      if (/^CBAM_GOOD_EMISSIONS_ALLOCATION_\d+$/.test(formulaId)) {
        return ["CBAM_INSTALLATION_DIRECT_EMISSIONS", "CBAM_INDIRECT_EMISSIONS", "CBAM_PRECURSOR_EMISSIONS_SUM"].filter(present);
      }
      return [];
  }
}

function traceInputPaths(node: CalculationTraceNode): Array<{ path: string }> {
  const inputs = (node.inputs || {}) as Record<string, unknown>;
  const goodIndex = Number(inputs.goodIndex || 0);
  const paths = new Set<string>();
  for (const key of Object.keys(inputs)) {
    if (key === "calcNodeId" || key.endsWith("Unit") || key === "goodIndex" || key === "sector" || key === "annexII" || key === "indirectPriced") continue;
    if (goodIndex > 0 && ["cnCode", "allocationShare", "productionVolume"].includes(key)) {
      paths.add(`goods.${goodIndex - 1}.${key}`);
      continue;
    }
    if (key === "electricityConsumed" || key === "gridEmissionFactor" || key === "directEmissions") {
      paths.add(key);
      continue;
    }
    if (key.startsWith("precursor")) {
      paths.add("precursors[]");
      continue;
    }
    if (key === "records") {
      paths.add("carbonPriceRecords[]");
      continue;
    }
    if (key === "aggregateProductionVolume") {
      paths.add("goods[].productionVolume");
      continue;
    }
    if (key === "allocationShares") {
      paths.add("goods[].allocationShare");
      continue;
    }
    if (key === "allocatedEmbeddedEmissions") {
      paths.add("goods[].allocatedEmbeddedEmissions");
      continue;
    }
  }
  return [...paths].sort().map((path) => ({ path }));
}

/**
 * Canonical graph is derived from Calculation Trace, never from a parallel
 * calculation engine. This removes the stale-graph failure class entirely.
 */
export function buildCanonicalCalculationGraph(calculation: DossierCalculationResult): CanonicalCalculationGraph {
  const formulaIds = calculation.trace.map((item) => item.formulaId);
  const nodes = calculation.trace.map((item) => ({
    id: item.formulaId,
    label: item.formulaId
      .replace(/^CBAM_/, "")
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase()),
    formula: item.formulaId,
    legalBasis: [item.officialSource],
    inputNodes: formulaDependencies(item.formulaId, formulaIds),
    inputPaths: traceInputPaths(item),
    value: { toString: () => String(item.outputValue) },
    unit: item.outputUnit,
    hash: item.calculationHash,
  }));
  return { rootHash: calculation.calculationRootHash, nodes };
}

function calculationLinksForInput(inputPath: string, calculation: DossierCalculationResult): string[] {
  const available = new Set(calculation.trace.map((item) => item.formulaId));
  const add = (...ids: string[]) => ids.filter((id) => available.has(id));
  const direct = ["CBAM_INSTALLATION_DIRECT_EMISSIONS", "CBAM_TOTAL_EMBEDDED_EMISSIONS_DISCLOSED", "CBAM_TOTAL_EMBEDDED_EMISSIONS_PRICED"];
  const indirect = ["CBAM_INDIRECT_EMISSIONS", "CBAM_TOTAL_EMBEDDED_EMISSIONS_DISCLOSED", "CBAM_TOTAL_EMBEDDED_EMISSIONS_PRICED"];
  const precursor = ["CBAM_PRECURSOR_EMISSIONS_SUM", "CBAM_TOTAL_EMBEDDED_EMISSIONS_DISCLOSED", "CBAM_TOTAL_EMBEDDED_EMISSIONS_PRICED"];
  if (inputPath === "directEmissions") return add(...direct);
  if (inputPath === "electricityConsumed" || inputPath === "gridEmissionFactor") return add(...indirect);
  if (inputPath.startsWith("precursors.")) return add(...precursor);
  if (inputPath.startsWith("carbonPriceRecords.")) return add("CBAM_CARBON_PRICE_REDUCTION_RECORD_TOTAL");
  const goodMatch = inputPath.match(/^goods\.(\d+)\.(cnCode|productionVolume|allocationShare)/);
  if (goodMatch) {
    const goodFormula = `CBAM_GOOD_EMISSIONS_ALLOCATION_${Number(goodMatch[1]) + 1}`;
    return add(goodFormula, "CBAM_TOTAL_EMBEDDED_EMISSIONS_PRICED", "CBAM_GOODS_ALLOCATION_RECONCILIATION", "CBAM_AGGREGATE_SPECIFIC_EMBEDDED_EMISSIONS");
  }
  if (inputPath.startsWith("reportingPeriod.")) return [];
  if (inputPath.startsWith("installation.")) return [];
  if (inputPath.startsWith("importerIdentity.") || inputPath.startsWith("exporterIdentity.")) return [];
  return [];
}

/**
 * linkedCalculations is derived data. Enrich a private artifact-generation copy
 * without mutating the immutable operator source object.
 */
export function prepareCaseForVerifierArtifacts(caseData: AuditReadyCase, calculation: DossierCalculationResult): AuditReadyCase {
  const clone = JSON.parse(JSON.stringify(caseData)) as AuditReadyCase;
  for (const evidence of clone.evidenceRegister) {
    const derived = new Set(evidence.linkedCalculations || []);
    for (const inputPath of evidence.linkedInputs || []) {
      for (const formulaId of calculationLinksForInput(inputPath, calculation)) derived.add(formulaId);
    }
    evidence.linkedCalculations = [...derived].sort();
  }
  return clone;
}

function xml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function inlineCell(ref: string, value: unknown): string {
  return `<c r="${ref}" t="inlineStr"><is><t>${xml(value)}</t></is></c>`;
}

function numberCell(ref: string, value: unknown): string {
  return `<c r="${ref}"><v>${xml(value)}</v></c>`;
}

function formulaNumberCell(ref: string, formula: string, cachedValue: unknown): string {
  return `<c r="${ref}"><f>${xml(formula)}</f><v>${xml(cachedValue)}</v></c>`;
}

function formulaTextCell(ref: string, formula: string, cachedValue: string): string {
  return `<c r="${ref}" t="str"><f>${xml(formula)}</f><v>${xml(cachedValue)}</v></c>`;
}

function rowXml(row: number, cells: string[]): string {
  return `<row r="${row}">${cells.join("")}</row>`;
}

function buildVerifierRecomputeSheet(calculation: DossierCalculationResult): string {
  const goodStart = 22;
  const goodEnd = goodStart + calculation.goods.length - 1;
  const totalDirect = d(calculation.totalDirectEmissions, "totalDirectEmissions");
  const totalIndirect = d(calculation.totalIndirectEmissions, "totalIndirectEmissions");
  const disclosed = d(calculation.emissionsByCategory.H_TOTAL_INFORMATIONAL_EMBEDDED, "emissionsByCategory.H");
  const totalPriced = d(calculation.totalEmbeddedEmissions, "totalEmbeddedEmissions");
  const production = d(calculation.productionVolume, "productionVolume");
  const aggregateSpecific = d(calculation.specificEmbeddedEmissions, "specificEmbeddedEmissions");
  const shareTotal = d(calculation.allocationShareTotal, "allocationShareTotal");
  const allocationDelta = d(calculation.allocationReconciliationDelta, "allocationReconciliationDelta");

  const rows: string[] = [];
  rows.push(rowXml(1, [inlineCell("A1", "SOURCE INPUTS"), inlineCell("B1", "Value"), inlineCell("C1", "Unit")]));
  rows.push(rowXml(2, [inlineCell("A2", "Installation direct emissions"), numberCell("B2", calculation.installationDirectEmissions), inlineCell("C2", "tCO2e")]));
  rows.push(rowXml(3, [inlineCell("A3", "Precursor direct emissions"), numberCell("B3", calculation.precursorDirectEmissions), inlineCell("C3", "tCO2e")]));
  const indirectTrace = calculation.trace.find((item) => item.formulaId === "CBAM_INDIRECT_EMISSIONS");
  const indirectInputs = (indirectTrace?.inputs || {}) as Record<string, unknown>;
  rows.push(rowXml(4, [inlineCell("A4", "Electricity consumed"), numberCell("B4", indirectInputs.electricityConsumed ?? 0), inlineCell("C4", "MWh")]));
  rows.push(rowXml(5, [inlineCell("A5", "Grid emission factor"), numberCell("B5", indirectInputs.gridEmissionFactor ?? 0), inlineCell("C5", "tCO2e/MWh")]));
  rows.push(rowXml(6, [inlineCell("A6", "Precursor indirect emissions"), numberCell("B6", calculation.precursorIndirectEmissions), inlineCell("C6", "tCO2e")]));

  rows.push(rowXml(9, [inlineCell("A9", "RECOMPUTATION CONTROL"), inlineCell("B9", "Recomputed"), inlineCell("C9", "Canonical"), inlineCell("D9", "Variance"), inlineCell("E9", "Status")]));
  const controlRow = (row: number, label: string, formula: string, canonical: Decimal, tolerance: Decimal) => {
    rows.push(rowXml(row, [
      inlineCell(`A${row}`, label),
      formulaNumberCell(`B${row}`, formula, canonical.toString()),
      numberCell(`C${row}`, canonical.toString()),
      formulaNumberCell(`D${row}`, `B${row}-C${row}`, "0"),
      formulaTextCell(`E${row}`, `IF(ABS(D${row})<=${tolerance.toString()},\"PASS\",\"FAIL\")`, "PASS"),
    ]));
  };
  controlRow(10, "Electricity indirect emissions", "B4*B5", d(calculation.electricityIndirectEmissions, "electricityIndirectEmissions"), EMISSIONS_TOLERANCE);
  controlRow(11, "Total direct emissions", "B2+B3", totalDirect, EMISSIONS_TOLERANCE);
  controlRow(12, "Total indirect emissions", "B10+B6", totalIndirect, EMISSIONS_TOLERANCE);
  controlRow(13, "Total disclosed emissions", "B11+B12", disclosed, EMISSIONS_TOLERANCE);
  controlRow(14, "Aggregate production", goodEnd >= goodStart ? `SUM(D${goodStart}:D${goodEnd})` : "0", production, EMISSIONS_TOLERANCE);
  controlRow(15, "Certificate-relevant priced emissions", goodEnd >= goodStart ? `SUM(F${goodStart}:F${goodEnd})` : "0", totalPriced, EMISSIONS_TOLERANCE);
  controlRow(16, "Aggregate specific embedded emissions", "IF(B14=0,0,B15/B14)", aggregateSpecific, INTENSITY_TOLERANCE);
  controlRow(17, "Allocation share total", goodEnd >= goodStart ? `SUM(C${goodStart}:C${goodEnd})` : "0", shareTotal, INTENSITY_TOLERANCE);
  controlRow(18, "Allocation reconciliation delta", "ABS(B17-1)", allocationDelta, INTENSITY_TOLERANCE);

  rows.push(rowXml(21, [
    inlineCell("A21", "Good"), inlineCell("B21", "CN"), inlineCell("C21", "Share"), inlineCell("D21", "Production t"),
    inlineCell("E21", "Indirect priced"), inlineCell("F21", "Recomputed allocated"), inlineCell("G21", "Canonical allocated"),
    inlineCell("H21", "Variance"), inlineCell("I21", "Recomputed specific"), inlineCell("J21", "Canonical specific"),
    inlineCell("K21", "Variance"), inlineCell("L21", "Status"),
  ]));

  calculation.goods.forEach((good, index) => {
    const row = goodStart + index;
    const allocated = d(good.allocatedEmbeddedEmissions, `goods.${good.goodIndex}.allocatedEmbeddedEmissions`);
    const specific = d(good.specificEmbeddedEmissions, `goods.${good.goodIndex}.specificEmbeddedEmissions`);
    const formulaAllocated = `$B$11*C${row}+IF(E${row}=\"YES\",$B$12*C${row},0)`;
    const formulaSpecific = `IF(D${row}=0,0,F${row}/D${row})`;
    rows.push(rowXml(row, [
      numberCell(`A${row}`, good.goodIndex),
      inlineCell(`B${row}`, good.cnCode),
      numberCell(`C${row}`, good.allocationShare),
      numberCell(`D${row}`, good.productionVolume),
      inlineCell(`E${row}`, good.indirectPriced ? "YES" : "NO"),
      formulaNumberCell(`F${row}`, formulaAllocated, allocated.toString()),
      numberCell(`G${row}`, allocated.toString()),
      formulaNumberCell(`H${row}`, `F${row}-G${row}`, "0"),
      formulaNumberCell(`I${row}`, formulaSpecific, specific.toString()),
      numberCell(`J${row}`, specific.toString()),
      formulaNumberCell(`K${row}`, `I${row}-J${row}`, "0"),
      formulaTextCell(`L${row}`, `IF(AND(ABS(H${row})<=0.001,ABS(K${row})<=0.000001),\"PASS\",\"FAIL\")`, "PASS"),
    ]));
  });

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<cols><col min="1" max="1" width="38" customWidth="1"/><col min="2" max="12" width="22" customWidth="1"/></cols>` +
    `<sheetData>${rows.join("")}</sheetData>` +
    `<autoFilter ref="A21:L${Math.max(21, goodEnd)}"/>` +
    `</worksheet>`;
}

/** Add a formula-driven independent recomputation sheet to the sealed workbook. */
export async function hardenVerifierWorkbook(workbookBytes: Buffer, calculation: DossierCalculationResult): Promise<Buffer> {
  const zip = await JSZip.loadAsync(workbookBytes);
  const workbookFile = zip.file("xl/workbook.xml");
  const relsFile = zip.file("xl/_rels/workbook.xml.rels");
  const contentTypesFile = zip.file("[Content_Types].xml");
  if (!workbookFile || !relsFile || !contentTypesFile) throw new Error("PREMIUM_PACKAGE_WORKBOOK_STRUCTURE_INVALID");

  let workbookXml = await workbookFile.async("string");
  let relsXml = await relsFile.async("string");
  let contentTypesXml = await contentTypesFile.async("string");
  if (/name="Verifier Recompute"/.test(workbookXml)) return workbookBytes;

  const sheetIds = [...workbookXml.matchAll(/sheetId="(\d+)"/g)].map((match) => Number(match[1]));
  const relationshipIds = [...relsXml.matchAll(/Id="rId(\d+)"/g)].map((match) => Number(match[1]));
  const worksheetNumbers = Object.keys(zip.files)
    .map((name) => name.match(/^xl\/worksheets\/sheet(\d+)\.xml$/)?.[1])
    .filter((value): value is string => Boolean(value))
    .map(Number);
  const sheetId = Math.max(0, ...sheetIds) + 1;
  const relationshipId = Math.max(0, ...relationshipIds) + 1;
  const worksheetNumber = Math.max(0, ...worksheetNumbers) + 1;
  const worksheetPath = `xl/worksheets/sheet${worksheetNumber}.xml`;

  workbookXml = workbookXml.replace(
    "</sheets>",
    `<sheet name="Verifier Recompute" sheetId="${sheetId}" r:id="rId${relationshipId}"/></sheets>`
  );
  if (/<calcPr\b[^>]*\/>/.test(workbookXml)) {
    workbookXml = workbookXml.replace(/<calcPr\b[^>]*\/>/, '<calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>');
  } else {
    workbookXml = workbookXml.replace("</workbook>", '<calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>');
  }
  relsXml = relsXml.replace(
    "</Relationships>",
    `<Relationship Id="rId${relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${worksheetNumber}.xml"/></Relationships>`
  );
  contentTypesXml = contentTypesXml.replace(
    "</Types>",
    `<Override PartName="/xl/worksheets/sheet${worksheetNumber}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`
  );

  zip.file("xl/workbook.xml", workbookXml);
  zip.file("xl/_rels/workbook.xml.rels", relsXml);
  zip.file("[Content_Types].xml", contentTypesXml);
  zip.file(worksheetPath, buildVerifierRecomputeSheet(calculation));
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 9 } });
}

function graphArtifactJson(graph: CanonicalCalculationGraph): Buffer {
  return Buffer.from(JSON.stringify({
    rootHash: graph.rootHash,
    nodes: graph.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      formula: node.formula,
      legalBasis: node.legalBasis,
      inputNodes: node.inputNodes,
      inputPaths: node.inputPaths,
      value: node.value.toString(),
      unit: node.unit,
      hash: node.hash,
    })),
  }), "utf8");
}

function derivedFieldEvidenceMatrix(caseData: AuditReadyCase): Buffer {
  const csvCell = (value: unknown) => {
    const text = String(value ?? "");
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const rows: unknown[][] = [["Evidence ID", "Linked input", "Linked calculations", "Review", "Support", "Malware"]];
  for (const item of caseData.evidenceRegister) {
    const inputs = item.linkedInputs.length ? item.linkedInputs : ["—"];
    for (const input of inputs) {
      rows.push([item.evidenceId, input, item.linkedCalculations.join(" | "), item.reviewStatus, item.supportStatus, item.malwareScanStatus]);
    }
  }
  return Buffer.from(rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n", "utf8");
}

/**
 * Replaces stale parallel graph output, materialises evidence→calculation
 * lineage and turns Verifier Workspace into a true formula recomputation file.
 */
export async function hardenVerifierArtifacts(params: {
  artifacts: HardenableArtifact[];
  caseData: AuditReadyCase;
  calculation: DossierCalculationResult;
  graph: CanonicalCalculationGraph;
}): Promise<HardenableArtifact[]> {
  const result: HardenableArtifact[] = [];
  for (const artifact of params.artifacts) {
    if (artifact.path === "Calculation Graph.json") {
      result.push({ ...artifact, bytes: graphArtifactJson(params.graph) });
      continue;
    }
    if (artifact.path === "Field-to-Evidence Matrix.csv") {
      result.push({ ...artifact, bytes: derivedFieldEvidenceMatrix(params.caseData) });
      continue;
    }
    if (artifact.path === "Verifier Workspace.xlsx") {
      result.push({ ...artifact, bytes: await hardenVerifierWorkbook(artifact.bytes, params.calculation) });
      continue;
    }
    result.push(artifact);
  }
  return result;
}

/** Fail closed if Trace and Graph disagree after artifact generation. */
export function assertTraceGraphArtifactConsistency(artifacts: readonly HardenableArtifact[], calculation: DossierCalculationResult): void {
  const traceArtifact = artifacts.find((item) => item.path === "Calculation Trace.json");
  const graphArtifact = artifacts.find((item) => item.path === "Calculation Graph.json");
  const workbookArtifact = artifacts.find((item) => item.path === "Verifier Workspace.xlsx");
  if (!traceArtifact || !graphArtifact || !workbookArtifact) throw new Error("PREMIUM_PACKAGE_REPRODUCTION_ARTIFACT_MISSING");

  const tracePayload = JSON.parse(traceArtifact.bytes.toString("utf8")) as { calculation?: DossierCalculationResult };
  const graphPayload = JSON.parse(graphArtifact.bytes.toString("utf8")) as {
    rootHash?: string;
    nodes?: Array<{ id?: string; value?: string; unit?: string; hash?: string }>;
  };
  if (!tracePayload.calculation) throw new Error("PREMIUM_PACKAGE_TRACE_PAYLOAD_INVALID");
  if (tracePayload.calculation.calculationRootHash !== calculation.calculationRootHash) {
    throw new Error("PREMIUM_PACKAGE_TRACE_ROOT_MISMATCH");
  }
  if (graphPayload.rootHash !== calculation.calculationRootHash) {
    throw new Error("PREMIUM_PACKAGE_GRAPH_ROOT_MISMATCH");
  }
  const graphById = new Map((graphPayload.nodes || []).map((node) => [String(node.id), node]));
  for (const trace of calculation.trace) {
    const graph = graphById.get(trace.formulaId);
    if (!graph) throw new Error(`PREMIUM_PACKAGE_GRAPH_NODE_MISSING:${trace.formulaId}`);
    if (String(graph.value) !== String(trace.outputValue) || String(graph.unit) !== String(trace.outputUnit) || String(graph.hash) !== String(trace.calculationHash)) {
      throw new Error(`PREMIUM_PACKAGE_TRACE_GRAPH_NODE_MISMATCH:${trace.formulaId}`);
    }
  }
}

export function assertPremiumPackagePreconditions(params: {
  caseData: AuditReadyCase;
  calculation: DossierCalculationResult;
  generatedAt: string;
}): void {
  assertEvidenceChronology(params.caseData, params.generatedAt);
  assertCarbonPriceSemantics(params.caseData, params.calculation);
  assertCalculationConsistency(params.calculation);
}
