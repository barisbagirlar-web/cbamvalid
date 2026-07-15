export type LegalSourceType = "REGULATION" | "IMPLEMENTING_ACT" | "DELEGATED_ACT";
export type CbamPeriod = "TRANSITIONAL" | "DEFINITIVE";
export type LegalStatus = "IN_FORCE" | "TRANSITIONAL_ONLY";

export interface LegalSourceRecord {
  id: string;
  type: LegalSourceType;
  celexId: string;
  eliUri: string;
  title: string;
  period: CbamPeriod;
  adoptedDate: string;
  publishedDate: string;
  appliesFrom: string;
  legalStatus: LegalStatus;
  verificationAuthority: "EUR_LEX";
  verifiedAt: string;
  methodologyScope: readonly string[];
}

export const LEGAL_SOURCE_REGISTRY_VERSION = "CBAM-EU-2026.07.16";

/**
 * SHA-256 of the canonical JSON representation of DEFINITIVE_SOURCE_IDS in
 * source-id order with object keys sorted recursively. The verifier-grade guard
 * recomputes this value and fails closed on registry drift.
 */
export const DEFINITIVE_SOURCE_REGISTRY_FINGERPRINT =
  "8463233359d67185a513ca34427861be034b17937b9e7259b01fbf7a30689ffc";

export const OFFICIAL_SOURCES = {
  REG_2023_956: {
    id: "REG_2023_956",
    type: "REGULATION",
    celexId: "32023R0956",
    eliUri: "https://eur-lex.europa.eu/eli/reg/2023/956/oj/eng",
    title:
      "Regulation (EU) 2023/956 of the European Parliament and of the Council of 10 May 2023 establishing a carbon border adjustment mechanism",
    period: "DEFINITIVE",
    adoptedDate: "2023-05-10",
    publishedDate: "2023-05-16",
    appliesFrom: "2023-05-17",
    legalStatus: "IN_FORCE",
    verificationAuthority: "EUR_LEX",
    verifiedAt: "2026-07-16",
    methodologyScope: [
      "CBAM framework",
      "Annex I goods scope",
      "Annex IV embedded-emissions calculation framework",
    ],
  },
  REG_2025_2083: {
    id: "REG_2025_2083",
    type: "REGULATION",
    celexId: "32025R2083",
    eliUri: "https://eur-lex.europa.eu/eli/reg/2025/2083/oj/eng",
    title:
      "Regulation (EU) 2025/2083 of the European Parliament and of the Council of 8 October 2025 amending Regulation (EU) 2023/956 as regards simplifying and strengthening the carbon border adjustment mechanism",
    period: "DEFINITIVE",
    adoptedDate: "2025-10-08",
    publishedDate: "2025-10-17",
    appliesFrom: "2025-10-20",
    legalStatus: "IN_FORCE",
    verificationAuthority: "EUR_LEX",
    verifiedAt: "2026-07-16",
    methodologyScope: [
      "50 tonne annual mass threshold for cement, fertilisers, iron and steel, and aluminium",
      "definitive-period declaration and certificate obligations",
      "actual values require accredited verification",
    ],
  },
  IMPL_2025_2546: {
    id: "IMPL_2025_2546",
    type: "IMPLEMENTING_ACT",
    celexId: "32025R2546",
    eliUri: "https://eur-lex.europa.eu/eli/reg_impl/2025/2546/oj/eng",
    title:
      "Commission Implementing Regulation (EU) 2025/2546 of 10 December 2025 on the application of the principles for verification of declared embedded emissions pursuant to Regulation (EU) 2023/956",
    period: "DEFINITIVE",
    adoptedDate: "2025-12-10",
    publishedDate: "2025-12-22",
    appliesFrom: "2026-01-01",
    legalStatus: "IN_FORCE",
    verificationAuthority: "EUR_LEX",
    verifiedAt: "2026-07-16",
    methodologyScope: [
      "reasonable assurance and risk-based verification",
      "5 percent per-good materiality levels",
      "electronic verification report template",
    ],
  },
  IMPL_2025_2547: {
    id: "IMPL_2025_2547",
    type: "IMPLEMENTING_ACT",
    celexId: "32025R2547",
    eliUri: "https://eur-lex.europa.eu/eli/reg_impl/2025/2547/oj/eng",
    title:
      "Commission Implementing Regulation (EU) 2025/2547 of 10 December 2025 laying down rules for the application of Regulation (EU) 2023/956 as regards the methods for the calculation of emissions embedded in goods",
    period: "DEFINITIVE",
    adoptedDate: "2025-12-10",
    publishedDate: "2025-12-22",
    appliesFrom: "2026-01-01",
    legalStatus: "IN_FORCE",
    verificationAuthority: "EUR_LEX",
    verifiedAt: "2026-07-16",
    methodologyScope: [
      "functional units and production processes",
      "monitoring plan minimum elements",
      "sector-specific system boundaries and embedded-emissions methods",
    ],
  },
  IMPL_2025_2548: {
    id: "IMPL_2025_2548",
    type: "IMPLEMENTING_ACT",
    celexId: "32025R2548",
    eliUri: "https://eur-lex.europa.eu/eli/reg_impl/2025/2548/oj/eng",
    title:
      "Commission Implementing Regulation (EU) 2025/2548 of 10 December 2025 laying down rules for the application of Regulation (EU) 2023/956 as regards the calculation and publication of the price of CBAM certificates",
    period: "DEFINITIVE",
    adoptedDate: "2025-12-10",
    publishedDate: "2025-12-22",
    appliesFrom: "2026-01-01",
    legalStatus: "IN_FORCE",
    verificationAuthority: "EUR_LEX",
    verifiedAt: "2026-07-16",
    methodologyScope: ["calculation and publication of CBAM certificate prices"],
  },
  DEL_2025_2551: {
    id: "DEL_2025_2551",
    type: "DELEGATED_ACT",
    celexId: "32025R2551",
    eliUri: "https://eur-lex.europa.eu/eli/reg_del/2025/2551/oj/eng",
    title:
      "Commission Delegated Regulation (EU) 2025/2551 of 20 November 2025 supplementing Regulation (EU) 2023/956 by specifying the conditions for granting accreditation to verifiers, for the control and oversight of accredited verifiers, for the withdrawal of accreditation and for mutual recognition and peer evaluation of accreditation bodies",
    period: "DEFINITIVE",
    adoptedDate: "2025-11-20",
    publishedDate: "2025-12-22",
    appliesFrom: "2026-01-01",
    legalStatus: "IN_FORCE",
    verificationAuthority: "EUR_LEX",
    verifiedAt: "2026-07-16",
    methodologyScope: [
      "accreditation and competence of verifiers",
      "verification planning, evidence and site-visit framework",
      "oversight and independence",
    ],
  },
  IMPL_2023_1773: {
    id: "IMPL_2023_1773",
    type: "IMPLEMENTING_ACT",
    celexId: "32023R1773",
    eliUri: "https://eur-lex.europa.eu/eli/reg_impl/2023/1773/oj/eng",
    title:
      "Commission Implementing Regulation (EU) 2023/1773 of 17 August 2023 laying down the rules for CBAM reporting obligations during the transitional period",
    period: "TRANSITIONAL",
    adoptedDate: "2023-08-17",
    publishedDate: "2023-09-15",
    appliesFrom: "2023-10-01",
    legalStatus: "TRANSITIONAL_ONLY",
    verificationAuthority: "EUR_LEX",
    verifiedAt: "2026-07-16",
    methodologyScope: ["transitional reporting methodology through 31 December 2025"],
  },
} as const satisfies Record<string, LegalSourceRecord>;

export const DEFINITIVE_SOURCE_IDS = [
  "REG_2023_956",
  "REG_2025_2083",
  "IMPL_2025_2546",
  "IMPL_2025_2547",
  "IMPL_2025_2548",
  "DEL_2025_2551",
] as const;

export type OfficialSourceId = keyof typeof OFFICIAL_SOURCES;
export type DefinitiveSourceId = (typeof DEFINITIVE_SOURCE_IDS)[number];

export function getDefinitiveLegalSources(): readonly LegalSourceRecord[] {
  return DEFINITIVE_SOURCE_IDS.map((id) => OFFICIAL_SOURCES[id]);
}
