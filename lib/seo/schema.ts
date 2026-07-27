import { legalConfig } from "@/lib/legal-config";
import { siteConfig } from "@/lib/site-config";
import {
  assertVerifiedClaim,
  EXPERT_REVIEWER_CLAIM,
  FORBIDDEN_SOCIAL_PROOF,
  PRICE_CLAIM,
  PRODUCT_POSITIONING_CLAIM,
} from "./claims";
import { buildCanonicalUrl } from "./canonical";
import { getAuthorityChain } from "./aeo/authority-chains";
import { getTopicalNode } from "./aeo/topical-map";
import { listGlossaryTerms } from "./aeo/glossary";
import { listSchemaFaqsForRoute } from "./aeo/answer-bank";
import { SEO_LEGAL_SOURCE_INDEX } from "./regulatory-sources";

type JsonLdNode = Record<string, unknown>;

function organizationNode(): JsonLdNode {
  const glossaryKnowsAbout = listGlossaryTerms().map((term) => ({
    "@type": "Thing",
    "@id": `${siteConfig.canonicalOrigin}/glossary#${term.slug}`,
    name: term.name,
  }));

  return {
    "@type": "Organization",
    "@id": `${siteConfig.canonicalOrigin}/#organization`,
    name: legalConfig.legalEntityName,
    alternateName: legalConfig.tradingName,
    url: siteConfig.canonicalOrigin,
    logo: {
      "@type": "ImageObject",
      url: `${siteConfig.canonicalOrigin}/brand/cbamvalid-mark.svg`,
      width: 512,
      height: 512,
    },
    image: siteConfig.ogImage,
    email: legalConfig.supportEmail,
    // Country only — street address in siteConfig is placeholder and must not enter schema.
    address: {
      "@type": "PostalAddress",
      addressCountry: "IE",
      addressLocality: "Republic of Ireland",
    },
    contactPoint: {
      "@type": "ContactPoint",
      email: assertVerifiedClaim(
        { value: legalConfig.supportEmail, evidenceStatus: "verified", evidenceId: "legalConfig.supportEmail" },
        "supportEmail",
      ),
      contactType: "customer support",
      availableLanguage: ["English"],
    },
    knowsAbout: glossaryKnowsAbout,
    // Empty until independently verified public profiles exist.
    sameAs: siteConfig.socialProfiles,
  };
}

function authorOrganizationNode(): JsonLdNode {
  return {
    "@type": "Organization",
    "@id": `${siteConfig.canonicalOrigin}/#author`,
    name: legalConfig.tradingName,
    url: siteConfig.canonicalOrigin,
    parentOrganization: { "@id": `${siteConfig.canonicalOrigin}/#organization` },
    email: assertVerifiedClaim(
      { value: legalConfig.supportEmail, evidenceStatus: "verified", evidenceId: "legalConfig.supportEmail" },
      "authorEmail",
    ),
  };
}

function expertReviewerNode(): JsonLdNode {
  const expert = assertVerifiedClaim(EXPERT_REVIEWER_CLAIM, "EXPERT_REVIEWER_CLAIM");
  return {
    "@type": "Person",
    "@id": `${siteConfig.canonicalOrigin}/#expert-reviewer`,
    name: expert.name,
    jobTitle: expert.jobTitle,
    affiliation: {
      "@type": "Organization",
      name: expert.affiliation,
    },
    description: expert.roleBoundary,
  };
}

function nestedOfferNode(price: {
  amount: string;
  currency: "USD";
  formatted: string;
  packName: string;
}): JsonLdNode {
  return {
    "@type": "Offer",
    "@id": `${siteConfig.canonicalOrigin}/#offer`,
    url: buildCanonicalUrl("/pricing"),
    price: price.amount,
    priceCurrency: price.currency,
    availability: "https://schema.org/InStock",
    itemCondition: "https://schema.org/NewCondition",
    seller: { "@id": `${siteConfig.canonicalOrigin}/#organization` },
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price: price.amount,
      priceCurrency: price.currency,
      name: price.packName,
    },
  };
}

function websiteNode(): JsonLdNode {
  return {
    "@type": "WebSite",
    "@id": `${siteConfig.canonicalOrigin}/#website`,
    name: siteConfig.siteName,
    url: siteConfig.canonicalOrigin,
    inLanguage: "en",
    publisher: { "@id": `${siteConfig.canonicalOrigin}/#organization` },
    // Discovery surfaces for LLM / answer-engine crawlers
    hasPart: [
      { "@type": "WebPage", url: `${siteConfig.canonicalOrigin}/llms.txt`, name: "LLM index" },
      { "@type": "WebPage", url: `${siteConfig.canonicalOrigin}/answers`, name: "Answer bank HTML hub" },
      { "@type": "WebPage", url: `${siteConfig.canonicalOrigin}/glossary`, name: "Entity glossary" },
      { "@type": "Dataset", url: `${siteConfig.canonicalOrigin}/answers.json`, name: "Answer authority feed" },
      { "@type": "DataFeed", url: `${siteConfig.canonicalOrigin}/answers.rss`, name: "Answer RSS feed" },
      { "@type": "DataFeed", url: `${siteConfig.canonicalOrigin}/answers.feed.json`, name: "Answer JSON Feed" },
    ],
  };
}

function dataCatalogNode(): JsonLdNode {
  return {
    "@type": "DataCatalog",
    "@id": `${siteConfig.canonicalOrigin}/#data-catalog`,
    name: "CBAMValid machine-readable answer & entity catalog",
    url: buildCanonicalUrl("/answers"),
    publisher: { "@id": `${siteConfig.canonicalOrigin}/#organization` },
    inLanguage: "en",
    dataset: [
      { "@id": `${siteConfig.canonicalOrigin}/answers.json` },
      { "@id": `${siteConfig.canonicalOrigin}/#site-glossary` },
    ],
  };
}

function siteGlossaryNode(): JsonLdNode {
  const terms = listGlossaryTerms();
  return {
    "@type": "DefinedTermSet",
    "@id": `${siteConfig.canonicalOrigin}/#site-glossary`,
    name: "CBAMValid CBAM entity glossary",
    url: buildCanonicalUrl("/glossary"),
    hasDefinedTerm: terms.map((term) => ({
      "@type": "DefinedTerm",
      "@id": `${siteConfig.canonicalOrigin}/glossary#${term.slug}`,
      name: term.name,
      description: term.definition,
      url: `${siteConfig.canonicalOrigin}/glossary#${term.slug}`,
      inDefinedTermSet: `${siteConfig.canonicalOrigin}/#site-glossary`,
    })),
  };
}

function serviceNode(price: {
  amount: string;
  currency: "USD";
  formatted: string;
  packName: string;
}): JsonLdNode {
  return {
    "@type": "Service",
    "@id": `${siteConfig.canonicalOrigin}/#service`,
    name: price.packName,
    serviceType: "CBAM exporter verification preparation",
    description:
      "Operator-prepared, evidence-linked CBAM dossier packaging for independent accredited verification. Not an accredited verification opinion.",
    provider: { "@id": `${siteConfig.canonicalOrigin}/#organization` },
    brand: { "@id": `${siteConfig.canonicalOrigin}/#organization` },
    areaServed: {
      "@type": "AdministrativeArea",
      name: "Non-EU exporters shipping goods into the European Union",
    },
    audience: {
      "@type": "BusinessAudience",
      audienceType: "Non-EU producers, exporters, operators, importers, and CBAM reporting teams",
    },
    termsOfService: buildCanonicalUrl("/terms"),
    offers: nestedOfferNode(price),
  };
}

function citationNodes(sourceIds: readonly string[]): JsonLdNode[] {
  const nodes: JsonLdNode[] = [];
  for (const id of sourceIds) {
    const source = SEO_LEGAL_SOURCE_INDEX[id as keyof typeof SEO_LEGAL_SOURCE_INDEX];
    if (!source) continue;
    nodes.push({
      "@type": "Legislation",
      "@id": `${siteConfig.canonicalOrigin}/#legal-${id}`,
      name: source.title,
      legislationIdentifier: source.celexId ?? id,
      url: source.eliUri,
      inLanguage: "en",
    });
  }
  return nodes;
}

export function generateOrganizationSchema(): JsonLdNode {
  return { "@context": "https://schema.org", ...organizationNode() };
}

export function generateWebSiteSchema(): JsonLdNode {
  return { "@context": "https://schema.org", ...websiteNode() };
}

export function generateWebApplicationSchema(description: string): JsonLdNode {
  const price = assertVerifiedClaim(PRICE_CLAIM, "PRICE_CLAIM");
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": `${siteConfig.canonicalOrigin}/#webapplication`,
    name: siteConfig.siteName,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: siteConfig.canonicalOrigin,
    description,
    inLanguage: "en",
    publisher: { "@id": `${siteConfig.canonicalOrigin}/#organization` },
    offers: {
      "@type": "Offer",
      price: price.amount,
      priceCurrency: price.currency,
      availability: "https://schema.org/InStock",
      url: buildCanonicalUrl("/pricing"),
    },
  };
}

export function generateBreadcrumbSchema(items: { name: string; item: string }[]): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((breadcrumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: breadcrumb.name,
      item: buildCanonicalUrl(breadcrumb.item),
    })),
  };
}

export function generateFAQSchema(faqs: { question: string; answer: string }[]): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export function generateProductOfferSchema(): JsonLdNode {
  // Hard fail if social-proof ever regresses to unverified emission.
  if (FORBIDDEN_SOCIAL_PROOF.aggregateRating.evidenceStatus !== "unverified") {
    throw new Error("SEO schema gate: AggregateRating must remain unverified/absent");
  }
  if (FORBIDDEN_SOCIAL_PROOF.fabricatedReviews.evidenceStatus !== "unverified") {
    throw new Error("SEO schema gate: fabricated Review nodes must remain unverified/absent");
  }
  const price = assertVerifiedClaim(PRICE_CLAIM, "PRICE_CLAIM");
  const positioning = assertVerifiedClaim(PRODUCT_POSITIONING_CLAIM, "PRODUCT_POSITIONING_CLAIM");
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationNode(),
      authorOrganizationNode(),
      expertReviewerNode(),
      {
        "@type": "Product",
        "@id": `${siteConfig.canonicalOrigin}/#product`,
        name: price.packName,
        description:
          "One-time pay-at-lock Exporter Verification Preparation Pack: one operator, one installation, one reporting year, unlimited drafts, and same-file correction re-locks. Prepared for independent accredited verification — not an accredited opinion.",
        brand: { "@id": `${siteConfig.canonicalOrigin}/#organization` },
        author: { "@id": `${siteConfig.canonicalOrigin}/#author` },
        creator: { "@id": `${siteConfig.canonicalOrigin}/#organization` },
        reviewedBy: { "@id": `${siteConfig.canonicalOrigin}/#expert-reviewer` },
        category: positioning,
        offers: nestedOfferNode(price),
      },
    ],
  };
}

/**
 * Google Assistant / voice / answer-engine speakable selectors.
 * Points at visible Direct Answer surfaces already rendered on critical URLs.
 */
export function generateSpeakableSchema(path: string): JsonLdNode {
  return {
    "@type": "WebPage",
    "@id": `${buildCanonicalUrl(path)}#speakable`,
    url: buildCanonicalUrl(path),
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: [".speakable-answer", ".authority-direct", ".aeo-lead", ".aeo-direct"],
    },
  };
}

/** HowTo for the draft → pay-at-lock → seal workflow (how-it-works). */
export function generateHowToSealSchema(): JsonLdNode {
  const price = assertVerifiedClaim(PRICE_CLAIM, "PRICE_CLAIM");
  return {
    "@type": "HowTo",
    "@id": `${siteConfig.canonicalOrigin}/how-it-works#howto`,
    name: "How to prepare and seal a CBAMValid Exporter Verification Preparation Pack",
    description:
      "Define one installation and reporting year, enter goods and production data, link evidence, clear quality blockers, pay once to lock that working file, then download immutable sealed packages. Same file: correct and re-lock as needed.",
    totalTime: "P14D",
    estimatedCost: {
      "@type": "MonetaryAmount",
      currency: price.currency,
      value: price.amount,
    },
    tool: {
      "@type": "HowToTool",
      name: price.packName,
    },
    step: [
      {
        "@type": "HowToStep",
        position: 1,
        name: "Create a scoped working file",
        text: "Define one legal operator, one production installation, and one reporting year.",
        url: `${siteConfig.canonicalOrigin}/how-it-works#direct-answer`,
      },
      {
        "@type": "HowToStep",
        position: 2,
        name: "Enter goods and production data",
        text: "Add CN codes, production quantities, routes, precursors, and emission inputs with units.",
      },
      {
        "@type": "HowToStep",
        position: 3,
        name: "Link evidence and clear blockers",
        text: "Attach supporting documents, resolve fail-closed quality controls, and close material findings.",
      },
      {
        "@type": "HowToStep",
        position: 4,
        name: "Pay once to lock this file",
        text: `Pay ${price.formatted} to unlock lock-and-download for this working file. Drafting stays free until then.`,
        url: `${siteConfig.canonicalOrigin}/pricing#how-payment-works`,
      },
      {
        "@type": "HowToStep",
        position: 5,
        name: "Seal, correct, and re-lock",
        text: "Seal an immutable release and download PDF, JSON, and O3CI field-mapped exports. Correct and re-lock the same paid file as needed. A new file needs a new payment.",
        url: `${siteConfig.canonicalOrigin}/sample-dossier`,
      },
    ],
  };
}

/** Nested DefinedTermSet from page entities — helps LLM entity grounding. */
export function generateDefinedTermSetSchema(params: {
  path: string;
  entities: readonly string[];
}): JsonLdNode | null {
  if (params.entities.length === 0) return null;
  return {
    "@type": "DefinedTermSet",
    "@id": `${buildCanonicalUrl(params.path)}#terms`,
    name: `CBAMValid entities for ${params.path}`,
    hasDefinedTerm: params.entities.map((entity, index) => ({
      "@type": "DefinedTerm",
      "@id": `${buildCanonicalUrl(params.path)}#term-${index + 1}`,
      name: entity,
      inDefinedTermSet: `${buildCanonicalUrl(params.path)}#terms`,
    })),
  };
}

/**
 * Universal nested entity graph for LLM / answer-engine retrieval.
 * Product + Offer (price/stock) + Service + Author + Expert Person + Organization
 * + EU ELI citations in one @graph.
 * Review/AggregateRating intentionally omitted — unverified social proof is forbidden.
 */
export function generateUniversalEntityGraph(params: {
  path: string;
  name: string;
  description: string;
  dateModified?: string;
  regulatorySourceIds?: readonly string[];
  pageType?: string;
}): JsonLdNode {
  const price = assertVerifiedClaim(PRICE_CLAIM, "PRICE_CLAIM");
  const chain = getAuthorityChain(params.path);
  const pageId = `${buildCanonicalUrl(params.path)}#webpage`;
  const aboutEntities = (chain?.entities ?? []).map((entity, index) => ({
    "@type": "Thing",
    "@id": `${buildCanonicalUrl(params.path)}#entity-${index + 1}`,
    name: entity,
  }));
  const citations = citationNodes(params.regulatorySourceIds ?? []);
  const citationRefs = citations.map((node) => ({ "@id": node["@id"] as string }));
  const isGuideOrMethod =
    params.pageType === "guide" ||
    params.pageType === "methodology" ||
    params.path.startsWith("/cbam-") ||
    params.path === "/glossary" ||
    params.path === "/answers";

  const webPageType = isGuideOrMethod
    ? (["WebPage", "TechArticle"] as const)
    : params.pageType === "about"
      ? (["WebPage", "AboutPage"] as const)
      : params.pageType === "contact"
        ? (["WebPage", "ContactPage"] as const)
        : params.path === "/glossary" || params.path === "/answers" || params.path === "/cn-code"
          ? (["WebPage", "CollectionPage"] as const)
          : "WebPage";

  const webPageNode: JsonLdNode = {
    "@type": webPageType,
    "@id": pageId,
    url: buildCanonicalUrl(params.path),
    name: params.name,
    description: params.description,
    isPartOf: { "@id": `${siteConfig.canonicalOrigin}/#website` },
    author: { "@id": `${siteConfig.canonicalOrigin}/#author` },
    publisher: { "@id": `${siteConfig.canonicalOrigin}/#organization` },
    reviewedBy: { "@id": `${siteConfig.canonicalOrigin}/#expert-reviewer` },
    about: aboutEntities.length > 0 ? aboutEntities : { "@id": `${siteConfig.canonicalOrigin}/#product` },
    mentions: aboutEntities,
    mainEntity: { "@id": `${siteConfig.canonicalOrigin}/#product` },
    inLanguage: "en",
    isAccessibleForFree: true,
    audience: {
      "@type": "BusinessAudience",
      audienceType: "Non-EU producers, exporters, operators, importers, and CBAM reporting teams",
    },
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: [".speakable-answer", ".authority-direct", ".aeo-lead", ".aeo-direct", ".glossary-definition"],
    },
    significantLink: [
      ...(chain?.relatedProblems ?? []).map((item) => buildCanonicalUrl(item.href)),
      buildCanonicalUrl("/glossary"),
      buildCanonicalUrl("/answers"),
    ],
    primaryImageOfPage: {
      "@type": "ImageObject",
      url: siteConfig.ogImage,
    },
  };

  if (params.dateModified) {
    webPageNode.dateModified = params.dateModified;
    if (isGuideOrMethod) {
      webPageNode.datePublished = params.dateModified;
    }
  }
  if (citationRefs.length > 0) {
    webPageNode.citation = citationRefs;
    webPageNode.isBasedOn = citationRefs;
  }

  const nodes: JsonLdNode[] = [
    organizationNode(),
    authorOrganizationNode(),
    expertReviewerNode(),
    websiteNode(),
    dataCatalogNode(),
    siteGlossaryNode(),
    serviceNode(price),
    {
      "@type": ["Product", "SoftwareApplication"],
      "@id": `${siteConfig.canonicalOrigin}/#product`,
      name: price.packName,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "One-time pay-at-lock Exporter Verification Preparation Pack: one operator, one installation, one reporting year, unlimited drafts, and same-file correction re-locks.",
      brand: { "@id": `${siteConfig.canonicalOrigin}/#organization` },
      author: { "@id": `${siteConfig.canonicalOrigin}/#author` },
      creator: { "@id": `${siteConfig.canonicalOrigin}/#organization` },
      reviewedBy: { "@id": `${siteConfig.canonicalOrigin}/#expert-reviewer` },
      offers: nestedOfferNode(price),
      featureList: [
        "Deterministic server-side embedded-emissions calculations",
        "Evidence register with SHA-256 integrity",
        "Fail-closed quality controls before sealing",
        "Versioned EU rulesets recorded in sealed packages",
        "O3CI field-mapped structured data export",
        "Pay once to lock a working file; same-file corrections included",
      ],
    },
    webPageNode,
    ...citations,
  ];

  // Single merged FAQPage — primary authority question + schema-eligible answer bank.
  const faqEntities: JsonLdNode[] = [];
  if (chain) {
    faqEntities.push({
      "@type": "Question",
      "@id": `${buildCanonicalUrl(params.path)}#q-authority`,
      name: chain.primaryQuestion,
      acceptedAnswer: {
        "@type": "Answer",
        text: `${chain.directAnswer} ${chain.empathyLead}`,
        author: { "@id": `${siteConfig.canonicalOrigin}/#author` },
      },
    });
  }
  for (const [index, faq] of listSchemaFaqsForRoute(params.path).entries()) {
    faqEntities.push({
      "@type": "Question",
      "@id": `${buildCanonicalUrl(params.path)}#q-bank-${index + 1}`,
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
        author: { "@id": `${siteConfig.canonicalOrigin}/#author` },
      },
    });
  }
  if (faqEntities.length > 0) {
    nodes.push({
      "@type": "FAQPage",
      "@id": `${buildCanonicalUrl(params.path)}#faq`,
      mainEntity: faqEntities,
    });
  }

  if (chain) {
    const termSet = generateDefinedTermSetSchema({
      path: params.path,
      entities: chain.entities,
    });
    if (termSet) nodes.push(termSet);
  }

  if (params.path === "/how-it-works") {
    nodes.push(generateHowToSealSchema());
  }

  // Topical ItemList — helps answer engines fan out hub → spoke URLs without guessing.
  const topical = getTopicalNode(params.path);
  if (topical && topical.childPaths.length > 0) {
    nodes.push({
      "@type": "ItemList",
      "@id": `${buildCanonicalUrl(params.path)}#topical-list`,
      name: `${topical.topic} — related pages`,
      itemListOrder: "https://schema.org/ItemListOrderAscending",
      numberOfItems: topical.childPaths.length,
      itemListElement: topical.childPaths.map((childPath, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: buildCanonicalUrl(childPath),
        name: getTopicalNode(childPath)?.topic ?? childPath,
      })),
    });
  }

  return buildPageGraph(nodes);
}

/** @deprecated Use generateProductOfferSchema — kept name for call-site migration. */
export function generateEeatProductSchema(): JsonLdNode {
  return generateProductOfferSchema();
}

export function generateWebPageSchema(params: {
  path: string;
  name: string;
  description: string;
  type?: "WebPage" | "CollectionPage" | "AboutPage" | "ContactPage";
}): JsonLdNode {
  const id = `${buildCanonicalUrl(params.path)}#webpage`;
  return {
    "@context": "https://schema.org",
    "@type": params.type ?? "WebPage",
    "@id": id,
    url: buildCanonicalUrl(params.path),
    name: params.name,
    description: params.description,
    isPartOf: { "@id": `${siteConfig.canonicalOrigin}/#website` },
    inLanguage: "en",
  };
}

export function buildPageGraph(nodes: JsonLdNode[]): JsonLdNode {
  const normalized = nodes.map((node) => {
    const copy = { ...node };
    delete copy["@context"];
    return copy;
  });
  return {
    "@context": "https://schema.org",
    "@graph": normalized,
  };
}
