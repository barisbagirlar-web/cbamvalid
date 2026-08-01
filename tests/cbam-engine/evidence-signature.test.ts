import { describe, expect, it } from "vitest";
import {
  assertEvidenceFileSignature,
  matchesDeclaredMimeSignature,
} from "../../functions/src/cbam/storage/evidence-signature";

describe("evidence file signature verification (S9 magic-byte)", () => {
  const PDF = Buffer.concat([Buffer.from("%PDF-1.7\n%CBAM\n"), Buffer.alloc(200, 1)]);
  const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(100, 1)]);
  const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100, 1)]);
  const XLS_LEGACY = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(100, 1)]);
  const XLSX = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(100, 1)]);
  const CSV = Buffer.from("good,rows\n1,2\n");
  const TXT = Buffer.from("plain text content");
  const UTF8_BOM_CSV = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("sep=,\nheader\n")]);
  const UTF16LE_CSV = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("a,1\nb,2\n", "utf16le")]);

  it("accepts real magic-byte signatures for every supported binary type", () => {
    expect(matchesDeclaredMimeSignature(PDF, "application/pdf")).toBe(true);
    expect(matchesDeclaredMimeSignature(PNG, "image/png")).toBe(true);
    expect(matchesDeclaredMimeSignature(JPEG, "image/jpeg")).toBe(true);
    expect(matchesDeclaredMimeSignature(XLS_LEGACY, "application/vnd.ms-excel")).toBe(true);
    expect(matchesDeclaredMimeSignature(XLSX, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe(true);
    expect(matchesDeclaredMimeSignature(CSV, "text/csv")).toBe(true);
    expect(matchesDeclaredMimeSignature(TXT, "text/plain")).toBe(true);
    expect(matchesDeclaredMimeSignature(UTF8_BOM_CSV, "text/csv")).toBe(true);
    expect(matchesDeclaredMimeSignature(UTF16LE_CSV, "text/csv")).toBe(true);
  });

  it("rejects MIME spoofing (bytes do not match declared type)", () => {
    // PDF declared, but bytes are an executable MZ header
    const spoof = Buffer.concat([Buffer.from("MZ\x90\x00\x03"), Buffer.alloc(100, 1)]);
    expect(matchesDeclaredMimeSignature(spoof, "application/pdf")).toBe(false);
    expect(matchesDeclaredMimeSignature(PDF, "image/png")).toBe(false);
    expect(matchesDeclaredMimeSignature(PNG, "application/pdf")).toBe(false);
    expect(matchesDeclaredMimeSignature(JPEG, "image/png")).toBe(false);
    expect(matchesDeclaredMimeSignature(XLS_LEGACY, "application/pdf")).toBe(false);
    expect(matchesDeclaredMimeSignature(CSV, "application/pdf")).toBe(false);
    expect(matchesDeclaredMimeSignature(TXT, "application/pdf")).toBe(false);
  });

  it("rejects polyglot / embedded-binary text (null byte inside text region)", () => {
    const binaryInsideText = Buffer.concat([Buffer.from("normal,text\n"), Buffer.from([0x41, 0x00, 0x42])]);
    expect(matchesDeclaredMimeSignature(binaryInsideText, "text/csv")).toBe(false);
    expect(matchesDeclaredMimeSignature(binaryInsideText, "text/plain")).toBe(false);
  });

  it("rejects empty buffers and truncated signatures", () => {
    expect(matchesDeclaredMimeSignature(Buffer.alloc(0), "application/pdf")).toBe(false);
    expect(matchesDeclaredMimeSignature(Buffer.alloc(0), "text/plain")).toBe(false);
    expect(matchesDeclaredMimeSignature(Buffer.from("%PD"), "application/pdf")).toBe(false);
    expect(matchesDeclaredMimeSignature(Buffer.from([0x50, 0x4b]), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe(false);
  });

  it("is fail-closed for unknown or unsupported declared types", () => {
    expect(matchesDeclaredMimeSignature(PDF, "application/x-msdownload")).toBe(false);
    expect(matchesDeclaredMimeSignature(PDF, "text/html")).toBe(false);
  });

  it("throws EVIDENCE_FILE_SIGNATURE_MISMATCH for a spoofed file and returns clean for genuine bytes", () => {
    const spoof = Buffer.concat([Buffer.from("MZ\x90\x00\x03"), Buffer.alloc(100, 1)]);
    expect(() => assertEvidenceFileSignature(spoof, "application/pdf")).toThrow(
      "EVIDENCE_FILE_SIGNATURE_MISMATCH:application/pdf"
    );
    expect(() => assertEvidenceFileSignature(PDF, "application/pdf")).not.toThrow();
    expect(() => assertEvidenceFileSignature(CSV, "text/csv")).not.toThrow();
  });
});
