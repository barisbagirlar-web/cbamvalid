import { OFFICIAL_SOURCES } from "@/lib/cbam/registry/legal-sources";
import type { EvidenceStatus } from "./types";

export interface SeoRegulatoryFact {
  readonly id: string;
  readonly statement: string;
  readonly evidenceStatus: EvidenceStatus;
  readonly legalSourceIds: readonly string[];
  readonly notes?: string;
}

/**
 * SEO-facing regulatory facts. Pages/LLM docs must import from here —
 * never hardcode dates or obligations in route copy.
 *
 * Declaration deadline fact is required by SEO Mandate v2.0 and must not be
 * confused with transitional quarterly reporting obligations.
 */
export const SEO_REGULATORY_FACTS = {
  DEFINITIVE_PERIOD_START: {
    id: "DEFINITIVE_PERIOD_START",
    statement: "The CBAM definitive period applies from 1 January 2026.",
    evidenceStatus: "verified",
    legalSourceIds: ["REG_2023_956", "REG_2025_2083", "IMPL_2025_2546"],
  },
  FIRST_DECLARATION_DEADLINE: {
    id: "FIRST_DECLARATION_DEADLINE",
    statement:
      "For 2026 imports, the first CBAM declaration and corresponding certificate surrender deadline is 30 September 2027.",
    evidenceStatus: "verified",
    legalSourceIds: ["REG_2023_956", "REG_2025_2083"],
    notes:
      "Definitive-period annual declaration timetable. Do not present transitional quarterly reporting deadlines as 2026 definitive-period obligations.",
  },
  CERTIFICATE_PRICE_CADENCE_2026: {
    id: "CERTIFICATE_PRICE_CADENCE_2026",
    statement:
      "In 2026, CBAM certificate prices are calculated on a quarterly cadence. Certificate purchase obligations follow the definitive-period rules and must not be confused with transitional quarterly emissions reporting.",
    evidenceStatus: "verified",
    legalSourceIds: ["IMPL_2025_2548"],
  },
  INDEPENDENCE_BOUNDARY: {
    id: "INDEPENDENCE_BOUNDARY",
    statement:
      "CBAMValid prepares operator evidence packages for independent accredited verification. It does not issue an accredited verification opinion, EU approval, customs approval, or registry acceptance.",
    evidenceStatus: "verified",
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
    .filter((fact) => fact.evidenceStatus === "verified")
    .map((fact) => fact.statement);
}
