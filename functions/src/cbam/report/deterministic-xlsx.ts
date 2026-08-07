import JSZip from "jszip";

/**
 * JSZip assigns the wall-clock time to newly added workbook entries. Premium
 * sealed artifacts must be reproducible for one immutable generatedAt, so pin
 * every workbook entry — including directories and hardening-added sheets — to
 * that release timestamp before manifest hashing.
 */
export async function normalizeXlsxEntryTimestamps(bytes: Buffer, generatedAt: string): Promise<Buffer> {
  const date = new Date(generatedAt);
  if (!Number.isFinite(date.getTime())) throw new Error("XLSX_GENERATED_AT_INVALID");

  const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
  for (const entry of Object.values(zip.files)) entry.date = date;

  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
    platform: "UNIX",
  });
}
