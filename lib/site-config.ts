/**
 * Public identity emails / entity names.
 * Registration, VAT, street address: see lib/legal-identity.ts (SSOT).
 */
import { LEGAL_IDENTITY } from "./legal-identity";

export const siteConfig = {
  siteName: "CBAMValid",
  canonicalOrigin: "https://cbamvalid.com",
  locale: "en",
  defaultTitle: "CBAMValid — CBAM Evidence Validation and Report Preparation",
  titleTemplate: "%s | CBAMValid",
  defaultDescription:
    "Prepare structured exporter evidence, identify documentation gaps, calculate embedded emissions, and generate auditable CBAM preparation dossiers.",
  logoUrl: "https://cbamvalid.com/logo.png",
  ogImage: "https://cbamvalid.com/og.jpg",

  organizationLegalName: LEGAL_IDENTITY.legalEntityName,
  organizationDisplayName: LEGAL_IDENTITY.tradingName,
  organizationUrl: "https://cbamvalid.com",
  organizationEmail: LEGAL_IDENTITY.supportEmail,
  organizationAddress: LEGAL_IDENTITY.registeredAddress,
  organizationCountry: LEGAL_IDENTITY.country ?? "Ireland",
  organizationRegistrationNumber: LEGAL_IDENTITY.companyRegistrationNumber,
  organizationTaxId: LEGAL_IDENTITY.vatId,

  socialProfiles: [] as string[],

  regulatoryReviewDate: "2026-07-28",
  releaseVersion: "1.1.0",

  supportEmail: LEGAL_IDENTITY.supportEmail,
  privacyEmail: LEGAL_IDENTITY.privacyEmail,
  legalEmail: LEGAL_IDENTITY.supportEmail,
};

export const SITE_CONFIG = {
  name: "CBAMValid",
  domain: "cbamvalid.com",
  supportEmail: "info@cbamvalid.com",
  logo: {
    lockup: "/brand/cbamvalid-lockup.svg",
    mark: "/brand/cbamvalid-mark.svg",
  },
} as const;
