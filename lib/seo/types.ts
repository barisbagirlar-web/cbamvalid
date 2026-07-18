/**
 * SEO Type System — Şartname v2.1 §2 SSOT
 *
 * Single source of truth for page-level SEO contracts.
 *
 * [STANDARD] schema.org, Google Search Essentials
 * [INTERNAL] cbamvalid.com internal quality gates
 */

// ─── Şartname §2: SeoPageRecord compatible types ───

export type PageRole =
  | 'home'
  | 'hub'
  | 'category'
  | 'tool'
  | 'service'
  | 'article'
  | 'research'
  | 'comparison'
  | 'product'
  | 'local'
  | 'legal';

export type RichResultType =
  | 'Article'
  | 'BreadcrumbList'
  | 'Dataset'
  | 'Organization'
  | 'ProfilePage'
  | 'QAPage'
  | 'SoftwareApplication'
  | 'VideoObject'
  | 'None';

// ─── §10.2 Content Quality Contract ───

export interface ContentQualityContract {
  readonly userProblem: string;
  readonly decisionEnabled: string;
  readonly uniqueValueTypes: readonly (
    | 'firstPartyData'
    | 'calculator'
    | 'expertExperience'
    | 'methodology'
    | 'caseStudy'
    | 'comparison'
    | 'dataset'
    | 'template'
  )[];
  readonly evidenceRefs: readonly string[];
  readonly limitations: readonly string[];
  readonly lastHumanReviewAt: string;
}

// ─── §2 SeoPageRecord ───

export interface SeoPageRecord {
  readonly route: `/${string}` | '/';
  readonly locale: string;
  readonly role: PageRole;
  readonly canonicalRoute: `/${string}` | '/';
  readonly title: string;
  readonly metaDescription: string;
  readonly h1: string;
  readonly primaryIntent: string;
  readonly primaryEntityId: string;
  readonly secondaryEntityIds: readonly string[];
  readonly authorId?: string;
  readonly reviewerId?: string;
  readonly publishedAt?: string;
  readonly modifiedAt: string;
  readonly richResultTypes: readonly RichResultType[];
  readonly imageUrl?: string;
  readonly conversionEvent: string;
  readonly sourceRefs: readonly string[];
  readonly parentHubRoute?: `/${string}`;
  readonly relatedRoutes: readonly `/${string}`[];
  readonly qualityContract?: ContentQualityContract;
  readonly contentSourcePath?: string;
}

// ─── §24 SEO Change Log ───

export interface SeoChange {
  readonly id: string;
  readonly urlPattern: string;
  readonly hypothesis: string;
  readonly primaryMetric: string;
  readonly guardrailMetrics: readonly string[];
  readonly appliedAt: string;
  readonly rollbackRef: string;
  readonly cohort: string;
  readonly owner: string;
}

// ─── Existing types ───

export interface AuthorityReference {
  id: string;
  url: string;
  title: string;
  issuingBody: string;
}

export interface SeoMeta {
  path: string;
  pageType:
    | "homepage"
    | "product"
    | "methodology"
    | "regulatory-source"
    | "legal"
    | "contact"
    | "about"
    | "cn-code"
    | "guide"
    | "faq";
  indexable: boolean;
  primaryKeyword: string;
  secondaryKeywords: string[];
  domainNoun: string;
  pain: string;
  outcome: string;
  audience: string;
  title: string;
  description: string;
  h1: string;
  canonicalPath: string;
  lastModifiedSource: string;
  authorityReferences: AuthorityReference[];
  schemaTypes: string[];
  internalLinkTargets: string[];
  faq?: {
    question: string;
    answer: string;
  }[];
  datePublished?: string;
  dateModified?: string;
  authorId?: string;
}
