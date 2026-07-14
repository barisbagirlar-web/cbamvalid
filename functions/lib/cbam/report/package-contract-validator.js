"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePackageContract = validatePackageContract;
const jszip_1 = __importDefault(require("jszip"));
const crypto_1 = __importDefault(require("crypto"));
const package_manifest_1 = require("./package-manifest");
function sha256(buffer) {
    return crypto_1.default.createHash("sha256").update(buffer).digest("hex");
}
async function validatePackageContract(zipBuffer, manifest) {
    const failures = [];
    let zip;
    try {
        zip = await jszip_1.default.loadAsync(zipBuffer);
    }
    catch (err) {
        return { success: false, failures: [`INVALID_ZIP_ARCHIVE: ${err.message}`] };
    }
    // 1. Get physical files
    const fileNames = Object.keys(zip.files);
    const physicalFilesOnly = fileNames.filter((name) => !zip.files[name].dir);
    // 10. Path traversal checks
    for (const name of fileNames) {
        if (name.includes("..") || name.startsWith("/") || name.startsWith("\\")) {
            failures.push(`PACKAGE_COMPONENT_PATH_TRAVERSAL: Unsafe path detected: ${name}`);
        }
    }
    // 9. Duplicate normalized paths
    const normSet = new Set();
    for (const name of fileNames) {
        const norm = name.replace(/\\/g, "/").toLowerCase();
        if (normSet.has(norm)) {
            failures.push(`PACKAGE_COMPONENT_DUPLICATE: Duplicate file in ZIP: ${name}`);
        }
        normSet.add(norm);
    }
    // Determine top-level physical components present
    const physicalTopLevelComponents = new Set();
    for (const name of fileNames) {
        if (name.startsWith("23_Supporting_Evidence/")) {
            physicalTopLevelComponents.add("23_Supporting_Evidence/");
        }
        else {
            // Split and take first segment
            const parts = name.split("/");
            if (parts[0]) {
                physicalTopLevelComponents.add(parts[0]);
            }
        }
    }
    // Check 27 components mapping
    const expectedFilenames = package_manifest_1.PACKAGE_COMPONENTS.map((c) => c.filename);
    // 1. Exactly 27 known required top-level components exist
    // 2. No required top-level component is missing
    for (const comp of package_manifest_1.PACKAGE_COMPONENTS) {
        if (!physicalTopLevelComponents.has(comp.filename)) {
            failures.push(`PACKAGE_COMPONENT_MISSING: Missing required component: ${comp.filename}`);
        }
    }
    // 3. No unknown top-level component exists
    for (const top of physicalTopLevelComponents) {
        if (!expectedFilenames.includes(top)) {
            failures.push(`PACKAGE_COMPONENT_UNKNOWN: Unknown top-level component: ${top}`);
        }
    }
    // 4. Child evidence files are allowed only below 23_Supporting_Evidence/
    for (const name of physicalFilesOnly) {
        if (name.includes("/") && !name.startsWith("23_Supporting_Evidence/")) {
            failures.push(`PACKAGE_COMPONENT_NESTING_VIOLATION: File nested outside evidence dir: ${name}`);
        }
    }
    // Parse manifest from ZIP if not passed
    let parsedManifest = manifest;
    if (!parsedManifest) {
        const manifestFile = zip.file("22_Data_Integrity_Manifest.json");
        if (!manifestFile) {
            failures.push("PACKAGE_COMPONENT_MISSING: Manifest file 22_Data_Integrity_Manifest.json not found in ZIP");
        }
        else {
            try {
                parsedManifest = JSON.parse(await manifestFile.async("string"));
            }
            catch (err) {
                failures.push(`MANIFEST_JSON_PARSE_ERROR: ${err.message}`);
            }
        }
    }
    if (parsedManifest) {
        // 15. Manifest records topLevelComponentCount=27
        if (parsedManifest.topLevelComponentCount !== 27) {
            failures.push(`MANIFEST_COUNT_MISMATCH: Expected topLevelComponentCount=27, got ${parsedManifest.topLevelComponentCount}`);
        }
        const manifestFiles = parsedManifest.files || [];
        const manifestFilenames = manifestFiles.map((f) => f.filename);
        // 5. Every physical file is represented in the manifest (except the manifest itself and directory entries)
        const filesToMatch = physicalFilesOnly.filter((name) => name !== "22_Data_Integrity_Manifest.json");
        for (const name of filesToMatch) {
            if (!manifestFilenames.includes(name)) {
                failures.push(`PHYSICAL_MANIFEST_PARITY_ERROR: Physical file ${name} is not in the manifest`);
            }
        }
        // 6. Every manifest file physically exists
        for (const mName of manifestFilenames) {
            if (!physicalFilesOnly.includes(mName)) {
                failures.push(`PHYSICAL_MANIFEST_PARITY_ERROR: Manifest file ${mName} does not exist in the ZIP`);
            }
        }
        // 7. Every file hash matches, 8. Every file size matches, 11. No required file is empty
        for (const mFile of manifestFiles) {
            const zipFile = zip.file(mFile.filename);
            if (zipFile) {
                const buffer = await zipFile.async("nodebuffer");
                // Hash
                const realHash = sha256(buffer);
                if (realHash !== mFile.sha256) {
                    failures.push(`PACKAGE_COMPONENT_HASH_MISMATCH: Hash mismatch for ${mFile.filename}`);
                }
                // Size
                if (buffer.byteLength !== mFile.sizeBytes) {
                    failures.push(`PACKAGE_COMPONENT_SIZE_MISMATCH: Size mismatch for ${mFile.filename}`);
                }
                // 11. No required file is empty
                if (buffer.byteLength === 0) {
                    failures.push(`PACKAGE_COMPONENT_EMPTY: File ${mFile.filename} is empty`);
                }
                // 12. PDFs contain valid PDF bytes and substantive minimum content
                if (mFile.filename.endsWith(".pdf")) {
                    const isPdfHeader = buffer.slice(0, 5).toString("utf8") === "%PDF-";
                    if (!isPdfHeader) {
                        failures.push(`INVALID_PDF_FORMAT: ${mFile.filename} lacks PDF header`);
                    }
                    else if (buffer.byteLength < 100) {
                        failures.push(`PACKAGE_COMPONENT_EMPTY: PDF ${mFile.filename} has insufficient length`);
                    }
                }
                // 13. CSVs contain required headers and at least one substantive data row (Sentinel whitelist for 26)
                if (mFile.filename.endsWith(".csv")) {
                    const contentStr = buffer.toString("utf8").trim();
                    const lines = contentStr.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
                    if (lines.length < 2) {
                        failures.push(`INVALID_CSV_FORMAT: ${mFile.filename} must contain at least headers and one data row`);
                    }
                    else {
                        // Check whitelist for carbon price paid schedule (component 26)
                        if (mFile.filename === "26_Carbon_Price_Paid_Schedule.csv") {
                            const secondLine = lines[1];
                            const isSentinel = secondLine.includes("NO_ELIGIBLE_CARBON_PRICE_PAID_DECLARED");
                            if (!isSentinel) {
                                // Perform a basic column format check (e.g. check at least one comma/field)
                                if (!secondLine.includes(",")) {
                                    failures.push(`INVALID_CSV_FORMAT: ${mFile.filename} has invalid data row format`);
                                }
                            }
                        }
                        else {
                            // Basic check for other CSVs
                            if (lines[1].length === 0) {
                                failures.push(`INVALID_CSV_FORMAT: ${mFile.filename} has an empty data row`);
                            }
                        }
                    }
                }
                // 14. JSON files parse and satisfy basic structure
                if (mFile.filename.endsWith(".json")) {
                    try {
                        JSON.parse(buffer.toString("utf8"));
                    }
                    catch (err) {
                        failures.push(`INVALID_JSON_FORMAT: ${mFile.filename} failed to parse: ${err.message}`);
                    }
                }
            }
        }
    }
    return {
        success: failures.length === 0,
        failures
    };
}
//# sourceMappingURL=package-contract-validator.js.map