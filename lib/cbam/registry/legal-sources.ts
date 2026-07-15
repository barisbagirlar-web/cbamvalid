export type LegalSourceType = "REGULATION" | "IMPLEMENTING_ACT" | "DELEGATED_ACT" | "GUIDANCE_DOCUMENT";
export type CbamPeriod = "TRANSITIONAL" | "DEFINITIVE";
export type LegalStatus = "IN_FORCE" | "TRANSITIONAL_ONLY";

export interface LegalSourceRecord {
  id: string;
  type: LegalSourceType;
  celexId: string;
  eliUri: string;
  title: string;
  period: CbamPeriod;
  effectiveDate: string;
  legalStatus: LegalStatus;
  verificationAuthority: "EUR_LEX" | "EU_COMMISSION";
  verifiedAt: string;
}

export const LEGAL_SOURCE_REGISTRY_VERSION = "CBAM-EU-2026.07.16";
export const DEFINITIVE_SOURCE_REGISTRY_FINGERPRINT = "d608779de117e86155048bfea41e22c84ed8376101555eb0c298f6bb5ccb1fb8";

export const OFFICIAL_SOURCES = {
  REG_2023_956: {
    id: "REG_2023_956",
    type: "REGULATION",
    celexId: "32023R0956",
    eliUri: "https://eur-lex.europa.eu/eli/reg/2023/956/oj",
    title: "Regulation (EU) 2023/956 establishing a carbon border adjustment mechanism",
    period: "DEFINITIVE",
    effectiveDate: "2023-05-17",
    legalStatus: "IN_FORCE",
    verificationAuthority: "EUR_LEX",
    verifiedAt: "2026-07-16",
  },
  REG_2025_2083: {
    id: "REG_2025_2083",
    type: "REGULATION",
    celexId: "32025R2083",
    eliUri: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ:L_202502083",
    title: "Regulation (EU) 2025/2083 simplifying and strengthening the CBAM",
    period: "DEFINITIVE",
    effectiveDate: "2025-10-20",
    legalStatus: "IN_FORCE",
    verificationAuthority: "EUR_LEX",
    verifiedAt: "2026-07-16",
  },
  IMPL_2023_1773: {
    id: "IMPL_2023_1773",
    type: "IMPLEMENTING_ACT",
    celexId: "32023R1773",
    eliUri: "https://eur-lex.europa.eu/eli/reg_impl/2023/1773/oj",
    title: "Commission Implementing Regulation (EU) 2023/1773 for the transitional phase",
    period: "TRANSITIONAL",
    effectiveDate: "2023-10-01",
    legalStatus: "TRANSITIONAL_ONLY",
    verificationAuthority: "EUR_LEX",
    verifiedAt: "2026-07-16",
  },
  IMPL_2025_2546: {
    id: "IMPL_2025_2546",
    type: "IMPLEMENTING_ACT",
    celexId: "32025R2546",
    eliUri: "https://eur-lex.europa.eu/eli/reg_impl/2025/2546/oj",
    title: "Commission Implementing Regulation (EU) 2025/2546 on verification of declared embedded emissions",
    period: "DEFINITIVE",
    effectiveDate: "2026-01-01",
    legalStatus: "IN_FORCE",
    verificationAuthority: "EUR_LEX",
    verifiedAt: "2026-07-16",
  },
  IMPL_2025_2547: {
    id: "IMPL_2025_2547",
    type: "IMPLEMENTING_ACT",
    celexId: "32025R2547",
    eliUri: "https://eur-lex.europa.eu/eli/reg_impl/2025/2547/oj",
    title: "Commission Implementing Regulation (EU) 2025/2547 on methods for calculating emissions embedded in goods",
    period: "DEFINITIVE",
    effectiveDate: "2026-01-01",
    legalStatus: "IN_FORCE",
    verificationAuthority: "EUR_LEX",
    verifiedAt: "2026-07-16",
  },
  IMPL_2025_2548: {
    id: "IMPL_2025_2548",
    type: "IMPLEMENTING_ACT",
    celexId: "32025R2548",
    eliUri: "https://eur-lex.europa.eu/eli/reg_impl/2025/2548/oj",
    title: "Commission Implementing Regulation (EU) 2025/2548 on calculation and publication of CBAM certificate prices",
    period: "DEFINITIVE",
    effectiveDate: "2026-01-01",
    legalStatus: "IN_FORCE",
    verificationAuthority: "EUR_LEX",
    verifiedAt: "2026-07-16",
  },
  IMPL_2025_2620: {
    id: "IMPL_2025_2620",
    type: "IMPLEMENTING_ACT",
    celexId: "32025R2620",
    eliUri: "https://eur-lex.europa.eu/eli/reg_impl/2025/2620/oj",
    title: "Commission Implementing Regulation (EU) 2025/2620 on the free allocation adjustment",
    period: "DEFINITIVE",
    effectiveDate: "2026-01-01",
    legalStatus: "IN_FORCE",
    verificationAuthority: "EUR_LEX",
    verifiedAt: "2026-07-16",
  },
  IMPL_2025_2621: {
    id: "IMPL_2025_2621",
    type: "IMPLEMENTING_ACT",
    celexId: "32025R2621",
    eliUri: "https://eur-lex.europa.eu/eli/reg_impl/2025/2621/oj",
    title: "Commission Implementing Regulation (EU) 2025/2621 establishing definitive-period default values",
    period: "DEFINITIVE",
    effectiveDate: "2026-01-01",
    legalStatus: "IN_FORCE",
    verificationAuthority: "EUR_LEX",
    verifiedAt: "2026-07-16",
  },
  DEL_2025_2551: {
    id: "DEL_2025_2551",
    type: "DELEGATED_ACT",
    celexId: "32025R2551",
    eliUri: "https://eur-lex.europa.eu/eli/reg_del/2025/2551/oj",
    title: "Commission Delegated Regulation (EU) 2025/2551 on accreditation and oversight of CBAM verifiers",
    period: "DEFINITIVE",
    effectiveDate: "2026-01-01",
    legalStatus: "IN_FORCE",
    verificationAuthority: "EUR_LEX",
    verifiedAt: "2026-07-16",
  },
} as const satisfies Record<string, LegalSourceRecord>;

export const DEFINITIVE_SOURCE_IDS = [
  "REG_2023_956",
  "REG_2025_2083",
  "IMPL_2025_2546",
  "IMPL_2025_2547",
  "IMPL_2025_2548",
  "IMPL_2025_2620",
  "IMPL_2025_2621",
  "DEL_2025_2551",
] as const;

export type OfficialSourceId = keyof typeof OFFICIAL_SOURCES;
