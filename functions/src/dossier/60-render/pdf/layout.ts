/**
 * WP-14 layout helpers — READ-ONLY formatting. No emission arithmetic.
 */

export function nowrapStyle(): string {
  return "white-space: nowrap; hyphens: none; font-family: monospace;";
}

export function shortUuid(id: string): string {
  const s = String(id || "");
  if (s.length < 12) return s;
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

export function footerOneLine(params: {
  reportId?: string;
  packageCode: string;
  releaseIteration: number;
  page: number;
  pageCount: number;
}): string {
  const report = params.reportId ? ` · Report ${params.reportId}` : "";
  return `CBAMValid · ${params.packageCode} · Release ${params.releaseIteration}${report} · Page ${params.page} of ${params.pageCount} · CONFIDENTIAL`;
}

export function formatIdCell(id: string): { display: string; css: string } {
  return { display: id, css: nowrapStyle() };
}
