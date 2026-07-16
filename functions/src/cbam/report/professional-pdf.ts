import crypto from "node:crypto";
import { jsPDF } from "jspdf";
import type { VerifierPackageModel } from "./verifier-model";

export interface PdfTable {
  headers: string[];
  rows: Array<Array<string | number | null | undefined>>;
  widths?: number[];
}

export interface PdfChartItem {
  label: string;
  value: string | number;
  color?: [number, number, number];
}

export interface PdfBarChart {
  unit: string;
  items: PdfChartItem[];
}

export interface PdfWaterfallChart {
  unit: string;
  components: PdfChartItem[];
  total: string | number;
}

export interface PdfSection {
  heading: string;
  paragraphs?: string[];
  table?: PdfTable;
  callout?: { label: string; value: string };
  barChart?: PdfBarChart;
  waterfallChart?: PdfWaterfallChart;
  pageBreakBefore?: boolean;
}

export interface ProfessionalPdfInput {
  title: string;
  subtitle: string;
  model: VerifierPackageModel;
  sections: PdfSection[];
}

const PAGE_WIDTH = 210;
const MARGIN = 15;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BODY_TOP = 45;
const BODY_BOTTOM = 278;

function digest(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function asText(value: unknown): string {
  const result = String(value ?? "-").trim();
  return result || "-";
}

function chartNumber(value: string | number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compactIdentifier(value: string): string {
  return value.length > 44 ? `${value.slice(0, 27)}...${value.slice(-12)}` : value;
}

function normalizedWidths(count: number, requested?: number[]): number[] {
  if (!requested || requested.length !== count || requested.some((width) => !Number.isFinite(width) || width <= 0)) {
    return Array.from({ length: count }, () => CONTENT_WIDTH / count);
  }
  const total = requested.reduce((sum, width) => sum + width, 0);
  return requested.map((width) => (width / total) * CONTENT_WIDTH);
}

function statusLabel(model: VerifierPackageModel): string {
  return model.automatedReadiness === "READY_FOR_INDEPENDENT_VERIFICATION"
    ? "AUTOMATED PREPARATION CHECKS PASSED"
    : "BLOCKED - REMEDIATION REQUIRED";
}

export function buildProfessionalPdf(input: ProfessionalPdfInput): Buffer {
  const document = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  document.setCreationDate(new Date(input.model.generatedAt));
  document.setFileId(digest(`${input.model.reportId}:${input.title}`).slice(0, 32).toUpperCase());
  document.setProperties({
    title: input.title,
    subject: input.subtitle,
    author: "CBAMValid",
    creator: "CBAMValid Verifier Package Engine 4.0",
    keywords: "CBAM, verifier preparation, evidence, materiality, audit trail, immutable package",
  });

  let y = BODY_TOP;

  const drawPageFrame = () => {
    document.setFillColor(20, 42, 74);
    document.rect(0, 0, PAGE_WIDTH, 31, "F");
    document.setTextColor(255, 255, 255);
    document.setFont("helvetica", "bold");
    document.setFontSize(15);
    document.text(input.title, MARGIN, 12);
    document.setFont("helvetica", "normal");
    document.setFontSize(8.5);
    document.text(input.subtitle, MARGIN, 19);
    document.text(`Report ${compactIdentifier(input.model.reportId)} | Release ${input.model.releaseVersion}`, MARGIN, 25);

    const ready = input.model.automatedReadiness === "READY_FOR_INDEPENDENT_VERIFICATION";
    document.setFillColor(ready ? 222 : 254, ready ? 247 : 226, ready ? 232 : 226);
    document.setDrawColor(ready ? 22 : 185, ready ? 101 : 28, ready ? 52 : 28);
    document.roundedRect(137, 8, 58, 15, 2, 2, "FD");
    document.setTextColor(ready ? 22 : 155, ready ? 101 : 28, ready ? 52 : 28);
    document.setFont("helvetica", "bold");
    document.setFontSize(6.8);
    const statusLines = document.splitTextToSize(statusLabel(input.model), 52) as string[];
    document.text(statusLines, 166, 13, { align: "center" });

    document.setDrawColor(211, 218, 227);
    document.line(MARGIN, 36, PAGE_WIDTH - MARGIN, 36);
    document.setTextColor(65, 75, 90);
    document.setFont("helvetica", "normal");
    document.setFontSize(7.2);
    document.text(input.model.documentClassification, MARGIN, 40);
  };

  const addPage = () => {
    document.addPage();
    drawPageFrame();
    y = BODY_TOP;
  };

  const ensure = (height: number) => {
    if (y + height > BODY_BOTTOM) addPage();
  };

  const drawParagraph = (paragraph: string) => {
    const lines = document.splitTextToSize(asText(paragraph), CONTENT_WIDTH) as string[];
    ensure(lines.length * 4.4 + 2);
    document.setTextColor(43, 51, 64);
    document.setFont("helvetica", "normal");
    document.setFontSize(8.8);
    document.text(lines, MARGIN, y);
    y += lines.length * 4.4 + 2;
  };

  const drawCallout = (label: string, value: string) => {
    const lines = document.splitTextToSize(asText(value), CONTENT_WIDTH - 8) as string[];
    const height = Math.max(17, lines.length * 4.2 + 12);
    ensure(height + 3);
    document.setFillColor(244, 247, 250);
    document.setDrawColor(190, 199, 210);
    document.roundedRect(MARGIN, y, CONTENT_WIDTH, height, 1.5, 1.5, "FD");
    document.setFont("helvetica", "bold");
    document.setFontSize(7.5);
    document.setTextColor(20, 42, 74);
    document.text(label.toUpperCase(), MARGIN + 4, y + 6);
    document.setFont("helvetica", "normal");
    document.setTextColor(43, 51, 64);
    document.text(lines, MARGIN + 4, y + 11.5);
    y += height + 3;
  };

  const drawTable = (table: PdfTable) => {
    if (table.headers.length === 0) return;
    const widths = normalizedWidths(table.headers.length, table.widths);
    const drawHeader = () => {
      ensure(9);
      document.setFillColor(31, 64, 104);
      document.setTextColor(255, 255, 255);
      document.setFont("helvetica", "bold");
      document.setFontSize(7.2);
      let x = MARGIN;
      table.headers.forEach((header, index) => {
        document.setFillColor(31, 64, 104);
        document.rect(x, y, widths[index], 8, "F");
        document.setTextColor(255, 255, 255);
        const lines = document.splitTextToSize(header, widths[index] - 3) as string[];
        document.text(lines.slice(0, 2), x + 1.5, y + 3.3);
        x += widths[index];
      });
      y += 8;
    };

    drawHeader();
    table.rows.forEach((row, rowIndex) => {
      const wrapped = table.headers.map((_, columnIndex) =>
        document.splitTextToSize(asText(row[columnIndex]), widths[columnIndex] - 3) as string[]
      );
      const rowHeight = Math.max(7, Math.max(...wrapped.map((lines) => Math.min(lines.length, 6))) * 3.6 + 2.5);
      if (y + rowHeight > BODY_BOTTOM) {
        addPage();
        drawHeader();
      }
      document.setFillColor(rowIndex % 2 === 0 ? 248 : 239, rowIndex % 2 === 0 ? 250 : 244, rowIndex % 2 === 0 ? 252 : 248);
      document.setDrawColor(215, 221, 229);
      document.setTextColor(43, 51, 64);
      document.setFont("helvetica", "normal");
      document.setFontSize(7.2);
      let x = MARGIN;
      wrapped.forEach((lines, columnIndex) => {
        document.setFillColor(rowIndex % 2 === 0 ? 248 : 239, rowIndex % 2 === 0 ? 250 : 244, rowIndex % 2 === 0 ? 252 : 248);
        document.setDrawColor(215, 221, 229);
        document.rect(x, y, widths[columnIndex], rowHeight, "FD");
        document.setTextColor(43, 51, 64);
        document.text(lines.slice(0, 6), x + 1.5, y + 3.5);
        x += widths[columnIndex];
      });
      y += rowHeight;
    });
    y += 3;
  };

  const drawBarChart = (chart: PdfBarChart) => {
    if (chart.items.length === 0) return;
    const height = 10 + chart.items.length * 11;
    ensure(height + 4);
    const values = chart.items.map((item) => Math.max(0, chartNumber(item.value)));
    const maximum = Math.max(...values, 1);
    const labelWidth = 47;
    const valueWidth = 34;
    const barWidth = CONTENT_WIDTH - labelWidth - valueWidth - 8;

    document.setFont("helvetica", "normal");
    document.setFontSize(7);
    document.setTextColor(90, 99, 112);
    document.text(chart.unit, PAGE_WIDTH - MARGIN, y + 3, { align: "right" });
    y += 7;

    chart.items.forEach((item, index) => {
      const value = values[index];
      const fill = item.color || [198, 88, 48];
      document.setFont("helvetica", "bold");
      document.setFontSize(7.3);
      document.setTextColor(43, 51, 64);
      document.text(asText(item.label), MARGIN, y + 5.2);
      document.setFillColor(238, 241, 245);
      document.roundedRect(MARGIN + labelWidth, y, barWidth, 6.5, 1, 1, "F");
      document.setFillColor(fill[0], fill[1], fill[2]);
      document.roundedRect(MARGIN + labelWidth, y, Math.max(0.8, (value / maximum) * barWidth), 6.5, 1, 1, "F");
      document.setFont("helvetica", "normal");
      document.setTextColor(43, 51, 64);
      document.text(`${asText(item.value)} ${chart.unit}`, PAGE_WIDTH - MARGIN, y + 5.2, { align: "right" });
      y += 11;
    });
    y += 2;
  };

  const drawWaterfallChart = (chart: PdfWaterfallChart) => {
    if (chart.components.length === 0) return;
    ensure(61);
    const components = chart.components.map((item) => ({ ...item, numeric: Math.max(0, chartNumber(item.value)) }));
    const total = Math.max(0, chartNumber(chart.total));
    const maximum = Math.max(total, components.reduce((sum, item) => sum + item.numeric, 0), 1);
    const plotTop = y + 7;
    const plotHeight = 36;
    const baseline = plotTop + plotHeight;
    const columns = components.length + 1;
    const slot = CONTENT_WIDTH / columns;
    const columnWidth = Math.min(24, slot * 0.56);
    let cumulative = 0;

    document.setFont("helvetica", "normal");
    document.setFontSize(7);
    document.setTextColor(90, 99, 112);
    document.text(chart.unit, PAGE_WIDTH - MARGIN, y + 3, { align: "right" });
    document.setDrawColor(190, 199, 210);
    document.line(MARGIN, baseline, PAGE_WIDTH - MARGIN, baseline);

    components.forEach((item, index) => {
      const start = cumulative;
      cumulative += item.numeric;
      const x = MARGIN + slot * index + (slot - columnWidth) / 2;
      const top = baseline - (cumulative / maximum) * plotHeight;
      const bottom = baseline - (start / maximum) * plotHeight;
      const fill = item.color || [198, 88, 48];
      document.setFillColor(fill[0], fill[1], fill[2]);
      document.rect(x, top, columnWidth, Math.max(0.8, bottom - top), "F");
      if (index < components.length - 1) {
        document.setDrawColor(160, 169, 180);
        document.line(x + columnWidth, top, MARGIN + slot * (index + 1) + (slot - columnWidth) / 2, top);
      }
      document.setFont("helvetica", "bold");
      document.setFontSize(6.8);
      document.setTextColor(43, 51, 64);
      document.text(asText(item.value), x + columnWidth / 2, Math.max(plotTop + 3, top - 1.5), { align: "center" });
      document.setFont("helvetica", "normal");
      const labelLines = document.splitTextToSize(item.label, slot - 3) as string[];
      document.text(labelLines.slice(0, 2), MARGIN + slot * index + slot / 2, baseline + 4.2, { align: "center" });
    });

    const totalX = MARGIN + slot * components.length + (slot - columnWidth) / 2;
    const totalTop = baseline - (total / maximum) * plotHeight;
    document.setFillColor(20, 42, 74);
    document.rect(totalX, totalTop, columnWidth, Math.max(0.8, baseline - totalTop), "F");
    document.setFont("helvetica", "bold");
    document.setTextColor(20, 42, 74);
    document.text(asText(chart.total), totalX + columnWidth / 2, Math.max(plotTop + 3, totalTop - 1.5), { align: "center" });
    document.setFont("helvetica", "normal");
    document.setTextColor(43, 51, 64);
    document.text("Total embedded", MARGIN + slot * components.length + slot / 2, baseline + 4.2, { align: "center" });
    y = baseline + 13;
  };

  drawPageFrame();

  drawCallout("Document boundary", input.model.disclaimer);
  drawTable({
    headers: ["Control field", "Value", "Control field", "Value"],
    widths: [28, 62, 28, 62],
    rows: [
      ["Case ID", input.model.caseId, "Generated", input.model.generatedAt],
      ["Ruleset", input.model.ruleset.version, "Source registry", input.model.ruleset.sourceRegistryVersion],
      ["Root hash", input.model.calculationRootHash, "Verifier status", input.model.independentVerifierStatus],
    ],
  });

  for (const section of input.sections) {
    if (section.pageBreakBefore && y > BODY_TOP) addPage();
    ensure(12);
    document.setFillColor(231, 237, 244);
    document.rect(MARGIN, y, CONTENT_WIDTH, 8, "F");
    document.setTextColor(20, 42, 74);
    document.setFont("helvetica", "bold");
    document.setFontSize(10);
    document.text(section.heading, MARGIN + 3, y + 5.4);
    y += 11;

    for (const paragraph of section.paragraphs || []) drawParagraph(paragraph);
    if (section.callout) drawCallout(section.callout.label, section.callout.value);
    if (section.waterfallChart) drawWaterfallChart(section.waterfallChart);
    if (section.barChart) drawBarChart(section.barChart);
    if (section.table) drawTable(section.table);
    y += 1;
  }

  const pageCount = document.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    document.setPage(pageNumber);
    document.setDrawColor(211, 218, 227);
    document.line(MARGIN, 283, PAGE_WIDTH - MARGIN, 283);
    document.setFont("helvetica", "normal");
    document.setFontSize(7);
    document.setTextColor(90, 99, 112);
    document.text(`CBAMValid | ${compactIdentifier(input.model.reportId)}`, MARGIN, 288);
    document.text(`Page ${pageNumber} of ${pageCount}`, PAGE_WIDTH - MARGIN, 288, { align: "right" });
  }

  return Buffer.from(document.output("arraybuffer"));
}
