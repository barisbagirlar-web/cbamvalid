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
