import crypto from "node:crypto";
import { z } from "zod";

/** Human package label: one Latin letter + four digits (e.g. Y7654). */
export const PACKAGE_CODE_PATTERN = /^[A-Z][0-9]{4}$/;
export const PackageCodeSchema = z.string().regex(PACKAGE_CODE_PATTERN, "Invalid package code");
export type PackageCode = z.infer<typeof PackageCodeSchema>;

function digestHex(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

export function derivePackageCodeCandidate(digestOrReportId: string, attempt = 0): PackageCode {
  const digest = digestOrReportId.replace(/^report_/, "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error("PACKAGE_CODE_DIGEST_INVALID");
  const material = digestHex(`${digest}\u0000package-code\u0000${attempt}`);
  const letter = String.fromCharCode(65 + (parseInt(material.slice(0, 2), 16) % 26));
  const digits = String(parseInt(material.slice(2, 8), 16) % 10000).padStart(4, "0");
  return PackageCodeSchema.parse(`${letter}${digits}`);
}

export function resolvePackageCode(params: {
  packageCode?: string | null;
  reportId: string;
}): PackageCode {
  if (typeof params.packageCode === "string" && PACKAGE_CODE_PATTERN.test(params.packageCode)) {
    return params.packageCode;
  }
  return derivePackageCodeCandidate(params.reportId, 0);
}
