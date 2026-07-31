/**
 * FAZ 15 — Render QA analyzer.
 *
 * Renders every page of a PDF to PNG and runs automated quality checks:
 *   - blank page
 *   - content outside page / clipped text
 *   - broken Unicode
 *   - table/content beyond left/right/bottom margins
 *   - footer overlap (body content bleeding into the running footer zone)
 *   - header overlap (body content bleeding into the running header zone)
 *   - minimum readable font size
 *   - missing title (page 1)
 *   - missing page number (every non-cover page)
 *
 * Usable as a CLI and as an importable function for tests.
 *
 * The mandate requires that the main report's pages are rendered and
 * individually reviewed before a release; this tool produces the PNG page
 * files for that manual pass and blocks the release when any automated
 * check fails.
 */
import { createCanvas, DOMMatrix, Path2D } from "@napi-rs/canvas";
import { getDocument, type PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

(globalThis as Record<string, unknown>).DOMMatrix = DOMMatrix;
(globalThis as Record<string, unknown>).Path2D = Path2D;

export const RENDER_QA_SCALE = 2;
export const MIN_READABLE_FONT_PT = 5.4;
export const PDF_PAGE_WIDTH_PT = 595.28; // A4 portrait 210mm
export const PDF_PAGE_HEIGHT_PT = 841.89; // A4 portrait 297mm
export const HEADER_ZONE_TOP_PT = 0;
export const HEADER_ZONE_BOTTOM_PT = 62; // 20mm running header + gold rule + tolerance
export const FOOTER_LINE_PT = 802.1; // 283mm rule
export const FOOTER_ZONE_TOP_PT = FOOTER_LINE_PT - 2;
export const FOOTER_ZONE_BOTTOM_PT = PDF_PAGE_HEIGHT_PT - 2;
export const BLANK_PAGE_MAX_INK = 0.0008; // fraction of dark pixels tolerated on a "blank" page
export const MARGIN_BAND_MM = 1.2; // outer band treated as beyond the printable margin
export const MARGIN_BAND_MAX_INK = 0.0004; // fraction of dark pixels tolerated inside the outer band

const PT_PER_MM = PDF_PAGE_WIDTH_PT / 210;

export type RenderQaCheckName =
  | "blankPage"
  | "pageOverflow"
  | "marginOverflow"
  | "footerOverlap"
  | "headerOverlap"
  | "brokenUnicode"
  | "minimumFont"
  | "missingTitle"
  | "missingPageNumber";

export interface RenderQaPageResult {
  page: number;
  pngPath: string;
  inkFraction: number;
  checks: Record<RenderQaCheckName, { pass: boolean; detail: string }>;
}

export interface RenderQaResult {
  pdfPath: string;
  pageCount: number;
  pngDir: string;
  pages: RenderQaPageResult[];
  allPass: boolean;
}

class NodeCanvasFactory {
  create(width: number, height: number) {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    return { canvas, context };
  }
  reset(canvasAndContext: { canvas: ReturnType<typeof createCanvas> }, width: number, height: number) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }
  destroy(canvasAndContext: { canvas: ReturnType<typeof createCanvas> }) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
  }
}

function isDarkPixel(value: number): boolean {
  return value < 240;
}

async function renderPagePng(
  pdfDocument: PDFDocumentProxy,
  pageNumber: number,
  outDir: string,
  scale = RENDER_QA_SCALE
): Promise<{ pngPath: string; inkFraction: number }> {
  const page = await pdfDocument.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(viewport.width, viewport.height);
  const context = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  await page.render({ canvasContext: context, viewport } as never).promise;
  const png = canvas.toBuffer("image/png");
  const pngPath = path.join(outDir, `page-${String(pageNumber).padStart(3, "0")}.png`);
  await fs.writeFile(pngPath, png);

  const { data, info } = await sharp(png).removeAlpha().grayscale().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  let dark = 0;
  for (let i = 0; i < data.length; i += 1) {
    if (isDarkPixel(data[i])) dark += 1;
  }
  return { pngPath, inkFraction: dark / (width * height) };
}

interface TextGeometry {
  str: string;
  fontSizePt: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

async function collectTextGeometry(
  pdfDocument: PDFDocumentProxy,
  pageNumber: number
): Promise<{ items: TextGeometry[]; pageText: string }> {
  const page = await pdfDocument.getPage(pageNumber);
  const content = await page.getTextContent();
  const items: TextGeometry[] = [];
  let pageText = "";
  for (const raw of content.items) {
    if (!("str" in raw)) continue;
    const item = raw as { str: string; transform: number[]; width: number };
    const [, , , d, e, f] = item.transform;
    const fontSize = Math.abs(d);
    const x0 = e;
    const x1 = e + item.width;
    const y0 = f - fontSize;
    const y1 = f + Math.max(2, fontSize * 0.2);
    items.push({ str: item.str, fontSizePt: fontSize, x0, x1, y0, y1 });
    pageText += item.str + " ";
  }
  return { items, pageText };
}

function bandDarkFraction(
  data: Buffer,
  width: number,
  height: number,
  band: { x0: number; y0: number; x1: number; y1: number }
): number {
  const x0 = Math.max(0, Math.floor(band.x0));
  const y0 = Math.max(0, Math.floor(band.y0));
  const x1 = Math.min(width, Math.ceil(band.x1));
  const y1 = Math.min(height, Math.ceil(band.y1));
  if (x1 <= x0 || y1 <= y0) return 0;
  let dark = 0;
  for (let y = y0; y < y1; y += 1) {
    const rowStart = y * width;
    for (let x = x0; x < x1; x += 1) {
      if (isDarkPixel(data[rowStart + x])) dark += 1;
    }
  }
  return dark / ((x1 - x0) * (y1 - y0));
}

async function analyzePage(
  pdfDocument: PDFDocumentProxy,
  pageNumber: number,
  pngDir: string
): Promise<RenderQaPageResult> {
  const { pngPath, inkFraction } = await renderPagePng(pdfDocument, pageNumber, pngDir);
  const checks = {} as RenderQaPageResult["checks"];

  const png = await sharp(pngPath).removeAlpha().grayscale().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = png.info;
  const pxPerPt = (width / PDF_PAGE_WIDTH_PT) * (pageNumber === 1 ? 1 : 1); // scale factor applied already
  const pxPerMm = pxPerPt * PT_PER_MM;

  const { items, pageText } = await collectTextGeometry(pdfDocument, pageNumber);

  // 1. Blank page
  const blankPass = inkFraction >= BLANK_PAGE_MAX_INK;
  checks.blankPage = { pass: blankPass, detail: `ink=${(inkFraction * 100).toFixed(3)}%` };

  // 2. Content outside page bounds / clipped text (text-level bbox)
  const overflow = items.filter((it) => it.x0 < -0.6 || it.x1 > PDF_PAGE_WIDTH_PT + 0.6 || it.y0 < -0.6 || it.y1 > PDF_PAGE_HEIGHT_PT + 0.6);
  checks.pageOverflow = {
    pass: overflow.length === 0,
    detail: overflow.length === 0 ? "no text outside page bounds" : `clipped candidates: ${overflow.map((it) => JSON.stringify(it.str)).join(", ")}`,
  };

  // 3. Margin overflow — ink in the outer band beyond the printable margin.
  // The running header fills the full width on pages 2+, so exclude the header zone.
  // Page 1 (cover) is excluded: the cover intentionally uses full-bleed navy/gold bands.
  const bandPx = Math.max(4, Math.round(MARGIN_BAND_MM * pxPerMm));
  const headerZonePx = Math.round(HEADER_ZONE_BOTTOM_PT * pxPerPt);
  let marginPass = true;
  let marginDetail = "cover excluded (full-bleed design band)";
  if (pageNumber > 1) {
    const leftInk = bandDarkFraction(png.data, width, height, { x0: 0, y0: headerZonePx, x1: bandPx, y1: height - Math.round(1 * pxPerMm) });
    const rightInk = bandDarkFraction(png.data, width, height, { x0: width - bandPx, y0: headerZonePx, x1: width, y1: height - Math.round(1 * pxPerMm) });
    const bottomInk = bandDarkFraction(png.data, width, height, { x0: 0, y0: height - Math.round(1 * pxPerMm), x1: width, y1: height });
    marginPass = leftInk <= MARGIN_BAND_MAX_INK && rightInk <= MARGIN_BAND_MAX_INK && bottomInk <= MARGIN_BAND_MAX_INK;
    marginDetail = `left=${(leftInk * 100).toFixed(4)}% right=${(rightInk * 100).toFixed(4)}% bottom=${(bottomInk * 100).toFixed(4)}%`;
  }
  checks.marginOverflow = { pass: marginPass, detail: marginDetail };

  // 4. Footer overlap — body text bleeding into the running-footer zone.
  const footerItems = items.filter((it) => it.y0 >= FOOTER_ZONE_TOP_PT && it.y1 <= FOOTER_ZONE_BOTTOM_PT);
  const nonFooterText = items.filter((it) => it.y0 < FOOTER_ZONE_TOP_PT && it.y1 > FOOTER_LINE_PT);
  checks.footerOverlap = {
    pass: nonFooterText.length === 0,
    detail: nonFooterText.length === 0 ? `footer zone holds ${footerItems.length} expected item(s)` : `body overlaps footer: ${nonFooterText.map((it) => JSON.stringify(it.str)).join(", ")}`,
  };

  // 5. Header overlap — body text bleeding into the running-header zone (pages 2+).
  const headerZoneItems = items.filter((it) => it.y0 >= HEADER_ZONE_TOP_PT && it.y1 <= HEADER_ZONE_BOTTOM_PT);
  const bodyIntoToggle = items.filter((it) => it.y0 < HEADER_ZONE_BOTTOM_PT && it.y1 > HEADER_ZONE_BOTTOM_PT);
  checks.headerOverlap = {
    pass: bodyIntoToggle.length === 0,
    detail: bodyIntoToggle.length === 0 ? `header zone holds ${headerZoneItems.length} expected item(s)` : `body crosses header boundary: ${bodyIntoToggle.map((it) => JSON.stringify(it.str)).join(", ")}`,
  };

  // 6. Broken Unicode — replacement characters or lone surrogates.
  const broken = items.filter((it) => /\uFFFD|[\uD800-\uDFFF]/.test(it.str));
  checks.brokenUnicode = { pass: broken.length === 0, detail: broken.length === 0 ? "clean text" : `replacement chars: ${broken.map((it) => JSON.stringify(it.str)).join(", ")}` };

  // 7. Minimum readable font size.
  const minFont = items.reduce((min, it) => Math.min(min, it.fontSizePt), Number.POSITIVE_INFINITY);
  const minFontPass = minFont >= MIN_READABLE_FONT_PT;
  checks.minimumFont = {
    pass: minFontPass,
    detail: minFontPass ? `min font ${minFont.toFixed(2)}pt` : `min font ${minFont.toFixed(2)}pt below ${MIN_READABLE_FONT_PT}pt`,
  };

  // 8. Missing title (page 1 only).
  if (pageNumber === 1) {
    const hasTitle = /CBAMValid/.test(pageText) && /Verification Readiness/.test(pageText);
    checks.missingTitle = { pass: hasTitle, detail: hasTitle ? "cover title present" : "cover title missing" };
  } else {
    checks.missingTitle = { pass: true, detail: "not applicable on non-cover page" };
  }

  // 9. Missing page number (all pages except the cover).
  if (pageNumber === 1) {
    checks.missingPageNumber = { pass: true, detail: "cover excluded by design" };
  } else {
    const hasPageNumber = /Page\s+\d+\s+of\s+\d+/i.test(pageText);
    checks.missingPageNumber = { pass: hasPageNumber, detail: hasPageNumber ? "page number present" : "page number missing" };
  }

  return { page: pageNumber, pngPath, inkFraction, checks };
}

export async function analyzeRenderQa(
  pdfPath: string,
  options: { pngDir?: string } = {}
): Promise<RenderQaResult> {
  const pngDir = options.pngDir ?? path.join(process.cwd(), "artifacts", "render-qa", path.basename(pdfPath, path.extname(pdfPath)));
  await fs.mkdir(pngDir, { recursive: true });
  const pdfBytes = new Uint8Array(await fs.readFile(pdfPath));
  const pdfDocument = await getDocument({
    data: pdfBytes,
    CanvasFactory: NodeCanvasFactory,
    standardFontDataUrl: path.join(process.cwd(), "node_modules", "pdfjs-dist", "standard_fonts") + path.sep,
  } as Parameters<typeof getDocument>[0]).promise;

  const pages: RenderQaPageResult[] = [];
  for (let p = 1; p <= pdfDocument.numPages; p += 1) {
    pages.push(await analyzePage(pdfDocument, p, pngDir));
  }

  const allPass = pages.every((page) => Object.values(page.checks).every((check) => check.pass));
  return { pdfPath, pageCount: pdfDocument.numPages, pngDir, pages, allPass };
}

function formatPageLine(page: RenderQaPageResult): string {
  const results = Object.entries(page.checks).map(([name, check]) => `${name}=${check.pass ? "PASS" : "FAIL"}`).join(" ");
  return `page ${String(page.page).padStart(3)}: ${results}`;
}

async function main(): Promise<void> {
  const pdfPath = process.argv[2];
  const outIndex = process.argv.indexOf("--out");
  const pngDir = outIndex >= 0 ? process.argv[outIndex + 1] : undefined;
  if (!pdfPath) {
    console.error("usage: npx tsx scripts/render-qa/analyze-render-qa.ts <pdf> [--out <pngDir>]");
    process.exit(2);
  }
  const result = await analyzeRenderQa(pdfPath, { pngDir });
  console.log(`PDF: ${result.pdfPath}`);
  console.log(`Pages: ${result.pageCount} rendered to PNG in: ${result.pngDir}`);
  for (const page of result.pages) {
    console.log(formatPageLine(page));
    if (!Object.values(page.checks).every((check) => check.pass)) {
      for (const [name, check] of Object.entries(page.checks)) {
        if (!check.pass) console.log(`  FAIL ${name}: ${check.detail}`);
      }
    }
  }
  if (!result.allPass) {
    console.error("RENDER_QA=FAIL");
    process.exit(1);
  }
  console.log("RENDER_QA=PASS");
  console.log("");
  console.log("MANUAL_RENDER_QA_CHECKLIST (release gate — each item must be completed by a reviewer):");
  console.log("  1. Desktop PDF viewer: open every PNG in artifacts/render-qa, confirm no blank/broken page");
  console.log("  2. Chrome: open the PDF and scroll every page; confirm no clipped text or overflow");
  console.log("  3. Safari Preview: confirm fonts, tables and section bookmarks render");
  console.log("  4. Adobe Acrobat: confirm clickable TOC, page numbers and outline/bookmarks");
  console.log("  5. Printed A4 preview: confirm tables fit, no orphan rows, footer/header do not overlap");
  console.log("RELEASE BLOCKED until every page of the main report has been individually reviewed.");
}

if (require.main === module) {
  void main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
