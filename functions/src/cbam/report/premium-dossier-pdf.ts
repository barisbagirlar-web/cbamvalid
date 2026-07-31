import crypto from "node:crypto";
import { jsPDF } from "jspdf";
import type { PremiumDossierViewModelV2 } from "./premium-dossier-schema";
import { getReportingPeriodAssessment } from "../validation/readiness-score";
import type { AuditReadyCase } from "../schema";
import { assertSectorSealable, type CbamSector } from "../sectors/sector-adapter";
import { OFFICIAL_SOURCES } from "../registry/legal-sources";
import { REQUIRED_TOP_LEVEL_COMPONENTS_V5, REQUIRED_TOP_LEVEL_COMPONENT_COUNT_V5 } from "./package-components";
import { buildCryptoClaims, integrityManifestWording } from "../../dossier/70-seal/crypto-claims";
import { applicableActStack } from "../../dossier/01-ruleset/regulations.registry";
import { releaseHistoryNarrative } from "../../dossier/50-model/version-stamp";
import { ANNEX_II_EXCLUSION_NOTE, getSectorRule } from "../../dossier/01-ruleset/sectors.rules";
import { evaluateEnterpriseChapters } from "../../dossier/50-model/enterprise-chapters";

const CALCULATION_LEGAL_CITATION = `${OFFICIAL_SOURCES.IMPL_2025_2547.title} (CELEX ${OFFICIAL_SOURCES.IMPL_2025_2547.celexId})`;
const COMPONENT_COUNT_V5 = REQUIRED_TOP_LEVEL_COMPONENT_COUNT_V5;

const COMPONENT_ANNEX_DESCRIPTIONS: Record<string, [string, string]> = {
  "CBAMValid Verification Readiness & Evidence Assurance Dossier.pdf": ["PDF", "Primary executive & verifier readiness dossier"],
  "Complete Dossier Compilation.pdf": ["PDF", "Technical compilation & calculation annexes"],
  "Product Scope Assessment.pdf": ["PDF", "System boundary & sectoral scope register"],
  "CN Code Reasoning.pdf": ["PDF", "Combined Nomenclature goods classification logic"],
  "Required Data Checklist.pdf": ["PDF", "Mandatory input data completeness ledger"],
  "Installation Monitoring Plan.pdf": ["PDF", "Monitoring methodology & metering calibration plan"],
  "Production Process Map.pdf": ["PDF", "Functional process units & flow diagram"],
  "System Boundary Register.pdf": ["PDF", "Direct & indirect emissions boundary register"],
  "Source Stream Register.csv": ["CSV", "Fuel, input material & mass balance data streams"],
  "Emission Source Register.csv": ["CSV", "Stack, burner & process emission sources"],
  "Measurement and Meter Register.csv": ["CSV", "Metering instruments & uncertainty log"],
  "Activity Data Ledger.csv": ["CSV", "Daily/monthly raw activity data records"],
  "Evidence Register.csv": ["CSV", "Physical evidence files index & SHA-256 hashes"],
  "Field-to-Evidence Matrix.csv": ["CSV", "Input path to file hash audit crosswalk"],
  "Methodology Decision Log.pdf": ["PDF", "Operator methodological justification log"],
  "Embedded Emissions Calculation Annex.pdf": ["PDF", "Step-by-step mathematical trace annex"],
  "Operator Emissions Report.pdf": ["PDF", "Official operator statement & declaration"],
  "Misstatement and Non-Conformity Register.csv": ["CSV", "Quality controls & findings register"],
  "Corrective Action Log.csv": ["CSV", "Remediation action tracking ledger"],
  "O3CI Field Mapping.csv": ["CSV", "Registry export data field crosswalk"],
  "Calculation Trace.json": ["JSON", "Machine-readable cryptographic node hash tree"],
  "Calculation Graph.json": ["JSON", "Machine-readable calculation graph with node hashes and root hash"],
  "Verifier Workspace.xlsx": ["XLSX", "Interactive multi-sheet verifier navigation workbook"],
  "Data Integrity Manifest.json": ["JSON", "Cryptographic package manifest & hash index"],
  "Manifest Signature.sig": ["SIG", "KMS detached signature over the integrity manifest"],
  "Supporting_Evidence/": ["DIR", "Tenant-bound source evidence binaries"],
};

const PAGE_WIDTH = 210;
const MARGIN = 15;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BODY_TOP = 40;
const BODY_BOTTOM = 275;

function digest(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function asText(value: unknown): string {
  return String(value ?? "—").trim() || "—";
}

function formatEnum(val: string): string {
  if (!val || val === "—") return "—";
  return val
    .split("_")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function buildPremiumDossierPdf(model: PremiumDossierViewModelV2, caseData: AuditReadyCase): Buffer {
  const uniqueSectors = new Set(caseData.goods.map((item) => item.sector));
  const methodologies = [...uniqueSectors].map((sector) => assertSectorSealable(sector as CbamSector));
  const componentCount = model.manifestSummary?.requiredTopLevelComponentCount || COMPONENT_COUNT_V5;
  const cryptoClaims = buildCryptoClaims({
    protectionLevel: model.manifestSummary?.kmsProtectionLevel,
    componentCount,
    publicVerificationUrl: model.manifestSummary?.publicVerificationUrl,
  });

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  doc.setCreationDate(new Date(model.generatedAt));
  doc.setFileId(digest(`${model.reportId}:PremiumDossier`).slice(0, 32).toUpperCase());
  doc.setProperties({
    title: model.documentTitle,
    subject: "CBAM Verification Readiness Pack",
    author: "CBAMValid",
    creator: "CBAMValid Premium Dossier Engine 5.0",
    keywords: "CBAM, verifier, readiness, evidence, materiality, trace, dossier",
  });

  let y = BODY_TOP;
  const sectionPages: Record<number, number> = {};

  const ensure = (height: number) => {
    if (y + height > BODY_BOTTOM) {
      doc.addPage();
      y = BODY_TOP;
    }
  };

  const drawParagraph = (text: string) => {
    doc.setTextColor(43, 51, 64);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const lines = doc.splitTextToSize(asText(text), CONTENT_WIDTH) as string[];
    ensure(lines.length * 4.5 + 2);
    doc.text(lines, MARGIN, y);
    y += lines.length * 4.5 + 2;
  };

  const drawCallout = (label: string, value: string) => {
    const labelText = label.toUpperCase().trim();
    const valueText = asText(value);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    const labelLines = doc.splitTextToSize(labelText, CONTENT_WIDTH - 10) as string[];
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.0);
    const valueLines = doc.splitTextToSize(valueText, CONTENT_WIDTH - 10) as string[];

    const labelHeight = labelLines.length * 3.8;
    const valueHeight = valueLines.length * 4.0;
    const paddingY = 3.5;
    const totalHeight = paddingY + labelHeight + 1.5 + valueHeight + paddingY;

    ensure(totalHeight + 3);

    // Callout Container Box
    doc.setFillColor(244, 247, 250);
    doc.setDrawColor(190, 199, 210);
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, totalHeight, 1.5, 1.5, "FD");

    // Gold Left Accent Bar
    doc.setFillColor(201, 154, 73);
    doc.rect(MARGIN, y, 2.5, totalHeight, "F");

    // Label Text
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(20, 42, 74);
    doc.text(labelLines, MARGIN + 5, y + paddingY + 3);

    // Value Text
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.0);
    doc.setTextColor(43, 51, 64);
    doc.text(valueLines, MARGIN + 5, y + paddingY + labelHeight + 3);

    y += totalHeight + 3;
  };

  // FAZ 9: controlled wrapping — unbroken UUID / requirement-ID tokens are
  // broken at hyphen boundaries (and only then) so they never overflow cells.
  const breakLongTokens = (value: string, maxWidth: number): string => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    const text = String(value ?? "").trim();
    if (!text) return "—";
    return text
      .split(/\s+/)
      .map((token) => {
        if (doc.getTextWidth(token) <= maxWidth) return token;
        const parts = token.split("-");
        const rebuilt: string[] = [];
        let current = "";
        for (const part of parts) {
          const candidate = current ? `${current}-${part}` : part;
          if (doc.getTextWidth(candidate) <= maxWidth) {
            current = candidate;
          } else {
            if (current) rebuilt.push(current);
            current = part;
          }
        }
        if (current) rebuilt.push(current);
        return rebuilt.length > 1 ? rebuilt.join(" ") : token;
      })
      .join(" ");
  };

  const drawTable = (headers: string[], rows: unknown[][], widths?: number[]) => {
    if (headers.length === 0) return;
    const colWidths = widths && widths.length === headers.length
      ? widths.map(w => (w / widths.reduce((s, x) => s + x, 0)) * CONTENT_WIDTH)
      : Array.from({ length: headers.length }, () => CONTENT_WIDTH / headers.length);

    const headerLines = headers.map((header, index) =>
      doc.splitTextToSize(header, colWidths[index] - 4) as string[]
    );
    const maxHeaderLines = Math.max(1, ...headerLines.map(lines => lines.length));
    const headerHeight = maxHeaderLines * 3.6 + 4.0;

    const drawHeader = () => {
      // Header + minimum 2 rows must be kept together
      ensure(headerHeight + 12);
      doc.setFillColor(12, 30, 54);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.0);
      let x = MARGIN;
      headers.forEach((header, index) => {
        doc.rect(x, y, colWidths[index], headerHeight, "F");
        const lines = headerLines[index];
        doc.text(lines, x + 2, y + 4.5);
        x += colWidths[index];
      });
      y += headerHeight;
    };

    drawHeader();
    
    rows.forEach((row, rowIndex) => {
      let cellLines = headers.map((_, colIndex) =>
        doc.splitTextToSize(breakLongTokens(asText(row[colIndex]), colWidths[colIndex] - 4), colWidths[colIndex] - 4) as string[]
      );

      while (cellLines.some(lines => lines.length > 0)) {
        const availableHeight = BODY_BOTTOM - y;
        const linesThatFit = Math.floor((availableHeight - 4) / 3.6);
        
        if (linesThatFit < 1) {
          doc.addPage();
          y = BODY_TOP;
          drawHeader();
          continue;
        }

        const maxLinesInCells = Math.max(...cellLines.map(lines => lines.length));
        const chunkLineCount = Math.min(linesThatFit, maxLinesInCells);
        const chunkHeight = Math.max(6.5, chunkLineCount * 3.6 + 2.5);

        doc.setDrawColor(215, 221, 229);
        doc.setTextColor(43, 51, 64);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.8);

        let x = MARGIN;
        cellLines.forEach((lines, colIndex) => {
          doc.setFillColor(rowIndex % 2 === 0 ? 248 : 239, rowIndex % 2 === 0 ? 250 : 244, rowIndex % 2 === 0 ? 252 : 248);
          doc.rect(x, y, colWidths[colIndex], chunkHeight, "FD");

          const chunkText = lines.slice(0, chunkLineCount);
          doc.text(chunkText, x + 2, y + 4.2);

          x += colWidths[colIndex];
        });

        cellLines = cellLines.map(lines => lines.slice(chunkLineCount));
        y += chunkHeight;

        if (cellLines.some(lines => lines.length > 0)) {
          doc.addPage();
          y = BODY_TOP;
          drawHeader();
        }
      }
    });
    y += 2.5;
  };

  interface SectionPreview {
    height: number;
  }

  const paragraphPreview = (text: string, width = CONTENT_WIDTH): SectionPreview => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    const lines = doc.splitTextToSize(asText(text), width);
    return { height: lines.length * 3.5 + 3 };
  };


  const tablePreview = (headers: string[], rows: unknown[][], widths?: number[]): SectionPreview => {
    const colWidths = widths && widths.length === headers.length
      ? widths.map(w => (w / widths.reduce((s, x) => s + x, 0)) * CONTENT_WIDTH)
      : Array.from({ length: headers.length }, () => CONTENT_WIDTH / headers.length);
    const headerLines = headers.map((header, index) =>
      doc.splitTextToSize(header, colWidths[index] - 2) as string[]
    );
    const maxHeaderLines = Math.max(1, ...headerLines.map(lines => lines.length));
    const headerHeight = maxHeaderLines * 3.5 + 3.5;
    
    let rowsHeight = 0;
    const firstTwo = rows.slice(0, 2);
    firstTwo.forEach((row) => {
      const cellLines = headers.map((_, colIndex) =>
        doc.splitTextToSize(asText((row as unknown[])[colIndex]), colWidths[colIndex] - 2) as string[]
      );
      const maxLines = Math.max(...cellLines.map(lines => lines.length));
      rowsHeight += Math.max(6, maxLines * 3.5 + 2);
    });
    if (firstTwo.length < 2) {
      rowsHeight += (2 - firstTwo.length) * 8;
    }
    return { height: headerHeight + rowsHeight };
  };

  const beginSection = (
    numOrParams: number | { number: number; title: string; preview: () => SectionPreview },
    title?: string,
    contentHeight?: number
  ) => {
    let num: number;
    let sectionTitle: string;
    let requiredHeight: number;

    if (typeof numOrParams === "object") {
      num = numOrParams.number;
      sectionTitle = numOrParams.title;
      requiredHeight = numOrParams.preview().height;
    } else {
      num = numOrParams;
      sectionTitle = title || "";
      requiredHeight = contentHeight || 35;
    }

    const headingHeight = 9;
    ensure(headingHeight + requiredHeight);
    sectionPages[num] = num === 4 ? 3 : (doc.internal as unknown as { getCurrentPageInfo: () => { pageNumber: number } }).getCurrentPageInfo().pageNumber;
    doc.setFillColor(231, 237, 244);
    doc.rect(MARGIN, y, CONTENT_WIDTH, 7, "F");
    doc.setTextColor(20, 42, 74);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(`${num}. ${sectionTitle}`, MARGIN + 2, y + 4.8);
    y += 9;
  };

  const drawChapterHeader = (chapterTitle: string, subtitle?: string) => {
    doc.addPage();
    y = BODY_TOP;
    doc.setFillColor(12, 30, 54);
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 12, 1.5, 1.5, "F");
    doc.setFillColor(201, 154, 73);
    doc.rect(MARGIN, y + 12, CONTENT_WIDTH, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(chapterTitle.toUpperCase(), MARGIN + 4, y + 7.5);
    if (subtitle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(201, 154, 73);
      doc.text(subtitle, PAGE_WIDTH - MARGIN - 4, y + 7.5, { align: "right" });
    }
    y += 18;
  };

  // ----- FAZ 8: data-driven visualisations (real data only, no decoration) -----
  const NAVY: [number, number, number] = [47, 119, 172];
  const STEEL: [number, number, number] = [150, 160, 175];
  const GOLD: [number, number, number] = [201, 154, 73];
  const GREEN: [number, number, number] = [52, 148, 96];
  const RED: [number, number, number] = [198, 88, 48];

  const drawBarChart = (
    title: string,
    rows: Array<{ label: string; value: number; color?: [number, number, number]; suffix?: string }>
  ) => {
    ensure(22 + rows.length * 7);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.4);
    doc.setTextColor(20, 42, 74);
    doc.text(title, MARGIN, y);
    y += 4;
    const chartLeft = MARGIN + 42;
    const chartWidth = CONTENT_WIDTH - 42;
    const maxValue = Math.max(0.000001, ...rows.map((row) => Math.abs(row.value)));
    rows.forEach((row) => {
      const barWidth = (Math.abs(row.value) / maxValue) * chartWidth;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.6);
      doc.setTextColor(60, 70, 85);
      doc.text(doc.splitTextToSize(row.label, 38) as string[], MARGIN, y + 3);
      const color = row.color ?? NAVY;
      doc.setFillColor(color[0], color[1], color[2]);
      doc.rect(chartLeft, y, Math.max(barWidth, row.value === 0 ? 0.8 : 1.5), 4, "F");
      doc.setTextColor(20, 42, 74);
      doc.setFont("helvetica", "bold");
      doc.text(`${row.value}${row.suffix ?? ""}`, chartLeft + barWidth + 1.5, y + 3);
      y += 7;
    });
    y += 4;
  };

  const drawFlowBoxes = (steps: string[]) => {
    ensure(26 + steps.length * 11);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.4);
    doc.setTextColor(20, 42, 74);
    steps.forEach((step, index) => {
      doc.setFillColor(index === 0 ? 12 : 34, index === 0 ? 30 : 50, index === 0 ? 54 : 75);
      doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 9, 1, 1, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.0);
      doc.text(`${index + 1}`, MARGIN + 3, y + 5.5);
      doc.setFont("helvetica", "normal");
      doc.text(doc.splitTextToSize(step, CONTENT_WIDTH - 14) as string[], MARGIN + 9, y + 5.5);
      if (index < steps.length - 1) {
        doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
        doc.setLineWidth(0.5);
        doc.line(MARGIN + CONTENT_WIDTH / 2, y + 9, MARGIN + CONTENT_WIDTH / 2, y + 11);
        doc.setLineWidth(0.2);
      }
      y += 11;
    });
    y += 3;
  };

  const drawBoundaryBox = (included: string[], excluded: string[]) => {
    ensure(30 + Math.max(included.length, excluded.length) * 5);
    doc.setDrawColor(20, 42, 74);
    doc.setLineWidth(0.6);
    doc.rect(MARGIN, y, CONTENT_WIDTH / 2 - 2, 18 + included.length * 5, "S");
    doc.rect(MARGIN + CONTENT_WIDTH / 2 + 2, y, CONTENT_WIDTH / 2 - 2, 18 + Math.max(1, excluded.length) * 5, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.0);
    doc.setTextColor(20, 42, 74);
    doc.text("INCLUDED PROCESSES (inside boundary)", MARGIN + 2, y + 4);
    doc.text("EXCLUDED PROCESSES (outside boundary)", MARGIN + CONTENT_WIDTH / 2 + 4, y + 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.6);
    doc.setTextColor(43, 51, 64);
    const writeList = (items: string[], left: number) => {
      items.slice(0, 8).forEach((item, index) => doc.text(doc.splitTextToSize(item, CONTENT_WIDTH / 2 - 8) as string[], left, y + 8 + index * 5));
      if (items.length === 0) doc.text("—", left, y + 8);
    };
    writeList(included.length ? included : ["—"], MARGIN + 2);
    writeList(excluded.length ? excluded : ["—"], MARGIN + CONTENT_WIDTH / 2 + 4);
    y += 24 + Math.max(included.length, Math.max(1, excluded.length)) * 5;
  };

  const drawRiskHeatMatrix = (entries: ReadonlyArray<{ likelihood: string; impact: string }>) => {
    ensure(30);
    const cell = 8;
    const gridLeft = MARGIN + 24;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.2);
    doc.setTextColor(20, 42, 74);
    doc.text("Risk heat matrix — count of register entries by likelihood x impact", MARGIN, y);
    y += 3;
    const impactLabels = ["Impact: LOW", "Impact: MODERATE", "Impact: HIGH"];
    impactLabels.forEach((label, col) => doc.text(label, gridLeft + col * (cell + 1.5) + 4, y + 3));
    y += 4.5;
    const countFor = (likelihood: string, impact: string) =>
      entries.filter((entry) => entry.likelihood === likelihood && entry.impact === impact).length;
    ["HIGH", "MODERATE", "LOW"].forEach((likelihood) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.4);
      doc.setTextColor(20, 42, 74);
      doc.text(likelihood, MARGIN, y + 4);
      ["LOW", "MODERATE", "HIGH"].forEach((impact, col) => {
        const count = countFor(likelihood, impact);
        const color = likelihood === "HIGH" ? RED : likelihood === "MODERATE" ? GOLD : GREEN;
        doc.setFillColor(color[0], color[1], color[2]);
        doc.rect(gridLeft + col * (cell + 1.5), y, cell, cell, "F");
        doc.setTextColor(255, 255, 255);
        doc.text(String(count), gridLeft + col * (cell + 1.5) + cell / 2, y + 4.5, { align: "center" });
      });
      y += cell + 1.5;
    });
    y += 4;
  };

  const drawLineageChain = (labels: string[]) => {
    ensure(20 + labels.length * 8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.0);
    doc.setTextColor(20, 42, 74);
    const boxWidth = (CONTENT_WIDTH - (labels.length - 1) * 4) / labels.length;
    labels.forEach((label, index) => {
      doc.setFillColor(index % 2 === 0 ? 47 : 201, index % 2 === 0 ? 119 : 154, index % 2 === 0 ? 172 : 73);
      doc.rect(MARGIN + index * (boxWidth + 4), y, boxWidth, 10, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.8);
      doc.text(doc.splitTextToSize(label, boxWidth - 2) as string[], MARGIN + index * (boxWidth + 4) + 1, y + 5, { align: "center" });
      if (index < labels.length - 1) {
        doc.setDrawColor(20, 42, 74);
        doc.setLineWidth(0.4);
        doc.line(MARGIN + (index + 1) * (boxWidth + 4) - 4, y + 5, MARGIN + (index + 1) * (boxWidth + 4), y + 5);
        doc.setLineWidth(0.2);
      }
    });
    y += 14;
  };

  // ==========================================
  // PAGE 1: COVER PAGE
  // ==========================================
  // Deep Navy background for top cover
  doc.setFillColor(12, 30, 54);
  doc.rect(0, 0, PAGE_WIDTH, 115, "F");

  // Gold accent separator bar
  doc.setFillColor(201, 154, 73);
  doc.rect(0, 115, PAGE_WIDTH, 3.5, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  const companyName = String(model.identity?.exporterOperator || caseData.exporterIdentity?.legalName?.value || "CBAMExporter").trim();
  if (companyName.length > 25) {
    doc.setFontSize(16);
  } else if (companyName.length > 15) {
    doc.setFontSize(19);
  } else {
    doc.setFontSize(22);
  }
  doc.text(companyName, MARGIN, 35);
  
  // Gold subtitle tag line
  doc.setFontSize(14);
  doc.text("Verification Readiness & Evidence Assurance Dossier", MARGIN, 48);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(190, 200, 215);
  doc.text("Prepared for Independent Accredited Verifier Review", MARGIN, 58);

  // Status Box on Cover — always use sealed generatedAt, never wall-clock Date.now()
  const periodAssessment = model.reportingPeriodAssessment ?? getReportingPeriodAssessment(caseData, model.generatedAt);
  const isReady =
    model.readiness.operatorStatus === "OPERATOR_PREPARATION_COMPLETE" &&
    model.readiness.recommendedDecision === "READY_FOR_ACCREDITED_VERIFIER_ENGAGEMENT" &&
    periodAssessment.definitiveAnnualEligible &&
    periodAssessment.completenessStatus === "PASSED" &&
    Number(model.readiness.assessedCoveragePercent) >= 100;
  
  // Emerald Green for pass, Muted Red for failure/remediation
  doc.setFillColor(isReady ? 20 : 180, isReady ? 83 : 40, isReady ? 45 : 40);
  doc.roundedRect(MARGIN, 76, 85, 24, 1.5, 1.5, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("OPERATOR READINESS STATUS", MARGIN + 5, 83);
  doc.setFontSize(10.5);
  doc.text(isReady ? "OPERATOR_PREPARATION_COMPLETE" : "REMEDIATION REQUIRED", MARGIN + 5, 92);

  // Score Box on Cover — four independent honest indicators (FAZ 7).
  // Never a single overall 100/100; verifier-reserved work is never added to
  // the operator score, and "all checks passed" is forbidden while pending.
  const sb = model.honestScoreboard;
  doc.setFillColor(34, 50, 75);
  doc.roundedRect(MARGIN + 88, 76, 47, 32, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.6);
  if (sb) {
    doc.text("OPERATOR PREPARATION", MARGIN + 91, 81);
    doc.setTextColor(201, 154, 73);
    doc.setFontSize(8.2);
    doc.text(`${sb.operatorPreparationScore} / 100`, MARGIN + 91, 87);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(5.6);
    doc.text("EVIDENCE ASSURANCE", MARGIN + 91, 92.5);
    doc.setTextColor(201, 154, 73);
    doc.setFontSize(8.2);
    doc.text(`${sb.evidenceAssuranceScore} / 100`, MARGIN + 91, 98.5);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(5.6);
    doc.text("PACKAGE INTEGRITY", MARGIN + 91, 103.5);
    doc.setTextColor(sb.packageIntegrity === "PASS" ? 109 : 214, sb.packageIntegrity === "PASS" ? 211 : 69, sb.packageIntegrity === "PASS" ? 128 : 69);
    doc.setFontSize(7.6);
    doc.text(sb.packageIntegrity ?? "NOT_ASSESSED", MARGIN + 91, 108);
  } else {
    doc.text("DIAGNOSTIC SCORE", MARGIN + 91, 83);
    doc.setFontSize(11);
    doc.setTextColor(201, 154, 73);
    doc.text(`${model.readiness.score} / 100`, MARGIN + 91, 92);
  }

  // Cover Page Bottom Details
  doc.setTextColor(12, 30, 54);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  let cy = 135;
  const writeCoverDetail = (label: string, val: string) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(12, 30, 54);
    doc.text(`${label}:`, MARGIN, cy);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 70, 85);
    doc.text(val, MARGIN + 48, cy);
    cy += 6.0;
  };
  writeCoverDetail("Package ID", model.packageCode || "Assigned at seal — see release record");
  writeCoverDetail("Technical Report ID", model.reportId);
  writeCoverDetail("Case ID", model.caseId);
  writeCoverDetail(
    "Product Delivery Tier",
    sb?.premiumNameVisible === true
      ? sb?.productTierLabel ?? "Premium Dossier"
      : sb?.premiumNameVisible === false
        ? "CBAMValid Pack"
        : sb?.productTierLabel ?? (model.productCode === "pack_premium_dossier_v5" ? "Premium Dossier Pack" : model.productCode)
  );
  writeCoverDetail("Dossier Release Iteration", `Iteration ${model.releaseVersion}`);
  if (model.versionStamp) {
    writeCoverDetail("Product version", model.versionStamp.product);
    writeCoverDetail("Schema version", model.versionStamp.schema);
    writeCoverDetail("Ruleset version", model.versionStamp.rulesetId);
  }
  writeCoverDetail("Generated At", model.generatedAt);
  writeCoverDetail("Reporting Year & Period", model.identity.reportingPeriod);
  writeCoverDetail("Operator Name", model.identity.exporterOperator);
  writeCoverDetail("Installation Name", model.identity.installation);
  writeCoverDetail("Regulatory Basis", applicableActStack().map((entry) => entry.short).join("; "));
  if (sb) {
    const externalCompleted = sb.externalVerifierCompleted ?? 0;
    const externalTotal = sb.externalVerifierTotal ?? 0;
    writeCoverDetail(
      "External verifier completion",
      `${externalCompleted === 0 ? "PENDING — " : ""}${externalCompleted} of ${externalTotal}`
    );
    writeCoverDetail("Scoreboard claim", sb.scoreboardClaim ?? "NOT_ASSESSED");
    writeCoverDetail("Premium chapter contract", sb.premiumChapterContract ?? "NOT_ASSESSED");
  }

  // Secure Cryptographic Trust Stamp Card
  doc.setFillColor(245, 247, 250);
  doc.setDrawColor(201, 154, 73);
  doc.roundedRect(MARGIN, 185, CONTENT_WIDTH, 48, 1.5, 1.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(12, 30, 54);
  doc.text("SECURE TRUST STAMP & KMS SIGNATURE RECORD", MARGIN + 6, 191);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(80, 90, 105);
  doc.text(`Case Snapshot SHA-256 Hash: ${model.caseDataHash || "See Data Integrity Manifest.json"}`, MARGIN + 6, 196);
  doc.text(`Calculation Root Hash: ${model.calculationRootHash || "See Data Integrity Manifest.json"}`, MARGIN + 6, 201);
  doc.text(`Manifest integrity: See Data Integrity Manifest.json`, MARGIN + 6, 206);
  doc.text(`Detached signature: See Manifest Signature.sig`, MARGIN + 6, 211);
  doc.text(`KMS Key Version: ${model.manifestSummary?.kmsKeyVersion || "See Data Integrity Manifest.json"}`, MARGIN + 6, 216);
  doc.text(`Package receipt hash: Available in the CBAMValid release record`, MARGIN + 6, 221);
  doc.text(integrityManifestWording(componentCount), MARGIN + 6, 226);

  // Cover Legal Boundary statement
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(120, 130, 140);
  const boundaryLines = doc.splitTextToSize(model.legalBoundary, CONTENT_WIDTH) as string[];
  doc.text(boundaryLines, MARGIN, 250);

  // ==========================================
  // PAGE 2: CHAPTER I - EXECUTIVE & LEGAL OVERVIEW
  // ==========================================
  drawChapterHeader("CHAPTER I: EXECUTIVE & LEGAL OVERVIEW", "Document Control & Legal Framework");

  // Section 2: Document Control
  beginSection({
    number: 2,
    title: "Document Control",
    preview: () => tablePreview(
      ["Control Parameter", "Registered Value"],
      [
        ["Package ID", model.packageCode || "—"],
        ["Technical Report ID", model.reportId],
        ["Case ID", model.caseId],
        ["Release Version", `V${model.releaseVersion}`],
        ["Generated Timestamp", model.generatedAt],
        ["Ruleset Version", "EU-CBAM-DEFINITIVE-2026"],
        ["Calculation Engine Version", "3.0.0"],
        ["Verification Class", "Prepared for Independent Accredited Review"],
      ],
      [50, 130]
    )
  });
  drawTable(
    ["Control Parameter", "Registered Value"],
    [
      ["Package ID", model.packageCode || "—"],
      ["Technical Report ID", model.reportId],
      ["Case ID", model.caseId],
      ["Release Version", `V${model.releaseVersion}`],
      ["Generated Timestamp", model.generatedAt],
      ["Ruleset Version", "EU-CBAM-DEFINITIVE-2026"],
      ["Calculation Engine Version", "3.0.0"],
      ["Verification Class", "Prepared for Independent Accredited Review"],
    ],
    [50, 130]
  );

  // Section 3: Legal and Product Boundary
  beginSection({
    number: 3,
    title: "Legal Status and Reliance Boundary",
    preview: () => paragraphPreview(model.legalBoundary)
  });
  drawParagraph(model.legalBoundary);
  drawCallout(
    "CBAMValid Internal automated readiness assessment",
    "This pack represents the operator's internal automated readiness work. Independent accredited verifier review status remains NOT_REVIEWED. ACCREDITED_VERIFICATION_OPINION is required for customs submission."
  );

  // ==========================================
  // PAGE 3: TABLE OF CONTENTS
  // ==========================================
  doc.addPage();
  // table of contents is populated dynamically in the second pass at page 3.

  // ==========================================
  // PAGE 5: CHAPTER II - DIAGNOSTIC AUDIT & VERIFICATION READINESS
  // ==========================================
  drawChapterHeader("CHAPTER II: DIAGNOSTIC AUDIT & READINESS", "Executive Board & Scoring Matrix");

  // Section 5: Executive Decision Board
  beginSection({
    number: 5,
    title: "Executive Decision Board",
    preview: () => paragraphPreview("The following summary table outlines the key metrics and decisions for senior executive/CFO review before independent verifier handover.")
  });
  drawParagraph("The following summary table outlines the key metrics and decisions for senior executive/CFO review before independent verifier handover.");
  
  drawTable(
    ["Readiness Score", "Critical Blockers", "Material Findings", "Open Findings", "Missing Evidence", "Unresolved Calc Exceptions", "Recommended Handover Decision"],
    [[
      `${model.readiness.score}/100`,
      model.readiness.criticalBlockerCount,
      model.readiness.materialFindingCount,
      model.readiness.openFindingCount,
      model.readiness.missingMaterialEvidenceCount,
      model.readiness.unresolvedCalculationExceptionCount,
      model.readiness.recommendedDecision,
    ]],
    [22, 22, 22, 20, 22, 22, 50]
  );
 
  const decisionExplanation = model.readiness.recommendedDecision === "READY_FOR_ACCREDITED_VERIFIER_ENGAGEMENT"
    ? "All hard gates passed with 100% weighted dimension coverage. Operator preparation is complete and ready for accredited verifier engagement."
    : "Gaps, incomplete assessment coverage, or blockers detected. Remediation is required before accredited verifier engagement.";
  drawCallout("Recommended Action Context", decisionExplanation);
  drawParagraph(`Assessed coverage: ${model.readiness.assessedCoveragePercent}% of weighted dimensions. Passed within assessed: ${model.readiness.passedWithinAssessedPercent}%.`);
 
  // ==========================================
  // PAGE 5: READINESS SCORE AND HARD GATES
  // ==========================================
  doc.addPage();
  y = BODY_TOP;
 
  // Section 6: Readiness Score and Hard Gates
  const dimHeaders = ["Readiness Dimension", "Weight", "Score", "Weighted Score", "Passed / Total Reqs"];
  const dimRows = model.readiness.dimensions.map(d => [
    formatEnum(d.dimensionId),
    `${d.weight}%`,
    d.rawScore === "N/A" ? "NOT_ASSESSED" : `${d.rawScore}%`,
    d.weightedScore === "N/A" ? "N/A" : `${d.weightedScore}%`,
    d.applicableRequirementCount === 0 ? "—" : `${d.passedRequirementCount} / ${d.applicableRequirementCount}`,
  ]);
  beginSection({
    number: 6,
    title: "Readiness Score and Hard Gates",
    preview: () => tablePreview(dimHeaders, dimRows, [50, 18, 18, 20, 30])
  });
  drawParagraph("The diagnostic score is the absolute sum of weighted dimension scores out of 100. NOT_ASSESSED dimensions contribute zero and prevent OPERATOR_PREPARATION_COMPLETE. Hard blockers override the score and force NOT_READY.");
  drawTable(dimHeaders, dimRows, [50, 18, 18, 20, 30]);
 
  // ==========================================
  // CHAPTER III: INSTALLATION & PRODUCTION ROUTE BOUNDARY
  // ==========================================
  drawChapterHeader("CHAPTER III: INSTALLATION & SYSTEM BOUNDARY", "Facility Identity & CN Mapping");

  // Section 7: Operator and Installation Identity
  beginSection({
    number: 7,
    title: "Operator and Installation Identity",
    preview: () => tablePreview(
      ["Identity Attribute", "Declared Value"],
      [
        ["Operator Name", model.identity.exporterOperator],
        ["Importer Name", model.identity.importer],
        ["EORI Number", model.identity.eori],
        ["Installation Name", model.identity.installation],
        ["Country of Origin", model.identity.country],
      ],
      [50, 130]
    )
  });
  drawTable(
    ["Identity Attribute", "Declared Value"],
    [
      ["Operator Name", model.identity.exporterOperator],
      ["Importer Name", model.identity.importer],
      ["EORI Number", model.identity.eori],
      ["Installation Name", model.identity.installation],
      ["Country of Origin", model.identity.country],
    ],
    [50, 130]
  );
 
  // Section 8: Reporting Period Assessment
  const periodRows = [
    ["Reporting Year", String(periodAssessment.reportingYear)],
    ["Reporting Period Type", periodAssessment.type],
    ["Covered Dates", `${periodAssessment.startDate} to ${periodAssessment.endDate}`],
    ["Covered Days count", `${periodAssessment.coveredDays} days`],
    ["Expected Days count", `${periodAssessment.expectedDays} days`],
    ["Completeness Percentage", `${periodAssessment.completenessPercent}%`],
    ["Completeness Status", periodAssessment.completenessStatus],
    ["Assessment Timestamp", model.generatedAt],
    ["Definitive Annual Eligible", periodAssessment.definitiveAnnualEligible ? "YES (PASSED)" : "NO (BLOCKED)"],
  ];
  beginSection({
    number: 8,
    title: "Reporting Period Assessment",
    preview: () => tablePreview(["Reporting Attribute", "Value"], periodRows, [60, 120])
  });
  drawParagraph(`Calendar-aware analysis of the reporting period for definitive annual verification eligibility. Period end must not exceed the assessment timestamp.`);
  drawTable(["Reporting Attribute", "Value"], periodRows, [60, 120]);
  if (!periodAssessment.definitiveAnnualEligible || periodAssessment.completenessStatus === "BLOCKED") {
    drawCallout(
      "Reporting Period Hard Blocker",
      periodAssessment.hardBlockerFindingIds.includes("FND-PERIOD-FUTURE-END-DATE")
        ? "Reporting period end date is after the assessment timestamp. Future-period annual completeness cannot PASS and READY_FOR_ACCREDITED_VERIFIER_ENGAGEMENT is prohibited."
        : "The reporting period is not a definitive annual period eligible for operator preparation completion."
    );
  }

  // Section 9: Goods and CN Classification
  beginSection(9, "Goods and CN Classification", 35);
  drawParagraph("The case includes the following CN-coded goods classifications:");
  drawTable(
    ["Good Index", "CN Code", "Sector", "Production Volume"],
    model.goods.map(g => [g.goodIndex, g.cnCode, g.sector, `${g.productionVolume} ${g.productionUnit}`]),
    [20, 30, 50, 40]
  );

  // Section 10: Installation and System Boundary
  beginSection(10, "Installation and System Boundary", 30);
  {
    const boundary = String(model.identity.systemBoundary || "").trim();
    if (!boundary || boundary === "Boundaries defined.") {
      drawCallout(
        "DATA GAP",
        "Missing physicalBoundaryDescription, sitePlanEvidenceId, includedProcesses, excludedProcesses, crossingFlows, meteringPointMap. Operator must supply these fields before this chapter can be rendered."
      );
    } else {
      drawCallout("Declared System Boundary", boundary);
    }
  }

  // Enterprise / Exclusive chapter readiness (Part D / FAZ 13 premium contract)
  beginSection(31, "Enterprise Chapter Completeness", 40);
  {
    const premiumChapters = model.premiumChapters ?? [];
    if (premiumChapters.length > 0) {
      drawParagraph(
        "Premium chapters E-01..E-16 are evaluated against the premium component contract. Each chapter uses exactly one status: APPLICABLE_COMPLETE, APPLICABLE_DATA_GAP, NOT_APPLICABLE_WITH_LEGAL_BASIS or VERIFIER_RESERVED. Premium product naming is suppressed until all applicable chapters render without a DATA GAP."
      );
      drawTable(
        ["Chapter", "Status", "Basis"],
        premiumChapters.map((entry) => [entry.chapterId ? `${entry.chapterId} ${entry.title}` : entry.title, entry.status, entry.basis]),
        [70, 45, 70]
      );
      const gaps = premiumChapters.filter((entry) => entry.status === "APPLICABLE_DATA_GAP");
      if (gaps.length > 0) {
        drawCallout("PREMIUM CONTRACT GAP", `${gaps.length} applicable premium chapter(s) have a DATA GAP: ${gaps.map((entry) => entry.chapterId).join(", ")}`);
      } else if (model.premiumNameVisible === false) {
        drawCallout("PREMIUM CONTRACT GAP", "Premium chapters are collectively not applicable; the premium product name is suppressed.");
      }
    } else {
      drawParagraph(
        "Standard test packages apply WP-00..14 engine controls. Premium/Enterprise/Exclusive chapters are gated by content contracts and are marked NOT_APPLICABLE on the Standard tier. Missing required fields on higher tiers render as DATA GAP — never placeholder prose."
      );
      const chapterEval = evaluateEnterpriseChapters({
        tier: "STANDARD",
        providedByChapterId: {},
      });
      drawTable(
        ["Chapter", "Required", "Status"],
        chapterEval.evaluations.map((e) => [
          `${e.id} ${e.title}`,
          e.required ? "YES" : "NO",
          e.outcome.status,
        ]),
        [90, 25, 35]
      );
    }
  }

  // Section 11: Production Processes and Functional Units
  beginSection(11, "Production Processes and Functional Units", 35);
  drawParagraph("Controlled production processes and default boundaries of matching sectors:");
  methodologies.forEach((sec) => {
    drawCallout(sec.displayName, `Legal Status: ${sec.legalStatus}. Default boundaries: ${sec.defaultBoundaries}`);
  });

  // Section 32: Monitoring Plan Conformance
  {
    const planRows = model.monitoringPlan ?? [];
    beginSection(32, "Monitoring Plan Conformance", 35);
    drawParagraph("Conformance of the operator's installation monitoring plan against EU CBAM reporting and verification requirements. Missing or unsupported items block sealing.");
    drawTable(
      ["Requirement ID", "Monitoring Requirement", "Status", "Supporting Evidence"],
      planRows.length
        ? planRows.map((row) => [row.requirementId, row.requirement, formatEnum(row.status), row.evidence || "—"])
        : [["—", "No monitoring plan items registered.", "NOT_ASSESSED", "—"]],
      [25, 65, 28, 45]
    );
  }

  // Section 33: Source Streams and Emission Sources
  beginSection(33, "Source Streams and Emission Sources", 35);
  {
    const streamRows: string[][] = [];
    const pushStream = (name: string, value: unknown, unit: string, basis: string, evidence: string) => {
      streamRows.push([name, asText(value), unit, basis, evidence]);
    };
    pushStream("Direct emissions (installation scope)", caseData.directEmissions.value, caseData.directEmissions.canonicalUnit || "—", caseData.directEmissions.sourceType || "—", caseData.directEmissions.evidenceId || "—");
    pushStream("Electricity consumed", caseData.electricityConsumed.value, caseData.electricityConsumed.canonicalUnit || "—", caseData.electricityConsumed.sourceType || "—", caseData.electricityConsumed.evidenceId || "—");
    pushStream("Grid emission factor", caseData.gridEmissionFactor.value, caseData.gridEmissionFactor.canonicalUnit || "—", caseData.gridEmissionFactor.sourceType || "—", caseData.gridEmissionFactor.evidenceId || "—");
    drawTable(
      ["Source Stream", "Activity Value", "Unit", "Data Source", "Evidence ID"],
      streamRows,
      [50, 30, 25, 30, 45]
    );
    drawParagraph("Emission sources are reconciled per installation direct scope. Where a precursor is declared, its attributable emissions appear under the precursor register.");
  }

  // Section 34: Metering and Instrumentation
  beginSection(34, "Metering and Instrumentation", 35);
  {
    const calibrationEvidence = caseData.evidenceRegister.filter(
      (item) => item.documentType === "CALIBRATION_CERTIFICATE" && item.reviewStatus === "APPROVED"
    );
    if (calibrationEvidence.length > 0) {
      drawTable(
        ["Evidence ID", "Document", "Meter Scope", "Approved", "Malware", "Hash Prefix"],
        calibrationEvidence.map((item) => [
          item.evidenceId,
          item.fileName,
          item.linkedInputs.join(", ") || "—",
          formatEnum(item.reviewStatus),
          formatEnum(item.malwareScanStatus),
          item.fileHash.slice(0, 10) + "...",
        ]),
        [28, 40, 45, 20, 20, 27]
      );
    } else {
      drawCallout(
        "DATA GAP",
        "No approved calibration certificates found in the evidence register. Calibration coverage for meters is required before independent verifier handover."
      );
    }
  }

  // ==========================================
  // CHAPTER IV: MATERIAL ACTIVITY & EVIDENCE LINEAGE
  // ==========================================
  drawChapterHeader("CHAPTER IV: MATERIAL ACTIVITY & EVIDENCE LINEAGE", "Activity Ledger & Document Lineage");

  // Section 12: Material Input Register
  beginSection(12, "Material Input Register", 35);
  drawParagraph("Material activity data inputs required for the production route:");
  drawTable(
    ["Input Path", "Value", "Unit", "Source Type"],
    [
      ["directEmissions", caseData.directEmissions.value || "—", caseData.directEmissions.canonicalUnit || "—", formatEnum(caseData.directEmissions.sourceType || "—")],
      ["electricityConsumed", caseData.electricityConsumed.value || "—", caseData.electricityConsumed.canonicalUnit || "—", formatEnum(caseData.electricityConsumed.sourceType || "—")],
      ["gridEmissionFactor", caseData.gridEmissionFactor.value || "—", caseData.gridEmissionFactor.canonicalUnit || "—", formatEnum(caseData.gridEmissionFactor.sourceType || "—")],
    ],
    [50, 40, 40, 50]
  );

  // Section 13: Evidence Sufficiency Matrix
  beginSection(13, "Evidence Sufficiency Matrix", 35);
  drawParagraph("Requirement-level analysis of evidence linkages. PARTIALLY_SUPPORTED or missing evidence blocks sealing.");
  drawTable(
    ["Req ID", "Input Path", "Evidence IDs", "State", "Coverage", "Reason Codes"],
    model.evidenceSufficiency.map(s => [
      s.requirementId,
      s.inputPath,
      s.evidenceIds.join(", "),
      formatEnum(s.state),
      `${s.coverageNumerator} / ${s.coverageDenominator}`,
      s.reasonCodes.map(formatEnum).join(", "),
    ]),
    [22, 40, 25, 28, 20, 45]
  );

  // Section 14: Evidence Register
  beginSection(14, "Evidence Register", 35);
  const approvedRows = caseData.evidenceRegister.map(e => [
    e.evidenceId,
    e.fileName,
    formatEnum(e.documentType),
    formatEnum(e.reviewStatus),
    formatEnum(e.malwareScanStatus),
    e.fileHash.slice(0, 10) + "...",
  ]);
  drawTable(
    ["Evidence ID", "File Name", "Type", "Operator Status", "Malware Status", "SHA-256 (prefix)"],
    approvedRows.length ? approvedRows : [["—", "No evidence files registered.", "—", "—", "—", "—"]],
    [25, 45, 30, 25, 25, 30]
  );

  // Section 15: Data Lineage Matrix
  beginSection(15, "Data Lineage Matrix", 35);
  drawParagraph("Cryptographic audit path linking physical evidence hash to final calculation results:");
  const lineageRows = caseData.evidenceRegister.map(e => [
    e.evidenceId,
    e.fileHash.slice(0, 12) + "...",
    e.linkedInputs.join(", ") || "None",
    e.linkedCalculations.map(c => c.slice(0, 10)).join(", ") || "None",
  ]);
  drawTable(
    ["Evidence ID", "File Hash", "Linked Inputs", "Linked Calculation IDs"],
    lineageRows.length ? lineageRows : [["—", "—", "—", "—"]],
    [30, 30, 60, 60]
  );

  // ==========================================
  // CHAPTER V: EMISSIONS CALCULATION & ALLOCATION ENGINE ANNEX
  // ==========================================
  drawChapterHeader("CHAPTER V: CALCULATION & ALLOCATION ANNEX", "Direct, Indirect, Precursor & Per-Good Quantifications");

  // Section 16: Direct Emissions
  beginSection(16, "Direct Emissions", 35);
  drawParagraph("Direct greenhouse gas emissions within the installation boundary as declared in the case data:");
  drawTable(
    ["Emissions Category", "Data Source Type", "Activity Volume", "Measurement / Data Basis", "Calculated Direct Emissions"],
    [
      ["Installation Direct Scope", caseData.directEmissions.sourceType || "PRIMARY", caseData.directEmissions.value ? `${caseData.directEmissions.value} ${caseData.directEmissions.canonicalUnit}` : "—", caseData.directEmissions.measurementMethod || "Declared Operator Data", `${model.totals.totalDirectEmissions} tCO2e`],
    ],
    [45, 45, 30, 35, 25]
  );

  // Section 17: Indirect Emissions
  beginSection(17, "Indirect Emissions", 35);
  if (caseData.goods.some((good) => getSectorRule(good.sector).annexII)) {
    drawCallout("Annex II — Direct Emissions Only", ANNEX_II_EXCLUSION_NOTE);
  }
  drawParagraph("Indirect emissions associated with imported electricity consumed in production processes:");
  drawTable(
    ["Indirect Emissions Component", "Data Source Type", "Consumed Quantity", "Grid Factor Basis", "Calculated Indirect Emissions"],
    [
      ["Electricity Consumed", caseData.electricityConsumed.sourceType || "PRIMARY", caseData.electricityConsumed.value ? `${caseData.electricityConsumed.value} ${caseData.electricityConsumed.canonicalUnit}` : "—", caseData.gridEmissionFactor.value ? `${caseData.gridEmissionFactor.value} tCO2e/MWh` : "Default Grid Factor", `${model.totals.electricityIndirectEmissions} tCO2e`],
    ],
    [45, 45, 30, 35, 25]
  );

  // Section 18: Precursors
  beginSection(18, "Precursors", 35);
  if (model.precursors.length > 0) {
    drawTable(
      ["Precursor Name", "Quantity", "Direct Emissions", "Indirect Emissions", "Country of Origin"],
      model.precursors.map(p => [p.name, p.quantity, p.directEmissions, p.indirectEmissions, p.countryOfOrigin]),
      [40, 30, 30, 30, 30]
    );
  } else {
    drawParagraph("NOT_APPLICABLE: No precursors declared for this production route.");
  }

  // Section 19: Allocation and Per-good Results
  beginSection(19, "Allocation and Per-good Results", 35);
  drawTable(
    ["Good", "CN Code", "Allocation Share", "Allocated Embedded", "Specific Embedded Emissions"],
    model.goods.map(g => [g.goodIndex, g.cnCode, g.allocationShare, g.allocatedEmbeddedEmissions, g.specificEmbeddedEmissions]),
    [15, 30, 30, 45, 60]
  );

  // Section 20: Calculation Integrity and Reconciliation
  beginSection(20, "Calculation Integrity and Reconciliation", 35);
  drawTable(
    ["Parameter", "Value", "Unit", "Verification Status"],
    [
      ["Allocation Share Total", model.totals.allocationShareTotal, "fraction", "RECONCILED"],
      ["Allocation Reconciliation Delta", model.totals.allocationReconciliationDelta, "fraction", "ZERO_DELTA_PASS"],
    ],
    [65, 35, 30, 50]
  );

  // Section 35: Calculation Methodology
  beginSection(35, "Calculation Methodology", 35);
  drawParagraph(
    `All authoritative calculations run server-side under ${CALCULATION_LEGAL_CITATION}. Intermediate values preserve full precision; explicit rounding (ROUND_HALF_UP) is applied only at the defined reporting stage. Every node records formulaId, inputPaths, evidenceIds, legalBasis, calculationNodeId, calculationHash, roundingPolicy, assumptions and warnings in Calculation Trace.json.`
  );
  drawTable(
    ["Node ID", "Formula ID", "Output", "Unit", "Rounding"],
    model.calculationTrace && model.calculationTrace.length > 0
      ? model.calculationTrace.slice(0, 24).map((node) => [
          node.calculationId,
          node.formulaId,
          String(node.outputValue),
          node.outputUnit,
          node.roundingApplied ? "FINAL_STAGE" : "NONE_INTERMEDIATE",
        ])
      : [["—", "Calculation trace unavailable.", "—", "—", "—"]],
    [42, 40, 30, 25, 30]
  );

  // Section 36: Risk Assessment
  beginSection(36, "Risk Assessment", 35);
  {
    const prep = model.verifierPreparation as {
      inherentRiskRegister?: Array<{ riskId: string; riskDescription: string; affectedDataDomain: string; combined: string; likelihood: string; impact: string }>;
      controlRiskRegister?: Array<{ riskId: string; riskDescription: string; affectedDataDomain: string; combined: string; likelihood: string; impact: string }>;
      detectionRiskAssessment?: Array<{ riskId: string; riskDescription: string; affectedDataDomain: string; combined: string; likelihood: string; impact: string }>;
    } | null;
    const inherent = prep?.inherentRiskRegister ?? [];
    const control = prep?.controlRiskRegister ?? [];
    const detection = prep?.detectionRiskAssessment ?? [];
    drawParagraph(
      "Inherent, control and detection risk are assessed by the operator for verifier planning. They are NOT a verification conclusion — an independent accredited verifier must confirm or override each assessment."
    );
    drawTable(
      ["Risk ID", "Description", "Affected Data Domain", "Assessment", "Type"],
      [
        ...inherent.map((row) => [row.riskId, row.riskDescription, row.affectedDataDomain, formatEnum(row.combined), "INHERENT"]),
        ...control.map((row) => [row.riskId, row.riskDescription, row.affectedDataDomain, formatEnum(row.combined), "CONTROL"]),
        ...detection.map((row) => [row.riskId, row.riskDescription, row.affectedDataDomain, formatEnum(row.combined), "DETECTION"]),
      ].slice(0, 30) as string[][],
      [30, 55, 35, 25, 20]
    );
  }

  // Section 37: Materiality and Sampling Plan
  beginSection(37, "Materiality and Sampling Plan", 35);
  {
    const prep = model.verifierPreparation as {
      materialityWorkpapers?: Array<{
        goodIndex: number;
        cnCode: string;
        specificEmbeddedEmissions: string;
        planningThresholdRate: string;
        threshold: string;
        regulatoryBasis: string;
        calculationBasis: string;
        expertJudgement: string;
        verifierStatus: string;
      }>;
      samplingPopulation?: Array<{
        populationDomain: string;
        populationSize: number;
        sampleSize: number;
        selectionMethod: string;
        selectedItemIds: readonly string[];
        rationale: string;
        state: string;
      }>;
      samplingRationale?: string;
      sampleSelection?: Array<{
        populationDomain: string;
        populationSize: number;
        sampleSize: number;
        selectionMethod: string;
        selectedItemIds: readonly string[];
        rationale: string;
        state: string;
      }>;
    } | null;
    const materiality = prep?.materialityWorkpapers ?? [];
    drawParagraph(
      "Per-good materiality is PROVISIONAL_FOR_VERIFIER_PLANNING until confirmed by the independent accredited verifier. Values below are planning thresholds only and are never presented as verifier-approved materiality."
    );
    drawTable(
      ["Good", "CN Code", "Specific tCO2e/t", "Planning Threshold", "Threshold tCO2e/t", "Verifier Status"],
      materiality.length
        ? materiality.map((row) => [
            `Good ${row.goodIndex}`,
            row.cnCode,
            row.specificEmbeddedEmissions,
            row.planningThresholdRate,
            row.threshold,
            formatEnum(row.verifierStatus),
          ])
        : [["—", "—", "—", "—", "—", "NO_WORKPAPER"]],
      [20, 25, 30, 30, 30, 40]
    );
    const population = prep?.samplingPopulation ?? [];
    if (prep?.samplingRationale || population.length > 0) {
      drawCallout("Sampling Rationale", prep?.samplingRationale ?? "Operator-proposed sampling for verifier planning; verifier confirms, amends or replaces during planning.");
      if (population.length > 0) {
        drawTable(
          ["Population Domain", "Population Size", "Sample Size", "Selection Method", "State"],
          population.map((row) => [
            row.populationDomain,
            String(row.populationSize),
            String(row.sampleSize),
            row.selectionMethod,
            formatEnum(row.state),
          ]),
          [50, 25, 25, 55, 35]
        );
      }
    }
  }

  // ==========================================
  // CHAPTER VI: VERIFIER HANDOVER & TECHNICAL ANNEXES
  // ==========================================
  drawChapterHeader("CHAPTER VI: VERIFIER HANDOVER & TECHNICAL ANNEXES", "Governance, Audit Trails & Manifest Sign-Off");

  // Section 21: Data Quality, Uncertainty, and Missing Data
  beginSection(21, "Data Quality, Uncertainty, and Missing Data", 35);
  drawParagraph(`The operator-supplied activity data and monitoring instruments are evaluated against definitive-period embedded-emissions methodology under ${CALCULATION_LEGAL_CITATION}. No data gaps were auto-filled using unverified figures.`);
  drawTable(
    ["Declared Data Stream", "Measurement Method", "Evidence Document ID", "Compliance Status"],
    [
      ["Direct Emissions", caseData.directEmissions.measurementMethod || "Declared operator method", caseData.directEmissions.evidenceId || "NOT_ASSESSED", caseData.directEmissions.evidenceId ? "COMPLIANT" : "NOT_ASSESSED"],
      ["Electricity Consumed", caseData.electricityConsumed.measurementMethod || "Declared operator method", caseData.electricityConsumed.evidenceId || "NOT_ASSESSED", caseData.electricityConsumed.evidenceId ? "COMPLIANT" : "NOT_ASSESSED"],
      ["Grid Emission Factor", caseData.gridEmissionFactor.measurementMethod || "Declared operator method", caseData.gridEmissionFactor.evidenceId || "NOT_ASSESSED", caseData.gridEmissionFactor.evidenceId ? "COMPLIANT" : "NOT_ASSESSED"],
    ],
    [50, 60, 50, 20]
  );

  // Section 22: Methodology Decision Register
  beginSection(22, "Methodology Decision Register", 35);
  const methodRows = caseData.methodologyDecisions.map(item => [
    formatEnum(item.topic),
    item.selectedMethod,
    item.reason,
    formatEnum(item.reviewStatus),
  ]);
  drawTable(
    ["Topic", "Selected Method", "Reason", "Operator Status"],
    methodRows.length ? methodRows : [["—", "No methodology decisions registered.", "—", "—"]],
    [35, 35, 75, 35]
  );

  // Section 23: Findings Register
  beginSection(23, "Findings Register", 35);
  const openFindings = model.findings.filter(f => f.status === "OPEN");
  if (openFindings.length > 0) {
    drawTable(
      ["Finding ID", "Severity", "Category", "Title", "Description"],
      openFindings.map(f => [f.findingId, formatEnum(f.severity), formatEnum(f.category), f.title, f.description]),
      [28, 20, 35, 45, 52]
    );
  } else {
    drawParagraph("No open findings or non-conformities are detected.");
  }

  // Section 24: Corrective Action Plan
  beginSection(24, "Corrective Action Plan", 35);
  const openActions = model.correctiveActions.filter(a => a.state === "OPEN");
  if (openActions.length > 0) {
    drawTable(
      ["Action ID", "Priority", "Required Action", "Role", "State"],
      openActions.map(a => [a.actionId, formatEnum(a.priority), a.requiredAction, a.responsibleRole, formatEnum(a.state)]),
      [28, 18, 70, 32, 18]
    );
  } else {
    drawParagraph("All corrective actions are closed or not required.");
  }

  // Section 25: EU Verification Template Crosswalk
  beginSection(25, "EU Verification Template Crosswalk", 35);
  drawTable(
    ["Req ID", "Legal Basis", "Crosswalk Requirement", "Owner", "Status"],
    model.requirementCrosswalk.map(c => [
      c.requirementId,
      c.legalLocation,
      c.requirementText,
      c.owner,
      c.status,
    ]),
    [22, 35, 75, 28, 28]
  );
  drawParagraph("The full field-level mapping is provided as the 'Registry Verification Template Mapping Dataset' (Verifier Workspace.xlsx — Registry Mapping sheet; JSON dossier model). The European Commission has not published an official machine-readable Registry submission schema, so this dataset is a field-mapped structured export — not an 'Official Registry XML' submission and not a guarantee of Registry acceptance.");

  // Section 26: Verifier Handover Checklist
  beginSection(26, "Verifier Handover Checklist", 35);
  drawParagraph("The following mandatory verifier-completion items require manual audit and signature by an independent accredited verifier:");
  drawTable(
    ["Verifier Reserved Field", "Requirement Standard", "Status", "Audit Comment"],
    [
      ["Accredited Verifier Name & ID", "ISO 14065 / EU AVR Accreditation", "VERIFIER_COMPLETION_REQUIRED", "Must be recorded post-audit"],
      ["Accreditation Body & National Authority", "EU National Accreditation Body (NAB)", "VERIFIER_COMPLETION_REQUIRED", "Must be recorded post-audit"],
      ["Site-Visit Execution & Date Range", "Article 29 EU AVR 2018/2067", "VERIFIER_COMPLETION_REQUIRED", "Physical or virtual site visit log"],
      ["Materiality Threshold & Misstatement Finding", "5% Materiality Threshold Assessment", "VERIFIER_COMPLETION_REQUIRED", "Conformity decision statement"],
      ["Verification Opinion & Assurance Class", "Reasonable Assurance Class Statement", "VERIFIER_COMPLETION_REQUIRED", "Opinion certificate required"],
      ["Verification Report Certificate Ref", "Official Accreditation Registry Number", "VERIFIER_COMPLETION_REQUIRED", "Certificate reference code"],
      ["Lead Verifier Digital Signature", "Cryptographic / Qualified Digital Signature", "VERIFIER_COMPLETION_REQUIRED", "Must sign final verification report"],
      ["Independent Reviewer Sign-off", "Dual-Control Independent Peer Review", "VERIFIER_COMPLETION_REQUIRED", "Peer reviewer verification"],
    ],
    [50, 45, 40, 45]
  );

  // Section 27: Package Manifest and Digital Integrity
  beginSection(27, "Package Manifest and Digital Integrity", 35);

  // FAZ 10 — values not yet available at render time are shown as deferred
  // references to the manifest or the release record, never as placeholders.
  const kmsKeyVersion = model.manifestSummary?.kmsKeyVersion || "See Data Integrity Manifest.json";
  const kmsAlgorithm = model.manifestSummary?.kmsAlgorithm || "See Data Integrity Manifest.json";
  const publicVerificationState =
    cryptoClaims.publicVerificationState === "ACTIVE"
      ? "ACTIVE"
      : "ACTIVATED_ON_SEAL_PUBLICATION — see release record";

  drawTable(
    ["Integrity Parameter", "Registered Value"],
    [
      ["Case Snapshot SHA-256 Hash", model.caseDataHash || "See Data Integrity Manifest.json"],
      ["Calculation Root Hash", model.calculationRootHash || "See Data Integrity Manifest.json"],
      ["Manifest SHA-256 Hash", "See Data Integrity Manifest.json"],
      ["Sealed Package SHA-256 Hash", "Available in the CBAMValid release record"],
      ["KMS Key Version Reference", kmsKeyVersion],
      ["KMS Signature Algorithm", kmsAlgorithm],
      ["KMS Signature", "See Manifest Signature.sig"],
      ["Schema Specification", model.schemaVersion],
      ["Digital Signature ID", model.reportId],
      ["Cryptographic Security Class", cryptoClaims.securityClassLabel],
      ["Public Verification State", publicVerificationState],
      ...(cryptoClaims.publicVerificationUrl
        ? [["Public Verification URL", cryptoClaims.publicVerificationUrl] as [string, string]]
        : [["Public Verification URL", "Published in the CBAMValid release record after sealing"] as [string, string]]),
    ],
    [65, 115]
  );

  // Section 28: Version Comparison
  const versionRows: string[][] = [];
  if (model.previousReleases && model.previousReleases.length > 0) {
    model.previousReleases.forEach(r => {
      versionRows.push([
        `V${r.version}`,
        r.sealedAt,
        r.correctionReason || "Dossier release.",
        "OPERATOR_ADMIN",
        r.status,
      ]);
    });
  }
  versionRows.push([
    `V${model.releaseVersion}`,
    model.generatedAt,
    model.releaseVersion > 1 ? "Dossier correction/update release." : "Initial base release version.",
    "OPERATOR_ADMIN",
    "ACTIVE_RELEASE"
  ]);

  beginSection({
    number: 28,
    title: "Version Comparison",
    preview: () => paragraphPreview("This register tracks the history of released and sealed package versions under this case scope:")
  });
  drawParagraph(releaseHistoryNarrative(model.releaseVersion));
  if (model.releaseVersion === 1 && (!model.previousReleases || model.previousReleases.length === 0)) {
    drawParagraph("No previous sealed release exists.");
  }
  drawTable(
    ["Version", "Sealed Timestamp", "Release Reason / Changes", "Author", "Status"],
    versionRows,
    [20, 40, 70, 30, 20]
  );

  // Section 29: Sign-off and Limitations
  beginSection(29, "Sign-off and Limitations", 35);
  drawParagraph("The operator hereby signs off on this verifier-preparation dossier as complete and accurate to the best of their knowledge. This package does not constitute a legally binding accredited verifier certificate.");
  drawTable(
    ["Sign-off Role", "Name & Title", "Signature Status", "Sign-off Date"],
    [
      ["Operator Author / Preparer", "NOT_PROVIDED", "OPERATOR_PREPARED", model.generatedAt.slice(0, 10)],
      ["Internal Environmental Reviewer", "NOT_PROVIDED", "REVIEW_REQUIRED", "PENDING_EXTERNAL_VERIFIER"],
      ["Independent Accredited Verifier", "PENDING_EXTERNAL_VERIFIER", "VERIFIER_COMPLETION_REQUIRED", "PENDING_EXTERNAL_VERIFIER"]
    ],
    [50, 50, 50, 30]
  );

  // Section 30: Technical Annex Index — component list is SSOT from REQUIRED_TOP_LEVEL_COMPONENTS_V5
  beginSection(30, "Technical Annex Index", 35);
  drawParagraph(`The sealed ZIP package contains the following ${COMPONENT_COUNT_V5} controlled components required for independent verifier review:`);
  drawTable(
    ["Filename in Sealed Package ZIP", "Type", "Verification Target & Content Description"],
    REQUIRED_TOP_LEVEL_COMPONENTS_V5.map((name) => {
      const meta = COMPONENT_ANNEX_DESCRIPTIONS[name] || ["FILE", "Controlled package component"];
      return [name, meta[0], meta[1]];
    }),
    [70, 20, 90]
  );

  // Section 38: Data Visualisation Annex — every chart derives from case/calculation data
  beginSection(38, "Data Visualisation Annex", 90);
  drawParagraph("All charts in this annex are generated from the sealed case snapshot and calculation dataset. No decorative imagery is used.");

  drawBarChart(
    "A-H emission segregation (tCO2e)",
    [
      { label: "A. Installation direct", value: Number(model.totals.installationDirectEmissions || 0), color: NAVY },
      { label: "B. Precursor direct", value: Number(model.totals.precursorDirectEmissions || 0), color: NAVY },
      { label: "C. Total direct (A+B)", value: Number(model.totals.totalDirectEmissions || 0), color: NAVY },
      { label: "D. Electricity indirect", value: Number(model.totals.electricityIndirectEmissions || 0), color: STEEL },
      { label: "E. Precursor indirect", value: Number(model.totals.precursorIndirectEmissions || 0), color: STEEL },
      { label: "F. Total indirect (D+E)", value: Number(model.totals.totalIndirectEmissions || 0), color: STEEL },
      { label: "G. Certificate-relevant embedded", value: Number(model.totals.totalEmbeddedEmissions || 0), color: GOLD },
    ]
  );

  drawBarChart(
    "Per-good specific embedded emissions (tCO2e/t)",
    model.goods.map((good) => ({
      label: `Good ${good.goodIndex} · CN ${good.cnCode}`,
      value: Number(good.specificEmbeddedEmissions || 0),
      color: NAVY,
      suffix: " tCO2e/t",
    }))
  );

  drawBarChart(
    "Evidence coverage by material requirement",
    (() => {
      const supported = model.evidenceSufficiency.filter((s) => s.state === "SUPPORTED" || s.state === "SUPPORTED_BY_EVIDENCE" || s.state === "SUPPORTED_BY_ACCEPTED_METHODOLOGY_DECISION").length;
      const partial = model.evidenceSufficiency.filter((s) => s.state === "PARTIALLY_SUPPORTED").length;
      const missing = model.evidenceSufficiency.length - supported - partial;
      return [
        { label: "Fully supported", value: supported, color: GREEN },
        { label: "Partially supported", value: partial, color: GOLD },
        { label: "Unlinked / missing", value: missing, color: RED },
      ];
    })()
  );

  drawRiskHeatMatrix(
    [
      ...((model.verifierPreparation as { inherentRiskRegister?: Array<{ likelihood: string; impact: string }> } | null)?.inherentRiskRegister ?? []),
      ...((model.verifierPreparation as { controlRiskRegister?: Array<{ likelihood: string; impact: string }> } | null)?.controlRiskRegister ?? []),
    ]
  );

  drawBarChart(
    "Allocation reconciliation — per-good shares (sum must equal 1)",
    model.goods.map((good) => ({
      label: `Good ${good.goodIndex}`,
      value: Number(good.allocationShare || 0),
      color: GOLD,
    }))
  );

  drawBoundaryBox(
    model.scope.processes.length ? model.scope.processes : caseData.goods.map((good) => good.sector),
    caseData.installation?.excludedProcesses ? [caseData.installation.excludedProcesses] : []
  );

  drawFlowBoxes([
    "Raw activity data capture (meters / invoices)",
    "Source stream aggregation",
    "Direct & indirect emissions calculation",
    "Precursor attribution (if applicable)",
    "Allocation to goods",
    "Reconciliation & integrity hashing",
  ]);

  drawLineageChain(["Evidence bytes (SHA-256)", "Linked input field", "Calculation node", "Sealed result"]);

  // ==========================================
  // SECOND PASS: TABLE OF CONTENTS (PAGE 3)
  // ==========================================
  doc.setPage(3);
  y = BODY_TOP;
  beginSection(4, "Table of Contents", 120);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(44, 62, 80);

  const tocEntries: Array<[number, string]> = [
    [2, "Document Control"],
    [3, "Legal and Product Boundary"],
    [4, "Table of Contents"],
    [5, "Executive Decision Board"],
    [6, "Readiness Score and Hard Gates"],
    [7, "Operator and Installation Identity"],
    [8, "Reporting Period Assessment"],
    [9, "Goods and CN Classification"],
    [10, "Installation and System Boundary"],
    [11, "Production Processes and Functional Units"],
    [32, "Monitoring Plan Conformance"],
    [33, "Source Streams and Emission Sources"],
    [34, "Metering and Instrumentation"],
    [12, "Material Input Register"],
    [13, "Evidence Sufficiency Matrix"],
    [14, "Evidence Register"],
    [15, "Data Lineage Matrix"],
    [16, "Direct Emissions"],
    [17, "Indirect Emissions"],
    [18, "Precursors"],
    [19, "Allocation and Per-good Results"],
    [20, "Calculation Integrity and Reconciliation"],
    [35, "Calculation Methodology"],
    [36, "Risk Assessment"],
    [37, "Materiality and Sampling Plan"],
    [21, "Data Quality, Uncertainty, and Missing Data"],
    [22, "Methodology Decision Register"],
    [23, "Findings Register"],
    [24, "Corrective Action Plan"],
    [25, "EU Verification Template Crosswalk"],
    [26, "Verifier Handover Checklist"],
    [27, "Package Manifest and Digital Integrity"],
    [28, "Version Comparison"],
    [29, "Sign-off and Limitations"],
    [30, "Technical Annex Index"],
    [38, "Data Visualisation Annex"],
  ];

  const writeTocRow = (num: number, title: string) => {
    const page = sectionPages[num] || 3;
    doc.setFont("helvetica", "bold");
    doc.textWithLink(`${num}.`, MARGIN, y, { pageNumber: page });
    doc.setFont("helvetica", "normal");
    doc.textWithLink(title, MARGIN + 8, y, { pageNumber: page });
    doc.textWithLink(String(page), PAGE_WIDTH - MARGIN, y, { pageNumber: page, align: "right" });
    y += 5.2;
  };

  for (const [num, title] of tocEntries) {
    writeTocRow(num, title);
  }

  // ==========================================
  // FOURTH PASS: PDF OUTLINE / BOOKMARKS
  // ==========================================
  const outlineRoot = doc.outline.add(null, model.documentTitle, { pageNumber: 1 });
  doc.outline.add(outlineRoot, "Cover and Release Identity", { pageNumber: 1 });
  for (const [num, title] of tocEntries) {
    doc.outline.add(outlineRoot, `${num}. ${title}`, { pageNumber: sectionPages[num] || 3 });
  }

  // ==========================================
  // THIRD PASS: RUNNING HEADERS & FOOTERS
  // ==========================================
  const pageCount = doc.getNumberOfPages();
  for (let pNum = 1; pNum <= pageCount; pNum += 1) {
    doc.setPage(pNum);

    // Skip Cover Page for Running Headers & Footers
    if (pNum === 1) continue;

    // Running Header
    doc.setFillColor(12, 30, 54);
    doc.rect(0, 0, PAGE_WIDTH, 20, "F");

    // Gold separator line below running header
    doc.setFillColor(201, 154, 73);
    doc.rect(0, 20, PAGE_WIDTH, 0.8, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(model.documentTitle, MARGIN, 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(`Package ID: ${model.packageCode || "—"} · Release Iteration ${model.releaseVersion}`, MARGIN, 16);

    // Confidentiality Status Badge
    doc.setFillColor(isReady ? 20 : 180, isReady ? 83 : 40, isReady ? 45 : 40);
    doc.rect(142, 5, 53, 10, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text(isReady ? "OPERATOR CHECKS PASSED" : "REMEDIATION REQUIRED", 168.5, 11.5, { align: "center" });

    // Running Footer — WP-14 one line
    doc.setDrawColor(211, 218, 227);
    doc.line(MARGIN, 283, PAGE_WIDTH - MARGIN, 283);
    doc.setFont("courier", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(90, 99, 112);
    doc.text(
      `CBAMValid · ${model.packageCode || "ASSIGNED_AT_SEAL"} · Release ${model.releaseVersion} · Page ${pNum} of ${pageCount} · CONFIDENTIAL`,
      MARGIN,
      288
    );
    if (model.reportId) {
      doc.text(`Report ${model.reportId}`, MARGIN, 291.5);
    }
  }

  return Buffer.from(doc.output("arraybuffer"));
}
