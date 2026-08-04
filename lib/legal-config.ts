import { siteConfig } from "./site-config";
import { LEGAL_IDENTITY, getPublicLegalIdentityLines } from "./legal-identity";

export const legalConfig = {
  legalEntityName: LEGAL_IDENTITY.legalEntityName,
  tradingName: LEGAL_IDENTITY.tradingName,
  registrationNumber: LEGAL_IDENTITY.companyRegistrationNumber,
  taxId: LEGAL_IDENTITY.vatId,
  registeredAddress: LEGAL_IDENTITY.registeredAddress,
  country: LEGAL_IDENTITY.country,
  supportEmail: LEGAL_IDENTITY.supportEmail,
  privacyEmail: LEGAL_IDENTITY.privacyEmail,
  legalEmail: siteConfig.legalEmail,
  websiteUrl: siteConfig.organizationUrl,
  lastUpdatedDate: "2026-08-04",
  governingLaw: "Ireland",
  legalContactEmail: siteConfig.legalEmail,
  privacyContactEmail: LEGAL_IDENTITY.privacyEmail,
  vatIdentifier: LEGAL_IDENTITY.vatId,
  supportPhone: LEGAL_IDENTITY.supportPhone,
  dataProtectionContact: LEGAL_IDENTITY.dataProtectionContact,
  identityPublication: getPublicLegalIdentityLines(),
};
