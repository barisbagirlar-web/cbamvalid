/**
 * Public identity emails / entity names.
 * Registration, VAT, street address: see lib/legal-identity.ts (null until proven).
 */
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

  organizationLegalName: "SectorCalc Corporation",
  organizationDisplayName: "CBAMValid",
  organizationUrl: "https://cbamvalid.com",
  organizationEmail: "info@cbamvalid.com",
  /** Null until owner-verified — never invent street/CRO/VAT for public pages. */
  organizationAddress: null as string | null,
  organizationCountry: "Ireland",
  organizationRegistrationNumber: null as string | null,
  organizationTaxId: null as string | null,

  socialProfiles: [] as string[],

  regulatoryReviewDate: "2026-07-28",
  releaseVersion: "1.1.0",

  supportEmail: "info@cbamvalid.com",
  privacyEmail: "privacy@cbamvalid.com",
  legalEmail: "info@cbamvalid.com",
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
