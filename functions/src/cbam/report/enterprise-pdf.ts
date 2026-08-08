import crypto from "node:crypto";
import { jsPDF } from "jspdf";
import type { VerifierPackageModel } from "./verifier-model";

export type EnterpriseReadinessStatus =
  | "READY_FOR_VERIFICATION"
  | "CONDITIONAL"
  | "NOT_READY";

export interface EnterprisePdfTable {
  headers: string[];
  rows: unknown[][];
  widths?: number[];
}

export type EnterprisePdfTableInput = EnterprisePdfTable | unknown[][];

export interface EnterprisePdfBarChart {
  unit: string;
  items: Array<{ label: string; value: string | number }>;
}

export interface EnterprisePdfSection {
  heading: string;
  paragraphs?: string[];
  table?: EnterprisePdfTableInput;
  callout?: { label: string; value: string };
  barChart?: EnterprisePdfBarChart;
  pageBreakBefore?: boolean;
}

export interface EnterprisePdfInput {
  title: string;
  subtitle: string;
  uniqueRole: string;
  status: EnterpriseReadinessStatus;
  preparationScore: string;
  model: VerifierPackageModel;
  sections: EnterprisePdfSection[];
}

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 15;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BODY_TOP = 48;
const BODY_BOTTOM = 278;

function digest(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function asText(value: unknown): string {
  const result = String(value ?? "Not supplied").trim();
  return result || "Not supplied";
}

function normalizedWidths(count: number, requested?: number[]): number[] {
  if (!requested || requested.length !== count || requested.some((value) => !Number.isFinite(value) || value <= 0)) {
    return Array.from({ length: count }, () => CONTENT_WIDTH / count);
  }
  const total = requested.reduce((sum, value) => sum + value, 0);
  return requested.map((value) => (value / total) * CONTENT_WIDTH);
}

function normalizedTable(input: EnterprisePdfTableInput): EnterprisePdfTable {
  if (!Array.isArray(input)) return input;
  const columnCount = Math.max(1, ...input.map((row) => row.length));
  const headers = columnCount === 5
    ? ["Draft ID", "Title", "Purpose", "State", "Missing inputs"]
    : Array.from({ length: columnCount }, (_, index) => `Column ${index + 1}`);
  return { headers, rows: input };
}

function statusPalette(status: EnterpriseReadinessStatus): {
  fill: [number, number, number];
  stroke: [number, number, number];
  text: [number, number, number];
} {
  if (status === "READY_FOR_VERIFICATION") {
    return { fill: [226, 244, 236], stroke: [22, 101, 72], text: [16, 92, 65] };
  }
  if (status === "CONDITIONAL") {
    return { fill: [254, 244, 219], stroke: [168, 105, 24], text: [137, 81, 14] };
  }
  return { fill: [253, 232, 228], stroke: [171, 61, 45], text: [145, 45, 32] };
}

export function buildEnterprisePdf(input: EnterprisePdfInput): Buffer {
  const document = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  document.setCreationDate(new Date(input.model.generatedAt));
  document.setFileId(digest(`${input.model.reportId}:${input.title}:enterprise-1000`).slice(0, 32).toUpperCase());
  document.setProperties({
    title: input.title,
    subject: input.subtitle,
    author: "CBAMValid",
    creator: "CBAMValid Enterprise Verifier-Preparation Engine",
    keywords: "CBAM, verifier preparation, evidence assurance, materiality, scenario analysis, corrective action",
  });

  let y = BODY_TOP;

  const drawFrame = () => {
    document.setFillColor(18, 37, 62);
    document.rect(0, 0, PAGE_WIDTH, 34, "F");
    document.setFillColor(197, 103, 62);
    document.rect(0, 34, PAGE_WIDTH, 1.4, "F");

    document.setTextColor(255, 255, 255);
    document.setFont("helvetica", "bold");
    document.setFontSize(14.5);
    document.text(input.title, MARGIN, 11);
    document.setFont("helvetica", "normal");
    document.setFontSize(8.1);
    const subtitleLines = document.splitTextToSize(input.subtitle, 116) as string[];
    document.text(subtitleLines.slice(0, 2), MARGIN, 18);
    document.setFontSize(7.2);
    document.text(`Package ${input.model.packageCode} | Release ${input.model.releaseVersion}`, MARGIN, 29);

    const palette = statusPalette(input.status);
    document.setFillColor(...palette.fill);
    document.setDrawColor(...palette.stroke);
    document.roundedRect(135, 7.5, 60, 19, 2, 2, "FD");
    document.setTextColor(...palette.text);
    document.setFont("helvetica", "bold");
    document.setFontSize(6.5);
    document.text("ENTERPRISE READINESS", 165, 12, { align: "center" });
    document.setFontSize(7.2);
    const statusLines = document.splitTextToSize(input.status, 54) as string[];
    document.text(statusLines, 165, 17, { align: "center" });
    document.setFontSize(6.5);
    document.text(`Preparation score ${input.preparationScore}/100`, 165, 24, { align: "center" });

    document.setTextColor(75, 83, 94);
    document.setFont("helvetica", "normal");
    document.setFontSize(7.1);
    document.text(input.model.documentClassification, MARGIN, 41);
  };

  const addPage = () => {
    document.addPage();
    drawFrame();
    y = BODY_TOP;
  };

  const ensure = (height: number) => {
    if (y + height > BODY_BOTTOM) addPage();
  };

  const drawHeading = (heading: string) => {
    ensure(10);
    document.setTextColor(18, 37, 62);
    document.setFont("helvetica", "bold");
    document.setFontSize(10.5);
    document.text(heading, MARGIN, y);
    document.setDrawColor(218, 222, 226);
    document.line(MARGIN, y + 2, PAGE_WIDTH - MARGIN, y + 2);
    y += 7;
  };

  const drawParagraph = (paragraph: string) => {
    const lines = document.splitTextToSize(asText(paragraph), CONTENT_WIDTH) as string[];
    ensure(lines.length * 4.25 + 2);
    document.setTextColor(45, 52, 61);
    document.setFont("helvetica", "normal");
    document.setFontSize(8.5);
    document.text(lines, MARGIN, y);
    y += lines.length * 4.25 + 2;
  };

  const drawCallout = (label: string, value: string) => {
    document.setFont("helvetica", "bold");
    document.setFontSize(7.2);
    const labelLines = document.splitTextToSize(label.toUpperCase(), CONTENT_WIDTH - 10) as string[];
    document.setFont("helvetica", "normal");
    document.setFontSize(8.1);
    const valueLines = document.splitTextToSize(asText(value), CONTENT_WIDTH - 10) as string[];
    const height = 7 + labelLines.length * 3.5 + valueLines.length * 4 + 4;
    ensure(height + 3);
    document.setFillColor(247, 246, 242);
    document.setDrawColor(213, 207, 195);
    document.roundedRect(MARGIN, y, CONTENT_WIDTH, height, 1.8, 1.8, "FD");
    document.setFillColor(197, 103, 62);
    document.rect(MARGIN, y, 2.5, height, "F");
    document.setTextColor(18, 37, 62);
    document.setFont("helvetica", "bold");
    document.setFontSize(7.2);
    document.text(labelLines, MARGIN + 5, y + 5);
    document.setTextColor(45, 52, 61);
    document.setFont("helvetica", "normal");
    document.setFontSize(8.1);
    document.text(valueLines, MARGIN + 5, y + 9 + labelLines.length * 3.5);
    y += height + 3;
  };

  const drawTable = (tableInput: EnterprisePdfTableInput) => {
    const table = normalizedTable(tableInput);
    if (table.headers.length === 0) return;
    const widths = normalizedWidths(table.headers.length, table.widths);
    const drawHeader = () => {
      const headerLines = table.headers.map((header, index) => document.splitTextToSize(header, widths[index] - 3) as string[]);
      const height = Math.max(7, Math.max(...headerLines.map((lines) => lines.length)) * 3.4 + 3.5);
      ensure(height + 7);
      document.setFillColor(34, 66, 98);
      document.setTextColor(255, 255, 255);
      document.setFont("helvetica", "bold");
      document.setFontSize(6.8);
      let x = MARGIN;
      table.headers.forEach((header, index) => {
        document.rect(x, y, widths[index], height, "F");
        document.text(headerLines[index], x + 1.5, y + 4);
        x += widths[index];
      });
      y += height;
    };

    drawHeader();
    table.rows.forEach((row, rowIndex) => {
      const cellLines = table.headers.map((_, index) => document.splitTextToSize(asText(row[index]), widths[index] - 3) as string[]);
      const lineCount = Math.max(1, ...cellLines.map((lines) => lines.length));
      const height = Math.max(6.4, lineCount * 3.25 + 2.5);
      if (y + height > BODY_BOTTOM) {
        addPage();
        drawHeader();
      }
      document.setFont("helvetica", "normal");
      document.setFontSize(6.7);
      document.setTextColor(45, 52, 61);
      let x = MARGIN;
      cellLines.forEach((lines, index) => {
        const shade = rowIndex % 2 === 0 ? 250 : 244;
        document.setFillColor(shade, shade, shade === 250 ? 248 : 242);
        document.setDrawColor(218, 222, 226);
        document.rect(x, y, widths[index], height, "FD");
        document.text(lines, x + 1.5, y + 3.9);
        x += widths[index];
      });
      y += height;
    });
    y += 3;
  };

  const drawBarChart = (chart: EnterprisePdfBarChart) => {
    if (chart.items.length === 0) return;
    const values = chart.items.map((item) => Math.abs(Number(item.value) || 0));
    const max = Math.max(1, ...values);
    const height = 8 + chart.items.length * 10;
    ensure(height + 3);
    document.setFont("helvetica", "normal");
    document.setFontSize(6.8);
    chart.items.forEach((item) => {
      const raw = Number(item.value) || 0;
      const width = Math.max(0, Math.min(112, (Math.abs(raw) / max) * 112));
      document.setTextColor(45, 52, 61);
      document.text(item.label, MARGIN, y + 4);
      document.setFillColor(230, 233, 235);
      document.roundedRect(MARGIN + 55, y, 112, 5, 1, 1, "F");
      document.setFillColor(raw < 0 ? 58 : 197, raw < 0 ? 112 : 103, raw < 0 ? 146 : 62);
      document.roundedRect(MARGIN + 55, y, width, 5, 1, 1, "F");
      document.setTextColor(75, 83, 94);
      document.text(`${asText(item.value)} ${chart.unit}`, PAGE_WIDTH - MARGIN, y + 4, { align: "right" });
      y += 10;
    });
    y += 2;
  };

  drawFrame();
  drawCallout("Unique document role", input.uniqueRole);

  for (const section of input.sections) {
    if (section.pageBreakBefore && y > BODY_TOP + 2) addPage();
    drawHeading(section.heading);
    for (const paragraph of section.paragraphs ?? []) drawParagraph(paragraph);
    if (section.callout) drawCallout(section.callout.label, section.callout.value);
    if (section.barChart) drawBarChart(section.barChart);
    if (section.table) drawTable(section.table);
  }

  const pages = document.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    document.setPage(page);
    document.setDrawColor(221, 224, 228);
    document.line(MARGIN, PAGE_HEIGHT - 13, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 13);
    document.setTextColor(104, 111, 120);
    document.setFont("helvetica", "normal");
    document.setFontSize(6.4);
    document.text(`Report ${input.model.reportId} | ${input.status} | Page ${page}/${pages}`, MARGIN, PAGE_HEIGHT - 8);
    document.text("Operator-prepared verifier-preparation material. No independent verification opinion is implied.", PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 8, { align: "right" });
  }

  return Buffer.from(document.output("arraybuffer"));
}
