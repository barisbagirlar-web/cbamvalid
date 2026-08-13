import { OFFICIAL_SOURCES } from "@/lib/cbam/registry/legal-sources";

export type RegulatoryProvenanceStatus = "VERIFIED_PRIMARY_SOURCE" | "ASSUMPTION" | "UNVERIFIED";

/**
 * Versioned SEO regulatory content contract.
 * Routes must pin `regulatoryContentVersion`; mismatch ⇒ STALE_REGULATORY_CONTENT FAIL.
 */
export const SEO_REGULATORY_CONTENT_VERSION = "CBAM-SEO-REG-2026.07.26.v2" as const;

export interface RegulatorySourceRecord {
  readonly id: string;
  readonly celex?: string;
  readonly canonicalUrl: string;
  readonly effectiveFrom: string;
  readonly retrievedAt: string;
  readonly contentDigest: string;
  readonly provenanceStatus: RegulatoryProvenanceStatus;
  readonly affectedRouteIds: readonly string[];
  readonly notes?: string;
}

/** Stable content digests (literal) — avoid Node crypto in shared SEO modules. */
const DIGEST = {
  EC_FIRST_DECLARATION:
    "sha256:ec-2026-06-23-first-declaration-30-sep-2027-v1",
  ART22:
    "sha256:reg-2023-956-art22-first-time-2027-for-2026-30-sep-v1",
  REG_2023_956: "sha256:reg-2023-956-eli-v1",
  REG_2025_2083: "sha256:reg-2025-2083-eli-v1",
  IMPL_2025_2546: "sha256:impl-2025-2546-eli-v1",
  IMPL_2025_2547: "sha256:impl-2025-2547-eli-v1",
  IMPL_2025_2548: "sha256:impl-2025-2548-eli-v1",
  CN_2026: "sha256:impl-2025-1926-cn-nomenclature-2026-v1",
} as const;

/**
 * Primary sources for definitive-period declaration timetable.
 * EC communication (2026-06-23) + consolidated CBAM Regulation Art. 22 framing.
 */
export const REGULATORY_SOURCES = {
  EC_CBAM_FIRST_DECLARATION_2026_06_23: {
    id: "EC_CBAM_FIRST_DECLARATION_2026_06_23",
    canonicalUrl:
      "https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism_en",
    effectiveFrom: "2026-01-01",
    retrievedAt: "2026-07-26",
    contentDigest: DIGEST.EC_FIRST_DECLARATION,
    provenanceStatus: "VERIFIED_PRIMARY_SOURCE",
    affectedRouteIds: [
      "/",
      "/cbam-2026-definitive-period",
      "/cbam-certificate-price",
      "/cbam-non-eu-producer-guide",
      "/cbam-verification-preparation",
      "/methodology",
      "/cbam-verification-preparation",
    ],
    notes:
      "European Commission definitive-period communication: 2026 imports → first declaration and corresponding certificate surrender by 30 September 2027.",
  },
  REG_2023_956_ART22_CONSOLIDATED: {
    id: "REG_2023_956_ART22_CONSOLIDATED",
    celex: OFFICIAL_SOURCES.REG_2023_956.celexId,
    canonicalUrl: OFFICIAL_SOURCES.REG_2023_956.eliUri,
    effectiveFrom: OFFICIAL_SOURCES.REG_2023_956.appliesFrom,
    retrievedAt: "2026-07-26",
    contentDigest: DIGEST.ART22,
    provenanceStatus: "VERIFIED_PRIMARY_SOURCE",
    affectedRouteIds: [
      "/cbam-2026-definitive-period",
      "/cbam-certificate-price",
      "/cbam-non-eu-producer-guide",
      "/cbam-verification-preparation",
    ],
    notes:
      "Consolidated CBAM Regulation Article 22 timetable: first declaration in 2027 covering year 2026, due 30 September.",
  },
  REG_2023_956: {
    id: "REG_2023_956",
    celex: OFFICIAL_SOURCES.REG_2023_956.celexId,
    canonicalUrl: OFFICIAL_SOURCES.REG_2023_956.eliUri,
    effectiveFrom: OFFICIAL_SOURCES.REG_2023_956.appliesFrom,
    retrievedAt: OFFICIAL_SOURCES.REG_2023_956.verifiedAt,
    contentDigest: DIGEST.REG_2023_956,
    provenanceStatus: "VERIFIED_PRIMARY_SOURCE",
    affectedRouteIds: [
      "/",
      "/product",
      "/methodology",
      "/cn-code",
      "/cbam-cn-code-scope",
      "/cbam-embedded-emissions-calculation",
      "/cbam-actual-vs-default-values",
      "/cbam-default-values",
      "/cbam-exporter-evidence-requirements",
      "/methodology",
    ],
  },
  REG_2025_2083: {
    id: "REG_2025_2083",
    celex: OFFICIAL_SOURCES.REG_2025_2083.celexId,
    canonicalUrl: OFFICIAL_SOURCES.REG_2025_2083.eliUri,
    effectiveFrom: OFFICIAL_SOURCES.REG_2025_2083.appliesFrom,
    retrievedAt: OFFICIAL_SOURCES.REG_2025_2083.verifiedAt,
    contentDigest: DIGEST.REG_2025_2083,
    provenanceStatus: "VERIFIED_PRIMARY_SOURCE",
    affectedRouteIds: [
      "/cbam-2026-definitive-period",
      "/cbam-actual-vs-default-values",
      "/cbam-non-eu-producer-guide",
    ],
  },
  IMPL_2025_2546: {
    id: "IMPL_2025_2546",
    celex: OFFICIAL_SOURCES.IMPL_2025_2546.celexId,
    canonicalUrl: OFFICIAL_SOURCES.IMPL_2025_2546.eliUri,
    effectiveFrom: OFFICIAL_SOURCES.IMPL_2025_2546.appliesFrom,
    retrievedAt: OFFICIAL_SOURCES.IMPL_2025_2546.verifiedAt,
    contentDigest: DIGEST.IMPL_2025_2546,
    provenanceStatus: "VERIFIED_PRIMARY_SOURCE",
    affectedRouteIds: [
      "/methodology",
      "/cbam-verification-preparation",
      "/cbam-exporter-evidence-requirements",
      "/sample-dossier",
    ],
  },
  IMPL_2025_2547: {
    id: "IMPL_2025_2547",
    celex: OFFICIAL_SOURCES.IMPL_2025_2547.celexId,
    canonicalUrl: OFFICIAL_SOURCES.IMPL_2025_2547.eliUri,
    effectiveFrom: OFFICIAL_SOURCES.IMPL_2025_2547.appliesFrom,
    retrievedAt: OFFICIAL_SOURCES.IMPL_2025_2547.verifiedAt,
    contentDigest: DIGEST.IMPL_2025_2547,
    provenanceStatus: "VERIFIED_PRIMARY_SOURCE",
    affectedRouteIds: [
      "/methodology",
      "/cbam-embedded-emissions-calculation",
      "/cbam-actual-vs-default-values",
      "/cbam-default-values",
    ],
  },
  IMPL_2025_2548: {
    id: "IMPL_2025_2548",
    celex: OFFICIAL_SOURCES.IMPL_2025_2548.celexId,
    canonicalUrl: OFFICIAL_SOURCES.IMPL_2025_2548.eliUri,
    effectiveFrom: OFFICIAL_SOURCES.IMPL_2025_2548.appliesFrom,
    retrievedAt: OFFICIAL_SOURCES.IMPL_2025_2548.verifiedAt,
    contentDigest: DIGEST.IMPL_2025_2548,
    provenanceStatus: "VERIFIED_PRIMARY_SOURCE",
    affectedRouteIds: ["/cbam-certificate-price", "/cbam-2026-definitive-period"],
  },
  CN_NOMENCLATURE_2026_IMPL_2025_1926: {
    id: "CN_NOMENCLATURE_2026_IMPL_2025_1926",
    celex: "32025R1926",
    canonicalUrl: "https://eur-lex.europa.eu/eli/reg_impl/2025/1926/oj/eng",
    effectiveFrom: "2026-01-01",
    retrievedAt: "2026-07-26",
    contentDigest: DIGEST.CN_2026,
    provenanceStatus: "VERIFIED_PRIMARY_SOURCE",
    affectedRouteIds: ["/cn-code", "/cbam-cn-code-scope"],
    notes:
      "2026 Combined Nomenclature instrument. Full digit-level CN universe resolution remains Stage-2 work; scope rules consume Annex hierarchy against this nomenclature version.",
  },
} as const satisfies Record<string, RegulatorySourceRecord>;

export type RegulatorySourceId = keyof typeof REGULATORY_SOURCES;

export interface SeoRegulatoryFact {
  readonly id: string;
  readonly statement: string;
  readonly provenanceStatus: RegulatoryProvenanceStatus;
  readonly primarySourceIds: readonly RegulatorySourceId[];
  readonly legalSourceIds: readonly string[];
  readonly notes?: string;
}

export const SEO_REGULATORY_FACTS = {
  DEFINITIVE_PERIOD_START: {
    id: "DEFINITIVE_PERIOD_START",
    statement: "The CBAM definitive period applies from 1 January 2026.",
    provenanceStatus: "VERIFIED_PRIMARY_SOURCE",
    primarySourceIds: ["REG_2023_956", "REG_2025_2083", "IMPL_2025_2546"],
    legalSourceIds: ["REG_2023_956", "REG_2025_2083", "IMPL_2025_2546"],
  },
  FIRST_DECLARATION_DEADLINE: {
    id: "FIRST_DECLARATION_DEADLINE",
    statement:
      "For 2026 imports, the first CBAM declaration and corresponding certificate surrender deadline is 30 September 2027.",
    provenanceStatus: "VERIFIED_PRIMARY_SOURCE",
    primarySourceIds: ["EC_CBAM_FIRST_DECLARATION_2026_06_23", "REG_2023_956_ART22_CONSOLIDATED"],
    legalSourceIds: ["REG_2023_956", "REG_2025_2083"],
    notes:
      "Verified against EC definitive-period communication (2026-06-23) and consolidated Regulation Article 22 timetable. Not a transitional quarterly reporting obligation.",
  },
  CERTIFICATE_PRICE_CADENCE_2026: {
    id: "CERTIFICATE_PRICE_CADENCE_2026",
    statement:
      "In 2026, CBAM certificate prices are calculated on a quarterly cadence under Implementing Regulation (EU) 2025/2548 Article 1. From 2027 the cadence is weekly under Article 5. Certificate purchase obligations follow the definitive-period rules and must not be confused with transitional quarterly emissions reporting.",
    provenanceStatus: "VERIFIED_PRIMARY_SOURCE",
    primarySourceIds: ["IMPL_2025_2548", "EC_CBAM_FIRST_DECLARATION_2026_06_23"],
    legalSourceIds: ["IMPL_2025_2548"],
  },
  INDEPENDENCE_BOUNDARY: {
    id: "INDEPENDENCE_BOUNDARY",
    statement:
      "CBAMValid prepares operator evidence packages for independent accredited verification. It does not issue an accredited verification opinion, EU approval, customs approval, or registry acceptance.",
    provenanceStatus: "VERIFIED_PRIMARY_SOURCE",
    primarySourceIds: ["REG_2023_956", "IMPL_2025_2546"],
    legalSourceIds: ["REG_2023_956", "IMPL_2025_2546"],
  },
} as const satisfies Record<string, SeoRegulatoryFact>;

export const SEO_LEGAL_SOURCE_INDEX = {
  REG_2023_956: OFFICIAL_SOURCES.REG_2023_956,
  REG_2025_2083: OFFICIAL_SOURCES.REG_2025_2083,
  IMPL_2025_2546: OFFICIAL_SOURCES.IMPL_2025_2546,
  IMPL_2025_2547: OFFICIAL_SOURCES.IMPL_2025_2547,
  IMPL_2025_2548: OFFICIAL_SOURCES.IMPL_2025_2548,
} as const;

export function getRegulatoryFact(id: keyof typeof SEO_REGULATORY_FACTS): SeoRegulatoryFact {
  return SEO_REGULATORY_FACTS[id];
}

export function listVerifiedRegulatoryStatements(): readonly string[] {
  return Object.values(SEO_REGULATORY_FACTS)
    .filter((fact) => fact.provenanceStatus === "VERIFIED_PRIMARY_SOURCE")
    .map((fact) => fact.statement);
}

export function assertNoAssumptions(): void {
  for (const fact of Object.values(SEO_REGULATORY_FACTS)) {
    if (fact.provenanceStatus !== "VERIFIED_PRIMARY_SOURCE") {
      throw new Error(`Regulatory fact ${fact.id} is not VERIFIED_PRIMARY_SOURCE`);
    }
  }
  for (const source of Object.values(REGULATORY_SOURCES)) {
    if (source.provenanceStatus !== "VERIFIED_PRIMARY_SOURCE") {
      throw new Error(`Regulatory source ${source.id} is not VERIFIED_PRIMARY_SOURCE`);
    }
  }
}

export function collectStaleRoutes(routePins: ReadonlyMap<string, string>): readonly string[] {
  const stale: string[] = [];
  for (const [path, pinnedVersion] of routePins) {
    if (pinnedVersion !== SEO_REGULATORY_CONTENT_VERSION) {
      stale.push(path);
    }
  }
  return stale;
}

export function routesAffectedBySource(sourceId: RegulatorySourceId): readonly string[] {
  return REGULATORY_SOURCES[sourceId].affectedRouteIds;
}
