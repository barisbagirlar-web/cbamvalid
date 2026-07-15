import { siteConfig } from "./site-config";

export const legalConfig = {
  legalEntityName: siteConfig.organizationLegalName,
  tradingName: siteConfig.organizationDisplayName,
  registrationNumber: siteConfig.organizationRegistrationNumber,
  taxId: siteConfig.organizationTaxId,
  registeredAddress: siteConfig.organizationAddress,
  country: siteConfig.organizationCountry,
  supportEmail: siteConfig.supportEmail,
  privacyEmail: siteConfig.privacyEmail,
  legalEmail: siteConfig.legalEmail,
  websiteUrl: siteConfig.organizationUrl,
  lastUpdatedDate: "2026-07-01",
  governingLaw: "the laws of the relevant jurisdiction",
  legalContactEmail: siteConfig.legalEmail,
  privacyContactEmail: siteConfig.privacyEmail,
  vatIdentifier: siteConfig.organizationTaxId,
};
