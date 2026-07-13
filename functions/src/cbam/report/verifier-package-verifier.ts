import crypto from "crypto";
import JSZip from "jszip";
import {
  DataIntegrityManifest,
  REQUIRED_TOP_LEVEL_COMPONENTS,
} from "./verifier-package-builder";

function sha256(value: Buffer | string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export interface VerifierPackageVerification {
  manifest: DataIntegrityManifest;
  manifestHash: string;
  topLevelComponentCount: number;
  verifiedFileCount: number;
}

/**
 * Independently verifies a generated package from its ZIP bytes.
 * It does not trust the in-memory build result: every manifest-listed file is
 * loaded from the archive and checked for exact byte size and SHA-256 hash.
 */
export async function verifyVerifierPreparationPackage(
  zipBuffer: Buffer
): Promise<VerifierPackageVerification> {
  const zip = await JSZip.loadAsync(zipBuffer, { checkCRC32: true });
  const manifestEntry = zip.file("22_Data_Integrity_Manifest.json");
  if (!manifestEntry) throw new Error("VERIFIER_PACKAGE_MANIFEST_MISSING");

  const manifestBytes = await manifestEntry.async("nodebuffer");
  let manifest: DataIntegrityManifest;
  try {
    manifest = JSON.parse(manifestBytes.toString("utf8")) as DataIntegrityManifest;
  } catch {
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

  for (const required of REQUIRED_TOP_LEVEL_COMPONENTS) {
    if (required.endsWith("/")) {
      const prefixExists = Object.keys(zip.files).some((name) => name.startsWith(required));
      if (!prefixExists) throw new Error(`VERIFIER_PACKAGE_COMPONENT_MISSING:${required}`);
    } else if (!zip.file(required)) {
      throw new Error(`VERIFIER_PACKAGE_COMPONENT_MISSING:${required}`);
    }
  }

  const seen = new Set<string>();
  for (const file of manifest.files) {
    if (seen.has(file.filename)) {
      throw new Error(`VERIFIER_PACKAGE_MANIFEST_DUPLICATE_FILE:${file.filename}`);
    }
    seen.add(file.filename);

    const entry = zip.file(file.filename);
    if (!entry) throw new Error(`VERIFIER_PACKAGE_FILE_MISSING:${file.filename}`);
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
