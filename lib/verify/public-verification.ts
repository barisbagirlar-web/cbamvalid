/**
 * FAZ 10 — Public package verification payload.
 *
 * Pure mapping from a sealed release record (sealed_reports / cbam_reports
 * documents) to the public verification view. Only integrity and release
 * metadata are exposed; no customer, case, entitlement, or calculation data
 * ever crosses the public boundary.
 */

export type PublicVerificationPayload = {
  packageId: string;
  reportId: string;
  status: "SEALED" | "SUPERSEDED" | "REVOKED" | "UNKNOWN";
  releaseVersion: number;
  generatedAt: string;
  manifestHash: string;
  packageHash: string;
  kmsKeyVersion: string;
  kmsAlgorithm: string;
  signatureVerificationState: "VALID" | "UNSIGNED";
  componentCount: number;
  isCurrentRelease: boolean;
  publicVerificationState: "ACTIVE" | "SUPERSEDED" | "REVOKED" | "UNAVAILABLE";
  disclaimer: string;
};

export const PUBLIC_VERIFICATION_DISCLAIMER =
  "Integrity and seal metadata only. Not an accredited verification opinion.";

type RawRow = Record<string, unknown>;

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function hashOrEmpty(value: unknown): string {
  const text = asString(value);
  return text && /^[a-f0-9]{64}$/i.test(text) ? text : "";
}

/**
 * Build the public payload from the cryptographic seal row and the optional
 * report lifecycle row. Missing values map to empty strings rather than
 * placeholder text; the UI shows them only as absence of data.
 */
export function buildPublicVerificationPayload(params: {
  packageId: string;
  sealRow?: RawRow | null;
  reportRow?: RawRow | null;
}): PublicVerificationPayload {
  const { packageId } = params;
  const seal = params.sealRow || {};
  const report = params.reportRow || {};

  const sealTimestamp = asString(seal.issuedAt) || asString(seal.createdAt) || asString(seal.updatedAt);
  const reportTimestamp = asString(report.createdAt) || asString(report.updatedAt);

  const storedStatus = asString(report.status);
  const lifecycleStatus: PublicVerificationPayload["status"] =
    storedStatus === "SUPERSEDED"
      ? "SUPERSEDED"
      : storedStatus === "REVOKED"
        ? "REVOKED"
        : asString(report.publicVerificationState) === "SUPERSEDED"
          ? "SUPERSEDED"
          : storedStatus === "SEALED" || asString(report.documentHash) || asString(seal.documentHash)
            ? "SEALED"
            : "UNKNOWN";

  const publicState: PublicVerificationPayload["publicVerificationState"] =
    lifecycleStatus === "SUPERSEDED"
      ? "SUPERSEDED"
      : lifecycleStatus === "REVOKED"
        ? "REVOKED"
        : sealTimestamp
          ? "ACTIVE"
          : "UNAVAILABLE";

  const manifestHash = hashOrEmpty(seal.manifestHash) || hashOrEmpty(report.manifestHash);
  const packageHash = hashOrEmpty(seal.packageHash) || hashOrEmpty(report.packageHash);
  const signatureBase64 = asString(seal.signatureBase64) || asString(report.signatureBase64);

  const packageMetadata = report.packageMetadata as RawRow | undefined;
  const componentCount =
    asNumber(packageMetadata?.actualTopLevelComponentCount) ??
    asNumber(packageMetadata?.manifestFileCount) ??
    asNumber(seal.componentCount) ??
    0;

  const reportId = asString(seal.reportId) || asString(report.reportId) || "";
  const releaseVersion =
    asNumber(seal.releaseVersion) ?? asNumber(report.releaseVersion) ?? (reportId ? 1 : 0);

  return {
    packageId,
    reportId,
    status: lifecycleStatus,
    releaseVersion,
    generatedAt: sealTimestamp || reportTimestamp || "",
    manifestHash,
    packageHash,
    kmsKeyVersion: asString(seal.kmsKeyVersion) || asString(report.kmsKeyVersion) || "",
    kmsAlgorithm: asString(seal.kmsAlgorithm) || asString(report.kmsAlgorithm) || "",
    signatureVerificationState: manifestHash && signatureBase64 ? "VALID" : "UNSIGNED",
    componentCount,
    isCurrentRelease: report.isCurrentRelease === true,
    publicVerificationState: publicState,
    disclaimer: PUBLIC_VERIFICATION_DISCLAIMER,
  };
}
