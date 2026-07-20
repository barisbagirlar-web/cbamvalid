import crypto from "node:crypto";
import { jsPDF } from "jspdf";
import type { VerifierPackageModel } from "./verifier-model";

export interface PdfTable {
  headers: string[];
  rows: Array<Array<string | number | null | undefined>>;
  widths?: number[];
}

export interface PdfSection {
  heading: string;
  paragraphs?: string[];
  table?: PdfTable;
  callout?: { label: string; value: string };
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
  const result = String(value ?? "—").trim();
  return result || "—";
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
    : "BLOCKED — REMEDIATION REQUIRED";
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
    document.text(`Report ${input.model.reportId} · Release ${input.model.releaseVersion}`, MARGIN, 25);

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
    const lines = document.splitTextToSize(asText(value), CONTENT_WIDTH - 42) as string[];
    const height = Math.max(13, lines.length * 4.2 + 7);
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
    document.text(lines, MARGIN + 39, y + 6);
    y += height + 3;
  };

  const drawTable = (table: PdfTable) => {
    if (table.headers.length === 0) return;
    const widths = normalizedWidths(table.headers.length, table.widths);
    
    const headerLines = table.headers.map((header, index) =>
      document.splitTextToSize(header, widths[index] - 3) as string[]
    );
    const maxHeaderLines = Math.max(1, ...headerLines.map(lines => lines.length));
    const headerHeight = maxHeaderLines * 3.6 + 3.5;

    const drawHeader = () => {
      ensure(headerHeight + 10);
      document.setFillColor(31, 64, 104);
      document.setTextColor(255, 255, 255);
      document.setFont("helvetica", "bold");
      document.setFontSize(7.2);
      let x = MARGIN;
      table.headers.forEach((header, index) => {
        document.rect(x, y, widths[index], headerHeight, "F");
        const lines = headerLines[index];
        document.text(lines, x + 1.5, y + 4);
        x += widths[index];
      });
      y += headerHeight;
    };

    drawHeader();
    table.rows.forEach((row, rowIndex) => {
      let cellLines = table.headers.map((_, columnIndex) =>
        document.splitTextToSize(asText(row[columnIndex]), widths[columnIndex] - 3) as string[]
      );

      while (cellLines.some(lines => lines.length > 0)) {
        const availableHeight = BODY_BOTTOM - y;
        const linesThatFit = Math.floor((availableHeight - 4) / 3.6);
        
        if (linesThatFit < 1) {
          addPage();
          drawHeader();
          continue;
        }

        const maxLinesInCells = Math.max(...cellLines.map(lines => lines.length));
        const chunkLineCount = Math.min(linesThatFit, maxLinesInCells);
        const chunkHeight = Math.max(7, chunkLineCount * 3.6 + 2.5);

        document.setDrawColor(215, 221, 229);
        document.setTextColor(43, 51, 64);
        document.setFont("helvetica", "normal");
        document.setFontSize(7.2);

        let x = MARGIN;
        cellLines.forEach((lines, columnIndex) => {
          document.setFillColor(rowIndex % 2 === 0 ? 248 : 239, rowIndex % 2 === 0 ? 250 : 244, rowIndex % 2 === 0 ? 252 : 248);
          document.rect(x, y, widths[columnIndex], chunkHeight, "FD");

          const chunkText = lines.slice(0, chunkLineCount);
          document.text(chunkText, x + 1.5, y + 4);

          x += widths[columnIndex];
        });

        cellLines = cellLines.map(lines => lines.slice(chunkLineCount));
        y += chunkHeight;

        if (cellLines.some(lines => lines.length > 0)) {
          addPage();
          drawHeader();
        }
      }
    });
    y += 3;
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
    document.text(`CBAMValid · ${input.model.reportId}`, MARGIN, 288);
    document.text(`Page ${pageNumber} of ${pageCount}`, PAGE_WIDTH - MARGIN, 288, { align: "right" });
  }

  return Buffer.from(document.output("arraybuffer"));
}
