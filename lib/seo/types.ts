export type Indexability = "index" | "noindex";

export type SeoPageType =
  | "homepage"
  | "product"
  | "pricing"
  | "methodology"
  | "guide"
  | "cn-hub"
  | "cn-detail"
  | "about"
  | "contact"
  | "legal"
  | "verification";

export type EvidenceStatus = "verified" | "unverified";

export interface PublicClaim<T> {
  readonly value: T;
  readonly evidenceStatus: EvidenceStatus;
  readonly evidenceId?: string;
}

export interface SeoRouteContract {
  readonly path: string;
  readonly pageType: SeoPageType;
  readonly indexability: Indexability;

  readonly title: string;
  readonly description: string;
  readonly h1: string;

  readonly canonicalPath: string;

  readonly primaryIntent: string;
  readonly audience: readonly string[];

  readonly sitemapEligible: boolean;

  readonly schemaTypes: readonly string[];
  readonly internalLinkTargets: readonly string[];

  readonly regulatorySourceIds: readonly string[];

  /** ISO-8601 date of meaningful content change. Omit when unknown — never invent. */
  readonly factualLastModified?: string;
}

export type CbamSector =
  | "STEEL"
  | "ALUMINIUM"
  | "CEMENT"
  | "FERTILIZER"
  | "ELECTRICITY"
  | "HYDROGEN";

export interface CbamCnPublicEntry {
  readonly cnCode: string;
  readonly description: string;
  readonly sector: CbamSector;
  readonly effectiveFrom: string;
  readonly effectiveTo?: string;
  readonly legalSourceId: string;
  readonly productionRoutes: readonly string[];
  readonly publicPageEligible: boolean;
  readonly requiredProducerData: readonly string[];
  readonly evidenceConsiderations: readonly string[];
  readonly factualLastModified: string;
}
