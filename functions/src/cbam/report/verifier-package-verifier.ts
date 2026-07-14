import crypto from "crypto";
import JSZip from "jszip";
import {
  DataIntegrityManifest,
} from "./verifier-package-builder";
import { validatePackageContract } from "./package-contract-validator";

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
  if (manifest.topLevelComponentCount !== 27) {
    throw new Error("VERIFIER_PACKAGE_COMPONENT_COUNT_INVALID");
  }
  if (manifest.reportQualityAssessment.status !== "PASS") {
    throw new Error("VERIFIER_PACKAGE_REPORT_QUALITY_NOT_PASS");
  }

  const validation = await validatePackageContract(zipBuffer, manifest);
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

