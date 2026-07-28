/**
 * Public legal identity SSOT.
 * T1.3 / H2: never publish placeholder CRO, VAT, street, or phone.
 * Publish the identity block only when every required field is proven.
 */
import { siteConfig } from "@/lib/site-config";

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

/**
 * Proven fields only. Null = not yet owner-verified — must not appear in public UI.
 * Replace nulls with real CRO / VAT / address / phone when owner supplies evidence.
 */
export const LEGAL_IDENTITY: LegalIdentityRecord = {
  legalEntityName: "SectorCalc Corporation",
  tradingName: "CBAMValid",
  registeredAddress: null,
  country: "Ireland",
  companyRegistrationNumber: null,
  vatId: null,
  dataProtectionContact: null,
  privacyEmail: "privacy@cbamvalid.com",
  supportPhone: null,
  supportEmail: siteConfig.supportEmail,
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
