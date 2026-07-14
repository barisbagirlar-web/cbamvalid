"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyVerifierPreparationPackage = verifyVerifierPreparationPackage;
const crypto_1 = __importDefault(require("crypto"));
const jszip_1 = __importDefault(require("jszip"));
const verifier_package_builder_1 = require("./verifier-package-builder");
function sha256(value) {
    return crypto_1.default.createHash("sha256").update(value).digest("hex");
}
/**
 * Independently verifies a generated package from its ZIP bytes.
 * It does not trust the in-memory build result: every manifest-listed file is
 * loaded from the archive and checked for exact byte size and SHA-256 hash.
 */
async function verifyVerifierPreparationPackage(zipBuffer) {
    const zip = await jszip_1.default.loadAsync(zipBuffer, { checkCRC32: true });
    const manifestEntry = zip.file("22_Data_Integrity_Manifest.json");
    if (!manifestEntry)
        throw new Error("VERIFIER_PACKAGE_MANIFEST_MISSING");
    const manifestBytes = await manifestEntry.async("nodebuffer");
    let manifest;
    try {
        manifest = JSON.parse(manifestBytes.toString("utf8"));
    }
    catch (_a) {
        throw new Error("VERIFIER_PACKAGE_MANIFEST_INVALID_JSON");
    }
    if (manifest.manifestVersion !== "2.0") {
        throw new Error("VERIFIER_PACKAGE_MANIFEST_VERSION_INVALID");
    }
    if (manifest.topLevelComponentCount !== 23) {
        throw new Error("VERIFIER_PACKAGE_COMPONENT_COUNT_INVALID");
    }
    if (manifest.reportQualityAssessment.status !== "PASS") {
        throw new Error("VERIFIER_PACKAGE_REPORT_QUALITY_NOT_PASS");
    }
    for (const required of verifier_package_builder_1.REQUIRED_TOP_LEVEL_COMPONENTS) {
        if (required.endsWith("/")) {
            const prefixExists = Object.keys(zip.files).some((name) => name.startsWith(required));
            if (!prefixExists)
                throw new Error(`VERIFIER_PACKAGE_COMPONENT_MISSING:${required}`);
        }
        else if (!zip.file(required)) {
            throw new Error(`VERIFIER_PACKAGE_COMPONENT_MISSING:${required}`);
        }
    }
    const seen = new Set();
    for (const file of manifest.files) {
        if (seen.has(file.filename)) {
            throw new Error(`VERIFIER_PACKAGE_MANIFEST_DUPLICATE_FILE:${file.filename}`);
        }
        seen.add(file.filename);
        const entry = zip.file(file.filename);
        if (!entry)
            throw new Error(`VERIFIER_PACKAGE_FILE_MISSING:${file.filename}`);
        const bytes = await entry.async("nodebuffer");
        if (bytes.byteLength !== file.sizeBytes) {
            throw new Error(`VERIFIER_PACKAGE_FILE_SIZE_MISMATCH:${file.filename}`);
        }
        if (sha256(bytes) !== file.sha256.toLowerCase()) {
            throw new Error(`VERIFIER_PACKAGE_FILE_HASH_MISMATCH:${file.filename}`);
        }
    }
    return {
        manifest,
        manifestHash: sha256(manifestBytes),
        topLevelComponentCount: manifest.topLevelComponentCount,
        verifiedFileCount: manifest.files.length,
    };
}
//# sourceMappingURL=verifier-package-verifier.js.map