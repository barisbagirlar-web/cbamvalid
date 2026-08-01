/**
 * Server-side evidence file signature (magic-byte) verification.
 *
 * A client-declared MIME type is not proof of the real file type. These
 * helpers inspect the leading bytes of the downloaded object so that a spoofed
 * or polyglot file is rejected before it can be internally approved or sealed.
 *
 * Text-family types (CSV, plain text) cannot be pinned to a single magic byte
 * (they may carry a UTF-8/UTF-16 BOM and still be legitimate), so they are
 * checked for binary-content heuristics instead.
 */

const BINARY_TEXT_SCAN_BYTES = 512;

function startsWith(bytes: Buffer, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) return false;
  for (let index = 0; index < signature.length; index += 1) {
    if (bytes[index] !== signature[index]) return false;
  }
  return true;
}

function isTextLike(bytes: Buffer): boolean {
  const scan = bytes.subarray(0, BINARY_TEXT_SCAN_BYTES);
  if (scan.length === 0) return false;
  // UTF-16 LE/BE BOMs are legitimate for Excel-exported CSV/text files.
  const hasUtf16Bom =
    startsWith(bytes, [0xff, 0xfe]) || startsWith(bytes, [0xfe, 0xff]);
  if (hasUtf16Bom) return true;
  const utf8Bom = startsWith(bytes, [0xef, 0xbb, 0xbf]);
  for (let index = utf8Bom ? 3 : 0; index < scan.length; index += 1) {
    if (scan[index] === 0x00) return false;
  }
  return true;
}

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46]; // %PDF
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const OLE2_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]; // legacy XLS
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04]; // XLSX (OOXML) and generic zip

/**
 * Returns true when the leading bytes of `bytes` match the well-known
 * signature for `mimeType`, or when the text-family heuristic passes.
 */
export function matchesDeclaredMimeSignature(bytes: Buffer, mimeType: string): boolean {
  switch (mimeType) {
    case "application/pdf":
      return startsWith(bytes, PDF_SIGNATURE);
    case "image/png":
      return startsWith(bytes, PNG_SIGNATURE);
    case "image/jpeg":
      return startsWith(bytes, JPEG_SIGNATURE);
    case "application/vnd.ms-excel":
      return startsWith(bytes, OLE2_SIGNATURE) || startsWith(bytes, ZIP_SIGNATURE);
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      return startsWith(bytes, ZIP_SIGNATURE);
    case "text/csv":
    case "text/plain":
      return isTextLike(bytes);
    default:
      return false;
  }
}

/**
 * Throws when the file bytes do not match the declared MIME type signature.
 * Fail-closed: unknown or unsupported declared types are rejected.
 */
export function assertEvidenceFileSignature(bytes: Buffer, mimeType: string): void {
  if (!matchesDeclaredMimeSignature(bytes, mimeType)) {
    throw new Error(`EVIDENCE_FILE_SIGNATURE_MISMATCH:${mimeType}`);
  }
}
