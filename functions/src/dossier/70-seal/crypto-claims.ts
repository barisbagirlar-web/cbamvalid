/**
 * Derive printable crypto claims from KMS key metadata — never hardcode FIPS level.
 */
export type KmsProtectionLevel = "SOFTWARE" | "HSM" | "EXTERNAL" | "UNKNOWN";

export interface CryptoClaimSet {
  readonly securityClassLabel: string;
  readonly integrityWording: string;
  readonly mayClaimFipsLevel3: boolean;
  readonly publicVerificationState: "ACTIVE" | "UNAVAILABLE";
  readonly publicVerificationUrl: string | null;
}

export function deriveSecurityClass(protectionLevel: KmsProtectionLevel | string | null | undefined): {
  label: string;
  mayClaimFipsLevel3: boolean;
} {
  const level = String(protectionLevel || "UNKNOWN").toUpperCase();
  if (level === "HSM") {
    return { label: "FIPS 140-2 Level 3 (Cloud HSM)", mayClaimFipsLevel3: true };
  }
  if (level === "SOFTWARE") {
    return {
      label: "FIPS 140-2 Level 1 (software-protected key)",
      mayClaimFipsLevel3: false,
    };
  }
  if (level === "EXTERNAL") {
    return {
      label: `KMS protectionLevel=${level} (FIPS class not asserted)`,
      mayClaimFipsLevel3: false,
    };
  }
  return {
    label: protectionLevel
      ? `KMS protectionLevel=${protectionLevel} (FIPS class unresolved)`
      : "KMS protection level unresolved — no FIPS claim",
    mayClaimFipsLevel3: false,
  };
}

export function integrityManifestWording(componentCount: number): string {
  return (
    `The integrity manifest binds the SHA-256 digest of all ${componentCount} controlled components. ` +
    "The manifest itself is sealed with a detached KMS signature. " +
    "Verifying the manifest signature and re-hashing the components establishes the integrity of the complete package."
  );
}

export function buildCryptoClaims(params: {
  protectionLevel: KmsProtectionLevel | string | null | undefined;
  componentCount: number;
  publicVerificationUrl?: string | null;
}): CryptoClaimSet {
  const security = deriveSecurityClass(params.protectionLevel);
  const url = params.publicVerificationUrl?.trim() || null;
  return {
    securityClassLabel: security.label,
    integrityWording: integrityManifestWording(params.componentCount),
    mayClaimFipsLevel3: security.mayClaimFipsLevel3,
    publicVerificationState: url ? "ACTIVE" : "UNAVAILABLE",
    publicVerificationUrl: url,
  };
}
