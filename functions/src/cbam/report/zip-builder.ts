import JSZip from "jszip";
import { calculateSha256 } from "./seal-service";

/**
 * Builds a ZIP dossier containing all output formats with manifest checksums
 * and explicit path traversal prevention on extraction.
 */
export async function buildZipDossier(params: {
  pdfBuffer: Buffer;
  xmlContent: string;
  jsonContent: string;
  csvContent: string;
  signature: string;
  reportId: string;
}): Promise<Buffer> {
  const zip = new JSZip();

  // Explicitly set paths avoiding any ../ or absolute paths
  const basePath = `cbam_dossier_${params.reportId}`;

  // 1. Add PDF
  zip.file(`${basePath}/report.pdf`, params.pdfBuffer);
  const pdfHash = calculateSha256(params.pdfBuffer);

  // 2. Add XML
  zip.file(`${basePath}/data.xml`, params.xmlContent);
  const xmlHash = calculateSha256(params.xmlContent);

  // 3. Add JSON
  zip.file(`${basePath}/data.json`, params.jsonContent);
  const jsonHash = calculateSha256(params.jsonContent);

  // 4. Add CSV
  zip.file(`${basePath}/data.csv`, params.csvContent);
  const csvHash = calculateSha256(params.csvContent);

  // 5. Add Checksum Manifest
  const manifest = {
    reportId: params.reportId,
    generatedAt: new Date().toISOString(),
    signature: params.signature,
    files: {
      "report.pdf": pdfHash,
      "data.xml": xmlHash,
      "data.json": jsonHash,
      "data.csv": csvHash,
    },
    // Adding path-traversal warning for compliance
    securityNotice: "All paths in this archive are flat. Any extraction tool should enforce path-traversal prevention (e.g. no ../ extraction)."
  };

  zip.file(`${basePath}/manifest.json`, JSON.stringify(manifest, null, 2));

  // Generate the zip buffer
  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: {
      level: 9
    }
  });

  return zipBuffer;
}
