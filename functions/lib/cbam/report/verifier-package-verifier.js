"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyVerifierPreparationPackage = verifyVerifierPreparationPackage;
const crypto_1 = __importDefault(require("crypto"));
const jszip_1 = __importDefault(require("jszip"));
const package_contract_validator_1 = require("./package-contract-validator");
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
    if (manifest.topLevelComponentCount !== 27) {
        throw new Error("VERIFIER_PACKAGE_COMPONENT_COUNT_INVALID");
    }
    if (manifest.reportQualityAssessment.status !== "PASS") {
        throw new Error("VERIFIER_PACKAGE_REPORT_QUALITY_NOT_PASS");
    }
    const validation = await (0, package_contract_validator_1.validatePackageContract)(zipBuffer, manifest);
    if (!validation.success) {
        throw new Error(`VERIFIER_PACKAGE_CONTRACT_VIOLATION:${validation.failures.join(",")}`);
    }
    return {
        manifest,
        manifestHash: sha256(manifestBytes),
        topLevelComponentCount: manifest.topLevelComponentCount,
        verifiedFileCount: manifest.files.length,
    };
}
//# sourceMappingURL=verifier-package-verifier.js.map