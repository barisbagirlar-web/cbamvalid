/**
 * G-06 — register single source.
 *
 * Every register is rendered from one data source into CSV, the XLSX tab and
 * the PDF table. A register that is empty is empty in all three outputs and
 * carries an emptyReason. D-05 (a 127-byte header-only Source Stream CSV next
 * to a populated workbook tab) is closed here.
 */
export interface RegisterRenderCounts {
  readonly csvDataRows: number;
  readonly xlsxDataRows: number;
  readonly pdfTableRows: number;
  readonly emptyReason?: string;
}

export function validateRegisterSingleSource(
  register: RegisterRenderCounts
): string[] {
  const errors: string[] = [];
  const { csvDataRows, xlsxDataRows, pdfTableRows, emptyReason } = register;

  if (csvDataRows !== xlsxDataRows || csvDataRows !== pdfTableRows) {
    errors.push(
      `register row counts diverge across outputs: CSV ${csvDataRows} / XLSX ${xlsxDataRows} / PDF ${pdfTableRows}`
    );
  }

  if (csvDataRows === 0 && (!emptyReason || emptyReason.trim().length === 0)) {
    errors.push("empty register must carry an emptyReason in all outputs");
  }

  return errors;
}
