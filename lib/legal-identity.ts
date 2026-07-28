/**
 * Public legal identity SSOT.
 * T1.3 / H2: never publish placeholder CRO, VAT, street, or phone.
 * Publish the identity block only when every required field is proven.
 *
 * Owner-verified 2026-07-28. Env overrides still win when set:
 *   LEGAL_CRO · LEGAL_VAT · LEGAL_REGISTERED_ADDRESS · LEGAL_SUPPORT_PHONE · LEGAL_DPO
 * Optional: LEGAL_COUNTRY (default Ireland)
 */

export type LegalIdentityField =
  | "legalEntityName"
  | "tradingName"
  | "registeredAddress"
  | "country"
  | "companyRegistrationNumber"
  | "vatId"
  | "dataProtectionContact"
  | "privacyEmail"
  | "supportPhone"
  | "supportEmail";

export interface LegalIdentityRecord {
  legalEntityName: string;
  tradingName: string;
  registeredAddress: string | null;
  country: string | null;
  companyRegistrationNumber: string | null;
  vatId: string | null;
  dataProtectionContact: string | null;
  privacyEmail: string;
  supportPhone: string | null;
  supportEmail: string;
}

function envOrNull(key: string): string | null {
  const raw = process.env[key];
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/^["']|["']$/g, "");
  return trimmed.length > 0 ? trimmed : null;
}

function provenOrEnv(envKey: string, proven: string): string {
  return envOrNull(envKey) ?? proven;
}

/**
 * Owner-verified public identity (2026-07-28).
 * Env overrides win for emergency corrections without a code change.
 */
export const LEGAL_IDENTITY: LegalIdentityRecord = {
  legalEntityName: "SectorCalc Corporation",
  tradingName: "CBAMValid",
  registeredAddress: provenOrEnv(
    "LEGAL_REGISTERED_ADDRESS",
    "4th Floor, One Burlington Plaza, Burlington Road, Dublin 4, Ireland"
  ),
  country: envOrNull("LEGAL_COUNTRY") ?? "Ireland",
  companyRegistrationNumber: provenOrEnv("LEGAL_CRO", "315881"),
  vatId: provenOrEnv("LEGAL_VAT", "IE1857162AB"),
  dataProtectionContact: provenOrEnv(
    "LEGAL_DPO",
    "Siobhan O'Connor, Data Protection Officer <info@cbamvalid.com>"
  ),
  privacyEmail: "privacy@cbamvalid.com",
  supportPhone: provenOrEnv("LEGAL_SUPPORT_PHONE", "+353 (0)1 676 2671"),
  supportEmail: "info@cbamvalid.com",
};

const REQUIRED_FOR_FULL_BLOCK: readonly LegalIdentityField[] = [
  "legalEntityName",
  "registeredAddress",
  "country",
  "companyRegistrationNumber",
  "vatId",
  "dataProtectionContact",
  "privacyEmail",
  "supportPhone",
  "supportEmail",
] as const;

export function isLegalIdentityComplete(identity: LegalIdentityRecord = LEGAL_IDENTITY): boolean {
  return REQUIRED_FOR_FULL_BLOCK.every((key) => {
    const value = identity[key];
    return typeof value === "string" && value.trim().length > 0;
  });
}

/** Footer / legal pages: full T1.3 block only when complete; otherwise minimal proven contacts. */
export function getPublicLegalIdentityLines(
  identity: LegalIdentityRecord = LEGAL_IDENTITY
): { mode: "full" | "minimal"; lines: string[] } {
  if (isLegalIdentityComplete(identity)) {
    return {
      mode: "full",
      lines: [
        `${identity.legalEntityName} (${identity.tradingName})`,
        `${identity.registeredAddress} · ${identity.country}`,
        `Company Registration No: ${identity.companyRegistrationNumber}`,
        `VAT ID: ${identity.vatId}`,
        `Data protection contact: ${identity.dataProtectionContact} · ${identity.privacyEmail}`,
        `Support: ${identity.supportPhone} · ${identity.supportEmail}`,
      ],
    };
  }

  return {
    mode: "minimal",
    lines: [
      `${identity.legalEntityName} (${identity.tradingName})`,
      identity.country ? `Jurisdiction: ${identity.country}` : "",
      `Support: ${identity.supportEmail}`,
      `Privacy: ${identity.privacyEmail}`,
      "Full company registration, VAT, and registered address will be published here when verified — half-identity blocks are not shown.",
    ].filter(Boolean),
  };
}
