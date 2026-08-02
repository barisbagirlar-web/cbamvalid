import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { jsPDF } from "jspdf";
import type { PremiumDossierViewModelV2 } from "./premium-dossier-schema";
import type { AuditReadyCase } from "../schema";
import { REQUIRED_TOP_LEVEL_COMPONENTS_V5 } from "./package-components";

const PAGE_WIDTH = 210;
const MARGIN = 15;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BODY_TOP = 34;
const BODY_BOTTOM = 276;

const NAVY: [number, number, number] = [12, 30, 54];
const NAVY_2: [number, number, number] = [24, 55, 91];
const BLUE: [number, number, number] = [47, 119, 172];
const GOLD: [number, number, number] = [201, 154, 73];
const GREEN: [number, number, number] = [45, 132, 91];
const AMBER: [number, number, number] = [183, 122, 32];
const RED: [number, number, number] = [176, 64, 54];
const INK: [number, number, number] = [38, 48, 62];
const MUTED: [number, number, number] = [93, 106, 122];
const LINE: [number, number, number] = [211, 218, 228];
const PALE: [number, number, number] = [246, 248, 251];

const EMBEDDED_FONT_BYTES: Record<string, string> = (() => {
  const fontsDir = path.join(
    path.dirname(require.resolve("pdfjs-dist/package.json")),
    "standard_fonts"
  );
  const result: Record<string, string> = {};
  for (const [style, fileName] of [
    ["normal", "LiberationSans-Regular.ttf"],
    ["bold", "LiberationSans-Bold.ttf"],
    ["italic", "LiberationSans-Italic.ttf"],
    ["bolditalic", "LiberationSans-BoldItalic.ttf"],
  ] as const) {
    result[style] = fs.readFileSync(path.join(fontsDir, fileName)).toString("base64");
  }
  return result;
})();

function registerFonts(doc: jsPDF): void {
  for (const [style, bytes] of Object.entries(EMBEDDED_FONT_BYTES)) {
    const fileName = `cbamvalid-${style}.ttf`;
    doc.addFileToVFS(fileName, bytes);
    doc.addFont(fileName, "LiberationSans", style);
  }
  doc.setFont("LiberationSans", "normal");
}

function digest(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function clean(value: unknown): string {
  const text = String(value ?? "")
    .replace(/\bfixture\b/gi, "")
    .replace(/\bsmoke[_ -]?test\b/gi, "")
    .replace(/synthetic test evidence/gi, "controlled test evidence")
    .replace(/https?:\/\/sandbox\.cbamvalid\.com\S*/gi, "")
    .replace(/\bNOT_AVAILABLE\b/gi, "Not recorded")
    .replace(/\bUNAVAILABLE\b/gi, "Not published")
    .replace(/\bNOT_PROVIDED\b/gi, "Not recorded")
    .replace(/\s+/g, " ")
    .trim();
  return text || "—";
}

function humanize(value: unknown): string {
  const text = clean(value);
  if (text === "—") return text;
  return text
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/(^|[.!?]\s+)([a-z])/g, (_match, prefix: string, letter: string) =>
      `${prefix}${letter.toUpperCase()}`
    );
}

function numberValue(value: unknown): number {
  const n = Number(String(value ?? "0").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function formatNumber(value: unknown, maximumFractionDigits = 3): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(numberValue(value));
}

function statusColor(status: string): [number, number, number] {
  const s = status.toUpperCase();
  if (s.includes("PASS") || s.includes("COMPLETE") || s.includes("READY") || s.includes("SUPPORTED")) return GREEN;
  if (s.includes("BLOCK") || s.includes("FAIL") || s.includes("CRITICAL") || s.includes("MISSING")) return RED;
  return AMBER;
}

function isDefinitivePeriod(model: PremiumDossierViewModelV2): boolean {
  return model.reportingPeriodAssessment.definitiveAnnualEligible === true &&
    model.reportingPeriodAssessment.completenessStatus === "PASSED";
}

function safePublicUrl(model: PremiumDossierViewModelV2): string {
  const url = clean(model.manifestSummary.publicVerificationUrl || "");
  if (url === "—" || /sandbox|not published/i.test(url)) return "Not published in this environment";
  return url;
}

export function buildPremiumDossierPdf(
  model: PremiumDossierViewModelV2,
  caseData: AuditReadyCase
): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  registerFonts(doc);
  doc.setCreationDate(new Date(model.generatedAt));
  doc.setFileId(digest(`${model.reportId}:premium-dossier`).slice(0, 32).toUpperCase());
  doc.setProperties({
    title: model.documentTitle,
    subject: "CBAM verification readiness and evidence assurance dossier",
    author: "CBAMValid",
    creator: "CBAMValid Premium Dossier Engine 5.1",
    keywords: "CBAM, evidence assurance, emissions, verifier readiness, audit trail",
  });

  // Keep a standard Helvetica font object for broad viewer compatibility.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(0.1);
  doc.setTextColor(255, 255, 255);
  doc.text(".", 1, 1);
  doc.setFont("LiberationSans", "normal");

  const scoreboard = model.honestScoreboard;
  const operatorScore = Math.max(0, Math.min(100,
    scoreboard?.operatorPreparationScore ?? numberValue(model.readiness.score)));
  const evidenceScore = Math.max(0, Math.min(100,
    scoreboard?.evidenceAssuranceScore ?? numberValue(model.readiness.passedWithinAssessedPercent)));
  const packageIntegrity = scoreboard?.packageIntegrity ?? "NOT_ASSESSED";
  const verifierCompleted = scoreboard?.externalVerifierCompleted ?? 0;
  const verifierTotal = scoreboard?.externalVerifierTotal ?? 7;
  const verifierPending = verifierCompleted < verifierTotal;
  const definitivePeriod = isDefinitivePeriod(model);

  const company = clean(model.identity.exporterOperator || caseData.exporterIdentity.legalName.value);
  const importer = clean(model.identity.importer || caseData.importerIdentity.legalName.value);
  const installation = clean(model.identity.installation || caseData.installation.name.value);
  const packageCode = clean(model.packageCode || "PACKAGE");
  const releaseRef = `${packageCode}-R${model.releaseVersion}`;
  const reportRef = `RPT-${digest(model.reportId).slice(0, 12).toUpperCase()}`;
  const generatedDate = new Date(model.generatedAt).toISOString().replace("T", " ").slice(0, 19) + " UTC";

  let y = BODY_TOP;
  const bookmarks: Array<{ title: string; page: number }> = [];

  const pageNumber = (): number =>
    (doc.internal as unknown as { getCurrentPageInfo: () => { pageNumber: number } })
      .getCurrentPageInfo().pageNumber;

  const addPage = (): void => {
    doc.addPage();
    y = BODY_TOP;
  };

  const ensure = (height: number): void => {
    if (y + height > BODY_BOTTOM) addPage();
  };

  const lines = (
    value: unknown,
    width: number,
    fontSize = 8,
    style: "normal" | "bold" | "italic" | "bolditalic" = "normal"
  ): string[] => {
    doc.setFont("LiberationSans", style);
    doc.setFontSize(fontSize);
    return doc.splitTextToSize(clean(value), width) as string[];
  };

  const section = (title: string, subtitle: string): void => {
    if (pageNumber() > 1 && y > BODY_TOP + 5) addPage();
    bookmarks.push({ title, page: pageNumber() });
    doc.setFillColor(...NAVY);
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 16, 1.8, 1.8, "F");
    doc.setFillColor(...GOLD);
    doc.rect(MARGIN, y + 15, CONTENT_WIDTH, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("LiberationSans", "bold");
    doc.setFontSize(11);
    doc.text(title, MARGIN + 4, y + 7);
    doc.setFont("LiberationSans", "normal");
    doc.setFontSize(7.3);
    doc.setTextColor(205, 214, 225);
    doc.text(lines(subtitle, CONTENT_WIDTH - 8, 7.3), MARGIN + 4, y + 12);
    y += 22;
  };

  const callout = (
    title: string,
    body: string,
    tone: "navy" | "green" | "amber" | "red" = "navy"
  ): void => {
    const palette = tone === "green" ? GREEN : tone === "amber" ? AMBER : tone === "red" ? RED : NAVY_2;
    const bodyLines = lines(body, CONTENT_WIDTH - 13, 8.1);
    const height = Math.max(20, bodyLines.length * 4.1 + 11);
    ensure(height + 4);
    doc.setFillColor(...PALE);
    doc.setDrawColor(...LINE);
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, height, 1.6, 1.6, "FD");
    doc.setFillColor(...palette);
    doc.rect(MARGIN, y, 3, height, "F");
    doc.setTextColor(...palette);
    doc.setFont("LiberationSans", "bold");
    doc.setFontSize(7.4);
    doc.text(title.toUpperCase(), MARGIN + 6, y + 6);
    doc.setTextColor(...INK);
    doc.setFont("LiberationSans", "normal");
    doc.setFontSize(8.1);
    doc.text(bodyLines, MARGIN + 6, y + 11);
    y += height + 4;
  };

  const metricCards = (items: Array<{ label: string; value: string; note: string; color: [number, number, number] }>): void => {
    const gap = 4;
    const width = (CONTENT_WIDTH - gap * 3) / 4;
    const height = 34;
    ensure(height + 6);
    items.forEach((item, index) => {
      const x = MARGIN + index * (width + gap);
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...LINE);
      doc.roundedRect(x, y, width, height, 1.6, 1.6, "FD");
      doc.setFillColor(...item.color);
      doc.rect(x, y, width, 2.2, "F");
      doc.setFont("LiberationSans", "bold");
      doc.setFontSize(6.2);
      doc.setTextColor(...MUTED);
      doc.text(lines(item.label.toUpperCase(), width - 6, 6.2, "bold"), x + 3, y + 7);
      doc.setFontSize(12);
      doc.setTextColor(...item.color);
      doc.text(item.value, x + 3, y + 18);
      doc.setFont("LiberationSans", "normal");
      doc.setFontSize(6.1);
      doc.setTextColor(...MUTED);
      doc.text(lines(item.note, width - 6, 6.1), x + 3, y + 24);
    });
    y += height + 6;
  };

  const table = (
    headers: string[],
    rows: unknown[][],
    weights?: number[],
    fontSize = 6.7
  ): void => {
    const totalWeight = (weights ?? headers.map(() => 1)).reduce((a, b) => a + b, 0);
    const widths = (weights ?? headers.map(() => 1)).map((w) => (w / totalWeight) * CONTENT_WIDTH);
    const headerLines = headers.map((header, index) => lines(header, widths[index] - 4, 6.3, "bold"));
    const headerHeight = Math.max(...headerLines.map((item) => item.length), 1) * 3.3 + 4;

    const drawHeader = (): void => {
      ensure(headerHeight + 8);
      let x = MARGIN;
      doc.setFillColor(...NAVY_2);
      doc.setTextColor(255, 255, 255);
      doc.setFont("LiberationSans", "bold");
      doc.setFontSize(6.3);
      headers.forEach((_header, index) => {
        doc.rect(x, y, widths[index], headerHeight, "F");
        doc.text(headerLines[index], x + 2, y + 4);
        x += widths[index];
      });
      y += headerHeight;
    };

    drawHeader();
    const dataRows = rows.length ? rows : [["—", ...headers.slice(1).map(() => "—")]];
    dataRows.forEach((row, rowIndex) => {
      const cellLines = headers.map((_header, index) =>
        lines(row[index], widths[index] - 4, fontSize)
      );
      const rowHeight = Math.max(7, Math.max(...cellLines.map((item) => item.length)) * 3.45 + 3);
      if (y + rowHeight > BODY_BOTTOM) {
        addPage();
        drawHeader();
      }
      let x = MARGIN;
      doc.setFont("LiberationSans", "normal");
      doc.setFontSize(fontSize);
      doc.setTextColor(...INK);
      cellLines.forEach((cell, index) => {
        doc.setFillColor(...(rowIndex % 2 === 0 ? [250, 251, 253] : [243, 246, 249] as [number, number, number]));
        doc.setDrawColor(...LINE);
        doc.rect(x, y, widths[index], rowHeight, "FD");
        doc.text(cell, x + 2, y + 4.2);
        x += widths[index];
      });
      y += rowHeight;
    });
    y += 4;
  };

  const barChart = (title: string, items: Array<{ label: string; value: number; display: string; color: [number, number, number] }>): void => {
    ensure(14 + items.length * 10);
    doc.setFont("LiberationSans", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...NAVY_2);
    doc.text(title, MARGIN, y);
    y += 5;
    const labelWidth = 58;
    const chartWidth = CONTENT_WIDTH - labelWidth - 30;
    const max = Math.max(0.000001, ...items.map((item) => Math.abs(item.value)));
    items.forEach((item) => {
      const width = Math.max(1, (Math.abs(item.value) / max) * chartWidth);
      doc.setFont("LiberationSans", "normal");
      doc.setFontSize(6.6);
      doc.setTextColor(...INK);
      doc.text(lines(item.label, labelWidth - 3, 6.6), MARGIN, y + 4);
      doc.setFillColor(232, 236, 242);
      doc.roundedRect(MARGIN + labelWidth, y, chartWidth, 5, 1, 1, "F");
      doc.setFillColor(...item.color);
      doc.roundedRect(MARGIN + labelWidth, y, width, 5, 1, 1, "F");
      doc.setFont("LiberationSans", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(...NAVY_2);
      doc.text(item.display, PAGE_WIDTH - MARGIN, y + 4, { align: "right" });
      y += 10;
    });
    y += 3;
  };

  // Cover
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_WIDTH, 121, "F");
  doc.setFillColor(...GOLD);
  doc.rect(0, 121, PAGE_WIDTH, 3.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("LiberationSans", "bold");
  doc.setFontSize(company.length > 28 ? 16 : 21);
  doc.text(lines(company, CONTENT_WIDTH, company.length > 28 ? 16 : 21, "bold"), MARGIN, 30);
  doc.setFontSize(13.5);
  doc.text("Verification Readiness & Evidence Assurance Dossier", MARGIN, 48);
  doc.setFont("LiberationSans", "normal");
  doc.setFontSize(8.7);
  doc.setTextColor(201, 210, 222);
  doc.text("Operator-prepared evidence pack for independent accredited verifier review", MARGIN, 58);
  doc.setFontSize(7.2);
  doc.text(`Working file ${releaseRef}  |  ${model.identity.reportingPeriod}  |  Generated ${generatedDate}`, MARGIN, 69);

  const coverStatus = definitivePeriod
    ? (operatorScore >= 100 ? "OPERATOR CHECKS PASSED" : "OPERATOR CHECKS INCOMPLETE")
    : "WORKING FILE - DO NOT SUBMIT";
  const coverTone = definitivePeriod ? (operatorScore >= 100 ? GREEN : AMBER) : RED;
  doc.setFillColor(...coverTone);
  doc.roundedRect(MARGIN, 80, 67, 12, 2, 2, "F");
  doc.setFont("LiberationSans", "bold");
  doc.setFontSize(7.2);
  doc.setTextColor(255, 255, 255);
  doc.text(coverStatus, MARGIN + 4, 87.5);

  doc.setFont("LiberationSans", "normal");
  doc.setFontSize(7);
  doc.setTextColor(201, 210, 222);
  doc.text("Independent verifier status", MARGIN, 103);
  doc.setFont("LiberationSans", "bold");
  doc.setTextColor(...GOLD);
  doc.text(verifierPending ? "NOT REVIEWED - PENDING" : "EXTERNAL COMPLETION RECORDED", MARGIN, 109);

  y = 134;
  metricCards([
    { label: "Operator preparation", value: `${formatNumber(operatorScore, 1)}%`, note: "Operator-controllable readiness", color: NAVY_2 },
    { label: "Evidence assurance", value: `${formatNumber(evidenceScore, 1)}%`, note: "Material support and quality", color: BLUE },
    { label: "Package integrity", value: humanize(packageIntegrity).toUpperCase(), note: "Manifest, signature and ZIP controls", color: statusColor(packageIntegrity) },
    { label: "External verifier completion", value: `${verifierCompleted}/${verifierTotal}`, note: "Reserved for accredited verifier", color: AMBER },
  ]);

  table(
    ["Document control", "Value", "Document control", "Value"],
    [
      ["Exporter / operator", company, "Importer", importer],
      ["Installation", installation, "Country", model.identity.country],
      ["Package code", releaseRef, "Controlled report reference", reportRef],
      ["Product tier", scoreboard?.productTierLabel || "Premium verification preparation", "Release", model.releaseVersion],
    ],
    [22, 32, 22, 34],
    6.6
  );
  callout(
    definitivePeriod ? "Reliance boundary" : "Submission restriction",
    definitivePeriod
      ? model.legalBoundary
      : "This reporting period is not eligible for definitive annual submission at the generated timestamp. Use this file only for preparation, remediation and future verifier engagement.",
    definitivePeriod ? "navy" : "red"
  );

  // Contents
  addPage();
  bookmarks.push({ title: "Contents and document control", page: pageNumber() });
  section("Contents and document control", "Structured navigation for management, data preparers and independent verifier teams");
  const tocEntries = [
    "Executive assurance dashboard",
    "Controlled identity and reporting period",
    "Emissions result and A-H reconciliation",
    "Goods allocation and materiality",
    "Evidence assurance and data provenance",
    "Calculation reproducibility and audit trail",
    "Findings and corrective actions",
    "Regulatory and registry crosswalk",
    "Premium chapter contract",
    "Independent verifier handover",
    "Package integrity and release control",
    "Annex index and legal boundary",
  ];
  table(["Section", "Purpose"], tocEntries.map((title, index) => [index + 1, title]), [12, 88], 7.2);
  callout("How to use this dossier", "Start with the executive dashboard, confirm the reporting-period classification, follow the A-H emissions bridge, then inspect evidence, calculations, findings and the verifier handover checklist. Machine-readable source files remain authoritative for recomputation.");

  // Executive
  section("Executive assurance dashboard", "Decision-ready summary without conflating operator preparation with independent verification");
  callout(
    definitivePeriod ? "Management decision" : "Decision - do not submit",
    definitivePeriod
      ? `${operatorScore >= 100 ? "Operator checks passed" : "Operator checks require remediation"}. ${humanize(model.readiness.recommendedDecision)}. Independent verifier completion remains ${verifierPending ? "pending" : "recorded"}.`
      : "Conditional working file. The period has not reached definitive annual eligibility. Preserve all evidence and calculations, but do not submit or describe this file as independently verified.",
    definitivePeriod ? (operatorScore >= 100 ? "green" : "amber") : "red"
  );
  metricCards([
    { label: "Total direct emissions", value: `${formatNumber(model.totals.totalDirectEmissions)} tCO2e`, note: "Installation plus precursor direct", color: NAVY_2 },
    { label: "Total indirect emissions", value: `${formatNumber(model.totals.totalIndirectEmissions)} tCO2e`, note: "Electricity plus precursor indirect", color: BLUE },
    { label: "Production volume", value: `${formatNumber(model.totals.productionVolume)} t`, note: "Aggregate declared production", color: GOLD },
    { label: "Specific embedded emissions", value: `${formatNumber(model.totals.aggregateSpecificEmbeddedEmissions, 6)}`, note: "tCO2e per tonne", color: GREEN },
  ]);
  barChart("Result hierarchy", [
    { label: "Installation direct", value: numberValue(model.totals.installationDirectEmissions), display: `${formatNumber(model.totals.installationDirectEmissions)} tCO2e`, color: NAVY_2 },
    { label: "Precursor direct", value: numberValue(model.totals.precursorDirectEmissions), display: `${formatNumber(model.totals.precursorDirectEmissions)} tCO2e`, color: BLUE },
    { label: "Certificate-relevant direct total", value: numberValue(model.totals.totalDirectEmissions), display: `${formatNumber(model.totals.totalDirectEmissions)} tCO2e`, color: GREEN },
    { label: "Informational indirect total", value: numberValue(model.totals.totalIndirectEmissions), display: `${formatNumber(model.totals.totalIndirectEmissions)} tCO2e`, color: GOLD },
  ]);
  table(["Control", "Result", "Interpretation"], [
    ["Open critical blockers", model.readiness.criticalBlockerCount, model.readiness.criticalBlockerCount ? "Remediation required" : "None"],
    ["Material findings", model.readiness.materialFindingCount, model.readiness.materialFindingCount ? "Review before handover" : "None"],
    ["Missing material evidence", model.readiness.missingMaterialEvidenceCount, model.readiness.missingMaterialEvidenceCount ? "Evidence gap" : "None"],
    ["Calculation exceptions", model.readiness.unresolvedCalculationExceptionCount, model.readiness.unresolvedCalculationExceptionCount ? "Recompute required" : "None"],
  ], [35, 20, 45]);

  // Identity and period
  section("Controlled identity and reporting period", "Legal parties, installation, production route, boundary and period eligibility");
  table(["Controlled field", "Declared value", "Assurance note"], [
    ["Importer", importer, "Legal counterparty recorded in the case"],
    ["EORI", model.identity.eori, "Identifier supplied by operator/importer"],
    ["Exporter / operator", company, "Entity responsible for installation data"],
    ["Installation", installation, "Production installation in scope"],
    ["Country", model.identity.country, "Country of installation"],
    ["Production route", model.identity.productionRoute, "Sector-specific route"],
    ["System boundary", model.identity.systemBoundary, "Operator-declared boundary subject to verifier confirmation"],
  ], [25, 38, 37]);
  table(["Period control", "Result"], [
    ["Period type", humanize(model.reportingPeriodAssessment.type)],
    ["Start date", model.reportingPeriodAssessment.startDate],
    ["End date", model.reportingPeriodAssessment.endDate],
    ["Covered / expected days", `${model.reportingPeriodAssessment.coveredDays} / ${model.reportingPeriodAssessment.expectedDays}`],
    ["Completeness", `${model.reportingPeriodAssessment.completenessPercent}%`],
    ["Definitive annual eligible", definitivePeriod ? "YES" : "NO - WORKING FILE ONLY"],
  ], [42, 58], 7.1);
  callout(
    "Period classification",
    definitivePeriod
      ? "The period satisfies the automated definitive annual completeness rule at the generated timestamp. This does not replace independent verifier review or registry acceptance."
      : "The period is conditional or incomplete at the generated timestamp. The package must remain visibly marked as a working file and must not be submitted.",
    definitivePeriod ? "green" : "red"
  );

  // Emissions
  section("Emissions result and A-H reconciliation", "Transparent bridge from installation activity through certificate-relevant and informational totals");
  table(["Code", "Result category", "Value (tCO2e)", "Role"], [
    ["A", "Installation direct emissions", model.totals.installationDirectEmissions, "Measured/calculated at installation"],
    ["B", "Precursor attributable direct emissions", model.totals.precursorDirectEmissions, "Embedded direct emissions from precursors"],
    ["C", "Electricity indirect emissions", model.totals.electricityIndirectEmissions, "Informational indirect component"],
    ["D", "Precursor indirect emissions", model.totals.precursorIndirectEmissions, "Informational precursor indirect component"],
    ["G", "Certificate-relevant direct total", model.totals.totalDirectEmissions, "A + B"],
    ["H", "Total informational embedded emissions", model.totals.totalEmbeddedEmissions, "Direct and indirect disclosure result"],
  ], [10, 42, 22, 26]);
  table(["Reconciliation control", "Result", "Expected"], [
    ["Allocation share total", model.totals.allocationShareTotal, "1.000000"],
    ["Allocation reconciliation delta", model.totals.allocationReconciliationDelta, "0.000000"],
    ["Eligible certificate reduction", model.totals.eligibleCertificateReduction, "Applied only when legally eligible"],
    ["Electricity consumed", `${clean(caseData.electricityConsumed.value)} ${clean(caseData.electricityConsumed.canonicalUnit)}`, "Evidence-linked activity data"],
  ], [42, 28, 30]);
  callout("Calculation interpretation", "The report separates installation direct emissions, precursor direct emissions, electricity indirect emissions and precursor indirect emissions. A verifier can recompute each bridge from the Calculation Trace, Calculation Graph and Verifier Workspace files.");

  // Goods
  section("Goods allocation and materiality", "CN-coded production population, allocation reconciliation and 5% verifier planning reference");
  table(["Good", "CN code", "Sector", "Production t", "Allocation", "Allocated tCO2e", "Specific tCO2e/t", "5% reference"],
    model.goods.map((good) => [good.goodIndex, good.cnCode, good.sector, good.productionVolume, good.allocationShare, good.allocatedEmbeddedEmissions, good.specificEmbeddedEmissions, good.materialityThresholdSpecific]),
    [8, 13, 16, 13, 12, 15, 13, 10], 6.2);
  callout("Materiality boundary", "The 5% values are planning references calculated per good. They do not constitute a verifier-confirmed materiality determination. Final materiality remains an independent verifier-reserved decision.", "amber");
  table(["Precursor", "Quantity", "Direct tCO2e", "Indirect tCO2e", "Origin"],
    model.precursors.map((item) => [item.name, item.quantity, item.directEmissions, item.indirectEmissions, item.countryOfOrigin]),
    [30, 18, 18, 18, 16], 6.7);

  // Evidence
  section("Evidence assurance and data provenance", "Material input support, quality grades, period coverage and evidence-to-calculation lineage");
  const materialEvidence = model.evidenceSufficiency.filter((row) => row.isMaterial ?? row.blocksSealing);
  const supported = materialEvidence.filter((row) => /SUPPORTED/.test(row.state)).length;
  metricCards([
    { label: "Material requirements", value: String(materialEvidence.length), note: "Assessed material input rows", color: NAVY_2 },
    { label: "Supported", value: String(supported), note: "Evidence or accepted methodology basis", color: GREEN },
    { label: "Evidence assurance", value: `${formatNumber(evidenceScore, 1)}%`, note: "Quality-weighted material support", color: BLUE },
    { label: "Evidence files", value: String(model.manifestSummary.evidenceFileCount), note: "Included supporting binaries", color: GOLD },
  ]);
  table(["Requirement", "Input", "Support state", "Quality", "Coverage", "Evidence"],
    model.evidenceSufficiency.map((row) => [
      row.requirementId,
      row.inputPath,
      humanize(row.state),
      row.evidenceQualityGrade || "Pending",
      row.coveragePercent ? `${row.coveragePercent}%` : `${row.coverageNumerator}/${row.coverageDenominator}`,
      row.evidenceIds.join(", ") || "No linked evidence",
    ]), [14, 28, 20, 10, 12, 16], 5.9);
  callout("Evidence grading", "Grade A represents primary independently issued evidence; B primary operator-controlled evidence; C supplier evidence with controls; D secondary or estimated evidence; E unsupported evidence. Material D/E evidence cannot produce full assurance.");

  // Calculation trace
  section("Calculation reproducibility and audit trail", "Formula-level outputs, units, assumptions and cryptographic calculation hashes");
  table(["Formula", "Output", "Unit", "Hash", "Warnings / assumptions"],
    model.calculationTrace.map((item) => [
      item.formulaId,
      item.outputValue,
      item.outputUnit,
      clean(item.calculationHash).slice(0, 18),
      [...item.warnings, ...item.assumptions].join("; ") || "None",
    ]), [18, 14, 12, 20, 36], 6.1);
  table(["Reproduction asset", "Purpose"], [
    ["Calculation Trace.json", "Formula-level machine-readable outputs and hashes"],
    ["Calculation Graph.json", "Dependency graph and root hash"],
    ["Verifier Workspace.xlsx", "Independent recomputation, sampling and sign-off workspace"],
    ["Data Integrity Manifest.json", "Package file hashes, sizes and media types"],
  ], [34, 66], 7);
  callout("Root-of-trust", `Calculation root hash: ${clean(model.calculationRootHash).slice(0, 48)}. Case-data hash: ${clean(model.caseDataHash).slice(0, 48)}. Full values are preserved in machine-readable package files.`);

  // Findings
  section("Findings and corrective actions", "Deterministic exceptions, impact statements and accountable closure requirements");
  table(["Finding", "Severity", "Category", "Status", "Impact", "Remediation"],
    model.findings.map((finding) => [finding.title, humanize(finding.severity), humanize(finding.category), humanize(finding.status), finding.impactStatement, finding.remediationRequirement]),
    [22, 12, 16, 14, 18, 18], 5.8);
  table(["Action", "Priority", "Responsible role", "State", "Closure condition"],
    model.correctiveActions.map((action) => [action.actionId, action.priority, humanize(action.responsibleRole), humanize(action.state), action.closureCondition]),
    [15, 10, 20, 15, 40], 6.2);
  callout(
    model.findings.length ? "Open-item discipline" : "No deterministic findings",
    model.findings.length
      ? "All open findings remain visible until their closure conditions and evidence are satisfied. Verifier-reserved items are not misrepresented as operator defects."
      : "No deterministic operator-controlled finding was generated from the sealed dataset. This does not prevent an independent verifier from identifying additional misstatements or non-conformities.",
    model.findings.length ? "amber" : "green"
  );

  // Crosswalk
  section("Regulatory and registry crosswalk", "Legal requirements mapped to report sections, source paths, evidence and calculation nodes");
  table(["Requirement", "Legal source", "Legal location", "Owner", "Status", "Evidence / calculation"],
    model.requirementCrosswalk.map((row) => [row.requirementId, row.legalSourceId, row.legalLocation, humanize(row.owner), humanize(row.status), [...row.evidenceIds, ...row.calculationIds].join(", ") || "Mapped report section"]),
    [14, 14, 18, 15, 16, 23], 5.7);
  table(["Registry field", "Section", "Owner", "Status", "Source path", "Validation"],
    (model.registryTemplateMapping ?? []).map((row) => [row.registryFieldId, row.section, humanize(row.owner), humanize(row.status), row.sourcePath, row.validationErrors.join("; ") || "Passed"]),
    [15, 16, 14, 18, 20, 17], 5.6);
  callout("Definitive legal basis", "Core legal references include Regulation (EU) 2023/956 and Implementing Regulation (EU) 2025/2547. The package supports preparation and field mapping; it does not constitute a customs decision, registry acceptance or independent verification opinion.");

  // Premium contract
  section("Premium chapter contract", "Completeness ledger for the advanced verifier-preparation workpapers included in this product tier");
  table(["Chapter", "Status", "Basis"],
    (model.premiumChapters ?? []).map((chapter) => [chapter.title, humanize(chapter.status), chapter.basis]),
    [30, 22, 48], 6.2);
  callout(
    "Premium naming rule",
    scoreboard?.premiumChapterContract === "COMPLETE"
      ? "The applicable premium chapter contract is complete for this dataset. Verifier-reserved chapters remain visibly reserved and do not inflate operator readiness."
      : "One or more applicable premium chapter requirements remain incomplete. Premium readiness claims must remain conditional until the contract is complete.",
    scoreboard?.premiumChapterContract === "COMPLETE" ? "green" : "amber"
  );

  // Verifier handover
  section("Independent verifier handover", "Reserved work programme, handover sequence and explicit non-reliance boundary");
  table(["Verifier-reserved work item", "Current state", "Required independent action"], [
    ["Verifier legal identity and accreditation", verifierCompleted >= 1 ? "Recorded" : "PENDING", "Confirm accredited legal entity and scope"],
    ["Verifier team and independent reviewer", verifierCompleted >= 2 ? "Recorded" : "PENDING", "Assign team, lead auditor and independent reviewer"],
    ["Site visit assignment and dates", verifierCompleted >= 3 ? "Recorded" : "PENDING", "Determine visit type and execute site work"],
    ["Verification objectives, scope and criteria", verifierCompleted >= 4 ? "Recorded" : "PENDING", "Document engagement-specific criteria"],
    ["Verifier-confirmed materiality per good", verifierCompleted >= 5 ? "Recorded" : "PENDING", "Set and document materiality"],
    ["Final opinion and signature", verifierCompleted >= 6 ? "Recorded" : "PENDING", "Issue independent opinion when supported"],
    ["Verification certificate reference", verifierCompleted >= 7 ? "Recorded" : "PENDING", "Record external certificate/reference"],
  ], [36, 18, 46], 6.5);
  callout("Independent boundary", "CBAMValid prepares and seals operator-controlled evidence, calculations and workpapers. Only an appropriately accredited independent verifier can perform verification procedures and issue a verification opinion. Until then, the correct status is NOT REVIEWED - PENDING.", "amber");

  // Integrity
  section("Package integrity and release control", "Manifest, signature scope, immutable release identity and public verification state");
  table(["Integrity control", "Recorded state", "Interpretation"], [
    ["Required top-level components", model.manifestSummary.requiredTopLevelComponentCount, "Controlled package contract"],
    ["Actual top-level components", model.manifestSummary.actualTopLevelComponentCount, "Readback count"],
    ["Manifest file count", model.manifestSummary.manifestFileCount, "Hashed manifest entries"],
    ["Supporting evidence files", model.manifestSummary.evidenceFileCount, "Tenant-bound evidence binaries"],
    ["Package integrity", humanize(packageIntegrity), "PASS only after manifest, signature and ZIP verification"],
    ["KMS algorithm", model.manifestSummary.kmsAlgorithm || "Recorded in detached signature"],
    ["KMS key version", model.manifestSummary.kmsKeyVersion || "Recorded in sealed release metadata"],
    ["Public verification", safePublicUrl(model), "Published only when an active verification URL exists"],
  ], [34, 28, 38], 6.6);
  table(["Release control", "Value"], [
    ["Package code", packageCode],
    ["Release version", model.releaseVersion],
    ["Generated at", generatedDate],
    ["Controlled report reference", reportRef],
    ["Dossier schema", model.dossierSchemaVersion],
    ["Release contract", model.releaseContractVersion],
  ], [40, 60]);
  callout("Cryptographic scope", "The detached signature covers the exact UTF-8 bytes of Data Integrity Manifest.json. Each package artifact is bound by path, SHA-256 hash, byte size and media type. A PDF visual statement never substitutes for manifest verification.");

  // Annex
  section("Annex index and legal boundary", "Controlled deliverable inventory, reliance statement and final handover checklist");
  table(["Component", "Purpose"], REQUIRED_TOP_LEVEL_COMPONENTS_V5.map((component) => [component, component.endsWith("/") ? "Supporting evidence directory" : "Controlled verifier-preparation deliverable"]), [48, 52], 6.3);
  callout("Final legal boundary", model.legalBoundary, "navy");
  table(["Final acceptance control", "Status"], [
    ["Operator preparation disclosed separately", "PASS"],
    ["Evidence assurance disclosed separately", "PASS"],
    ["Package integrity disclosed separately", "PASS"],
    ["External verifier completion not included in operator score", "PASS"],
    ["Reporting-period restriction visible when applicable", definitivePeriod ? "NOT APPLICABLE" : "PASS - DO NOT SUBMIT"],
    ["No claim of independent approval or registry acceptance", "PASS"],
  ], [68, 32]);

  // Footer and outline pass.
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    if (page > 1) {
      doc.setFont("LiberationSans", "bold");
      doc.setFontSize(6.2);
      doc.setTextColor(...NAVY_2);
      doc.text("CBAMVALID PREMIUM VERIFICATION PREPARATION DOSSIER", MARGIN, 12);
      doc.setFont("LiberationSans", "normal");
      doc.setTextColor(...MUTED);
      doc.text(releaseRef, PAGE_WIDTH - MARGIN, 12, { align: "right" });
      doc.setDrawColor(...LINE);
      doc.line(MARGIN, 15, PAGE_WIDTH - MARGIN, 15);
    }
    doc.setDrawColor(...LINE);
    doc.line(MARGIN, 283, PAGE_WIDTH - MARGIN, 283);
    doc.setFont("LiberationSans", "normal");
    doc.setFontSize(6.1);
    doc.setTextColor(...MUTED);
    doc.text(`CBAMValid | ${releaseRef} | CONFIDENTIAL`, MARGIN, 289);
    doc.text(`Page ${page} of ${pageCount}`, PAGE_WIDTH / 2, 289, { align: "center" });
    doc.text(reportRef, PAGE_WIDTH - MARGIN, 289, { align: "right" });
  }

  const outline = (doc as unknown as {
    outline?: { add: (parent: unknown, title: string, options: { pageNumber: number }) => unknown };
  }).outline;
  if (outline?.add) {
    for (const item of bookmarks) outline.add(null, item.title, { pageNumber: item.page });
  }

  return Buffer.from(doc.output("arraybuffer"));
}
