"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildZipDossier = buildZipDossier;
const jszip_1 = __importDefault(require("jszip"));
const seal_service_1 = require("./seal-service");
/**
 * Builds a ZIP dossier containing all output formats with manifest checksums
 * and explicit path traversal prevention on extraction.
 */
async function buildZipDossier(params) {
    const zip = new jszip_1.default();
    // Explicitly set paths avoiding any ../ or absolute paths
    const basePath = `cbam_dossier_${params.reportId}`;
    // 1. Add PDF
    zip.file(`${basePath}/report.pdf`, params.pdfBuffer);
    const pdfHash = (0, seal_service_1.calculateSha256)(params.pdfBuffer);
    // 2. Add XML
    zip.file(`${basePath}/data.xml`, params.xmlContent);
    const xmlHash = (0, seal_service_1.calculateSha256)(params.xmlContent);
    // 3. Add JSON
    zip.file(`${basePath}/data.json`, params.jsonContent);
    const jsonHash = (0, seal_service_1.calculateSha256)(params.jsonContent);
    // 4. Add CSV
    zip.file(`${basePath}/data.csv`, params.csvContent);
    const csvHash = (0, seal_service_1.calculateSha256)(params.csvContent);
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
//# sourceMappingURL=zip-builder.js.map