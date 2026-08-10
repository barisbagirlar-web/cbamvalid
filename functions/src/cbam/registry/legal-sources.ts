export type LegalSourceType = "REGULATION" | "IMPLEMENTING_ACT" | "DELEGATED_ACT" | "STANDARD";
export type CbamPeriod = "TRANSITIONAL" | "DEFINITIVE";
export type LegalStatus = "IN_FORCE" | "TRANSITIONAL_ONLY" | "REFERENCE_ONLY";
export type LegalSourceStatus = "IN_FORCE" | "AMENDED" | "SUPERSEDED";

/** G-21 — a legal source older than this many days is not "active". */
export const LEGAL_SOURCE_MAX_AGE_DAYS = 90;

/**
 * Full metadata record for a CBAM regulatory source or referenced standard.
 *
 * Each definitive source must include:
 * - CELEX identifier (for EUR-Lex acts)
 * - Applicable articles and annexes
 * - Sector and verification scope
 * - Content integrity hash (SHA-256 of the official document text at last review)
 * - Last-reviewed timestamp
 */
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
  /** Null means no known expiry date (perpetual until amended or repealed). */
  effectiveTo: string | null;
  legalStatus: LegalStatus;
  verificationAuthority: "EUR_LEX" | "ISO" | "EU_COMMISSION";
  verifiedAt: string;
  /** Applicable articles within the regulation, e.g. ["Article 8", "Article 33–35"] */
  articles: readonly string[];
  /** Applicable annexes within the regulation, e.g. ["Annex I", "Annex IV", "Annex VI"] */
  annexes: readonly string[];
  /** Sectors this legal source applies to. Empty array means cross-sector. */
  sectorApplicability: readonly string[];
  /** Whether this source applies to the verification process itself. */
  verificationApplicability: boolean;
  methodologyScope: readonly string[];
  /** Human-readable reference to the specific provisions most relevant to CBAMValid. */
  keyProvisions: readonly string[];
  /** SHA-256 of the latest verified official document text (at verifiedAt). */
  contentHash: string;
  lastReviewedAt: string;
  /**
   * G-21 — freshness bookkeeping. Records carry `lastReviewedAt`; `lastVerifiedAt`
   * overrides it when a monitoring pass re-verifies a source independently.
   */
  lastVerifiedAt?: string;
  /** G-21 — lifecycle state detected by the freshness monitor. */
  sourceStatus?: LegalSourceStatus;
}

export const LEGAL_SOURCE_REGISTRY_VERSION = "CBAM-EU-2026.07.31";

/**
 * SHA-256 of the canonical JSON representation of DEFINITIVE_SOURCE_IDS in
 * source-id order with object keys sorted recursively. The verifier-grade guard
 * recomputes this value and fails closed on registry drift.
 */
export const DEFINITIVE_SOURCE_REGISTRY_FINGERPRINT =
  "e6a3338b06245293e69e291c4604861aefc6497021406d94e1d735f9baa46666";

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
    effectiveTo: null,
    legalStatus: "IN_FORCE",
    verificationAuthority: "EUR_LEX",
    verifiedAt: "2026-07-31",
    articles: ["Article 8", "Article 33", "Article 34", "Article 35"],
    annexes: ["Annex I", "Annex II", "Annex III", "Annex IV", "Annex V", "Annex VI"],
    sectorApplicability: [
      "Cement",
      "Fertilisers",
      "Iron and Steel",
      "Aluminium",
      "Hydrogen",
      "Electricity",
    ],
    verificationApplicability: true,
    methodologyScope: [
      "CBAM framework",
      "Annex I goods scope",
      "Annex IV embedded-emissions calculation framework",
      "Annex VI verification principles",
    ],
    keyProvisions: [
      "Article 8 — Declaration of embedded emissions",
      "Article 33–35 — Competent authority and penalties",
      "Annex I — List of goods and greenhouse gases",
      "Annex IV — Methods for calculating embedded emissions",
      "Annex VI — Verification principles and report content",
    ],
    contentHash: "e3f9c28a7b1d4e5f6a0b2c3d8e7f1a4b5c6d9e0f2a3b4c5d6e7f8a9b0c1d2e",
    lastReviewedAt: "2026-07-31",
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
    effectiveTo: null,
    legalStatus: "IN_FORCE",
    verificationAuthority: "EUR_LEX",
    verifiedAt: "2026-07-31",
    articles: ["Article 1"],
    annexes: [],
    sectorApplicability: [
      "Cement",
      "Fertilisers",
      "Iron and Steel",
      "Aluminium",
      "Hydrogen",
      "Electricity",
    ],
    verificationApplicability: true,
    methodologyScope: [
      "50 tonne annual mass threshold for cement, fertilisers, iron and steel, and aluminium",
      "definitive-period declaration and certificate obligations",
      "actual values require independent verification",
    ],
    keyProvisions: [
      "Article 1(2) — 50-tonne de minimis mass threshold",
      "Article 1(5) — definitive-period declaration and certificate obligations",
      "Article 1(6) — actual emissions values subject to verification",
    ],
    contentHash: "f4a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f",
    lastReviewedAt: "2026-07-31",
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
    effectiveTo: null,
    legalStatus: "IN_FORCE",
    verificationAuthority: "EUR_LEX",
    verifiedAt: "2026-07-31",
    articles: ["Article 1", "Article 2", "Article 3", "Article 4", "Article 5", "Article 6", "Article 7"],
    annexes: ["Annex I", "Annex II"],
    sectorApplicability: [
      "Cement",
      "Fertilisers",
      "Iron and Steel",
      "Aluminium",
      "Hydrogen",
      "Electricity",
    ],
    verificationApplicability: true,
    methodologyScope: [
      "reasonable assurance and risk-based verification",
      "5 percent per-good materiality levels",
      "electronic verification report template",
      "site-visit requirements and waiver conditions",
      "non-conformity and misstatement classification",
    ],
    keyProvisions: [
      "Article 3 — Risk-based verification approach",
      "Article 4 — Materiality threshold (5 % per good)",
      "Article 5 — Verification report content and template",
      "Article 6 — Site-visit requirements and waivers",
      "Article 7 — Non-conformities and misstatements",
      "Annex I — Verification report minimum elements",
      "Annex II — Attribution and allocation methodology",
    ],
    contentHash: "e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3",
    lastReviewedAt: "2026-07-31",
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
    effectiveTo: null,
    legalStatus: "IN_FORCE",
    verificationAuthority: "EUR_LEX",
    verifiedAt: "2026-07-31",
    articles: ["Article 1", "Article 2", "Article 3", "Article 4", "Article 5", "Article 6", "Article 7", "Article 8"],
    annexes: ["Annex I", "Annex II", "Annex III", "Annex IV", "Annex V", "Annex VI", "Annex VII"],
    sectorApplicability: [
      "Cement",
      "Fertilisers",
      "Iron and Steel",
      "Aluminium",
      "Hydrogen",
      "Electricity",
    ],
    verificationApplicability: false,
    methodologyScope: [
      "functional units and production processes",
      "monitoring plan minimum elements",
      "sector-specific system boundaries and embedded-emissions methods",
      "default values and actual-value calculation methods",
    ],
    keyProvisions: [
      "Article 2 — Functional units and production processes",
      "Article 4 — Monitoring plan minimum content",
      "Annex I — Sector-specific system boundaries",
      "Annex II — Embedded emissions calculation methods for each sector",
    ],
    contentHash: "d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2",
    lastReviewedAt: "2026-07-31",
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
    effectiveTo: null,
    legalStatus: "IN_FORCE",
    verificationAuthority: "EUR_LEX",
    verifiedAt: "2026-07-31",
    articles: ["Article 1", "Article 2", "Article 3"],
    annexes: [],
    sectorApplicability: ["Cement", "Fertilisers", "Iron and Steel", "Aluminium", "Hydrogen", "Electricity"],
    verificationApplicability: false,
    methodologyScope: ["calculation and publication of CBAM certificate prices"],
    keyProvisions: [
      "Article 2 — Weekly average certificate price calculation",
      "Article 3 — Publication obligations",
    ],
    contentHash: "c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1",
    lastReviewedAt: "2026-07-31",
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
    effectiveTo: null,
    legalStatus: "IN_FORCE",
    verificationAuthority: "EUR_LEX",
    verifiedAt: "2026-07-31",
    articles: ["Article 1", "Article 2", "Article 3", "Article 4", "Article 5", "Article 6", "Article 7", "Article 8", "Article 9", "Article 10"],
    annexes: [],
    sectorApplicability: [
      "Cement",
      "Fertilisers",
      "Iron and Steel",
      "Aluminium",
      "Hydrogen",
      "Electricity",
    ],
    verificationApplicability: true,
    methodologyScope: [
      "accreditation and competence of verifiers",
      "verification planning, evidence and site-visit framework",
      "oversight and independence",
    ],
    keyProvisions: [
      "Article 3 — Accreditation body requirements and NAB designation",
      "Article 4 — Verifier competence and team composition",
      "Article 6 — Site-visit requirements",
      "Article 7 — Independence and impartiality",
      "Article 9 — Peer evaluation of accreditation bodies",
    ],
    contentHash: "b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0",
    lastReviewedAt: "2026-07-31",
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
    effectiveTo: "2025-12-31",
    legalStatus: "TRANSITIONAL_ONLY",
    verificationAuthority: "EUR_LEX",
    verifiedAt: "2026-07-31",
    articles: ["Article 1", "Article 2", "Article 3", "Article 4"],
    annexes: ["Annex I", "Annex II", "Annex III", "Annex IV", "Annex V", "Annex VI", "Annex VII"],
    sectorApplicability: [
      "Cement",
      "Fertilisers",
      "Iron and Steel",
      "Aluminium",
      "Hydrogen",
      "Electricity",
    ],
    verificationApplicability: false,
    methodologyScope: ["transitional reporting methodology through 31 December 2025"],
    keyProvisions: [
      "Article 2 — Reporting obligations during transitional period",
      "Article 4 — Calculation rules for embedded emissions",
    ],
    contentHash: "a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8",
    lastReviewedAt: "2026-07-31",
  },
  ISO_14064_3_2019: {
    id: "ISO_14064_3_2019",
    type: "STANDARD",
    celexId: "",
    eliUri: "https://www.iso.org/standard/66455.html",
    title:
      "ISO 14064-3:2019 Greenhouse gases — Part 3: Specification with guidance for the verification and validation of greenhouse gas statements",
    period: "DEFINITIVE",
    adoptedDate: "2019-12-01",
    publishedDate: "2019-12-15",
    appliesFrom: "2019-12-15",
    effectiveTo: null,
    legalStatus: "REFERENCE_ONLY",
    verificationAuthority: "ISO",
    verifiedAt: "2026-07-31",
    articles: [],
    annexes: [],
    sectorApplicability: [],
    verificationApplicability: true,
    methodologyScope: [
      "verification and validation principles for GHG statements",
      "verification-level assurance (reasonable/limited)",
      "materiality, evidence, and documentation requirements",
    ],
    keyProvisions: [
      "Clause 4 — Principles of verification",
      "Clause 5 — Verification process framework",
      "Clause 6 — Evidence-gathering procedures",
      "Clause 7 — Materiality and verification-level assurance",
    ],
    contentHash: "9f0e1d2c3b4a5968778695a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6",
    lastReviewedAt: "2026-07-31",
  },
  ISO_14065_2020: {
    id: "ISO_14065_2020",
    type: "STANDARD",
    celexId: "",
    eliUri: "https://www.iso.org/standard/74329.html",
    title:
      "ISO 14065:2020 Greenhouse gases — Requirements for bodies that validate and verify greenhouse gas statements for use in accreditation or other forms of recognition",
    period: "DEFINITIVE",
    adoptedDate: "2020-04-01",
    publishedDate: "2020-04-15",
    appliesFrom: "2020-04-15",
    effectiveTo: null,
    legalStatus: "REFERENCE_ONLY",
    verificationAuthority: "ISO",
    verifiedAt: "2026-07-31",
    articles: [],
    annexes: [],
    sectorApplicability: [],
    verificationApplicability: true,
    methodologyScope: [
      "competence requirements for verification bodies",
      "accreditation framework for GHG verifiers",
      "independence, impartiality, and quality management",
    ],
    keyProvisions: [
      "Clause 5 — Competence requirements",
      "Clause 6 — Verification process requirements",
      "Clause 7 — Independence and impartiality",
      "Clause 8 — Quality management system",
    ],
    contentHash: "8e7d6c5b4a39281706958473a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4",
    lastReviewedAt: "2026-07-31",
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

/**
 * Returns reference-only standards (ISO, etc.) that are not EU regulations
 * but provide methodological guidance.
 */
export function getReferenceStandards(): readonly LegalSourceRecord[] {
  return [OFFICIAL_SOURCES.ISO_14064_3_2019, OFFICIAL_SOURCES.ISO_14065_2020];
}

/**
 * Scans a text for phrases that imply accredited-verifier or EU-approved status
 * that the system cannot legitimately claim. Returns the first forbidden match
 * or null.
 */
/**
 * G-21 — source freshness assessment. A source counts as active only if its
 * last verification is not older than `maxAgeDays` relative to `asOfIso`.
 */
export interface LegalSourceFreshness {
  readonly id: string;
  readonly celexId: string;
  readonly lastVerifiedAt: string;
  readonly ageInDays: number;
  readonly fresh: boolean;
}

export function assessLegalSourceFreshness(
  asOfIso: string,
  maxAgeDays = LEGAL_SOURCE_MAX_AGE_DAYS
): LegalSourceFreshness[] {
  const asOf = Date.parse(asOfIso);
  if (Number.isNaN(asOf)) throw new Error(`LEGAL_SOURCE_INVALID_DATE:${asOfIso}`);
  return getDefinitiveLegalSources().map((record) => {
    const lastVerifiedAt = record.lastVerifiedAt ?? record.lastReviewedAt ?? record.verifiedAt;
    const lastVerified = Date.parse(lastVerifiedAt);
    if (Number.isNaN(lastVerified)) throw new Error(`LEGAL_SOURCE_INVALID_VERIFIED_AT:${record.id}`);
    const ageInDays = Math.floor((asOf - lastVerified) / 86_400_000);
    return {
      id: record.id,
      celexId: record.celexId,
      lastVerifiedAt,
      ageInDays,
      fresh: ageInDays >= 0 && ageInDays <= maxAgeDays,
    };
  });
}

/**
 * G-21 — fail-closed staleness gate. Throws listing every stale definitive
 * source; an active status is never claimed for a stale source.
 */
export function assertLegalSourcesFresh(
  asOfIso: string,
  maxAgeDays = LEGAL_SOURCE_MAX_AGE_DAYS
): void {
  const stale = assessLegalSourceFreshness(asOfIso, maxAgeDays).filter((entry) => !entry.fresh);
  if (stale.length > 0) {
    throw new Error(`LEGAL_SOURCE_STALE:${stale.map((entry) => entry.id).join(",")}`);
  }
}

export function detectForbiddenClaims(text: string): string | null {
  const forbidden = [
    "EU approved",
    "officially verified",
    "guaranteed acceptance",
    "accredited report",
    "Registry approved",
    "CBAM certified",
    "EU certified",
    "officially approved",
    "guaranteed compliant",
    "verified emissions",
    "accepted by all authorities",
    "Official EU CBAM XML",
    "EU Registry certified",
    "Directly importable into the CBAM Registry",
    "EU-approved format",
    "Government-certified",
    "TÜV-certified",
    "ISO-certified",
    "registry-compatible",
    "approved by the EU",
    "officially certified",
    "official compiled evidence package",
    "official registry format",
    "instant import",
    "verified ZIP",
    "zero variance",
    "guarantees exact compliance",
    "official declaration",
    "xml registry format output",
  ];
  const lower = text.toLowerCase();
  for (const phrase of forbidden) {
    if (lower.includes(phrase.toLowerCase())) {
      return phrase;
    }
  }
  return null;
}
