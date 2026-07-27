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

type JsonLdNode = Record<string, unknown>;

function organizationNode(): JsonLdNode {
  return {
    "@type": "Organization",
    "@id": `${siteConfig.canonicalOrigin}/#organization`,
    name: legalConfig.legalEntityName,
    alternateName: legalConfig.tradingName,
    url: siteConfig.canonicalOrigin,
    logo: {
      "@type": "ImageObject",
      url: `${siteConfig.canonicalOrigin}/favicon.svg`,
    },
    contactPoint: {
      "@type": "ContactPoint",
      email: assertVerifiedClaim(
        { value: legalConfig.supportEmail, evidenceStatus: "verified", evidenceId: "legalConfig.supportEmail" },
        "supportEmail",
      ),
      contactType: "customer support",
    },
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
  };
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
          "One-time Exporter Verification Preparation Pack: one operator, one installation, one reporting year, unlimited drafts, five successful sealed releases. Prepared for independent accredited verification — not an accredited opinion.",
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
 * Universal nested entity graph for LLM / answer-engine retrieval.
 * Product + Offer (price/stock) + Author + Expert Person + Organization in one @graph.
 * Review/AggregateRating intentionally omitted — unverified social proof is forbidden.
 */
export function generateUniversalEntityGraph(params: {
  path: string;
  name: string;
  description: string;
}): JsonLdNode {
  const price = assertVerifiedClaim(PRICE_CLAIM, "PRICE_CLAIM");
  const chain = getAuthorityChain(params.path);
  const pageId = `${buildCanonicalUrl(params.path)}#webpage`;
  const aboutEntities = (chain?.entities ?? []).map((entity, index) => ({
    "@type": "Thing",
    "@id": `${buildCanonicalUrl(params.path)}#entity-${index + 1}`,
    name: entity,
  }));

  const nodes: JsonLdNode[] = [
    organizationNode(),
    authorOrganizationNode(),
    expertReviewerNode(),
    websiteNode(),
    {
      "@type": "Product",
      "@id": `${siteConfig.canonicalOrigin}/#product`,
      name: price.packName,
      description:
        "One-time Exporter Verification Preparation Pack: one operator, one installation, one reporting year, unlimited drafts, five successful sealed releases.",
      brand: { "@id": `${siteConfig.canonicalOrigin}/#organization` },
      author: { "@id": `${siteConfig.canonicalOrigin}/#author` },
      creator: { "@id": `${siteConfig.canonicalOrigin}/#organization` },
      reviewedBy: { "@id": `${siteConfig.canonicalOrigin}/#expert-reviewer` },
      offers: nestedOfferNode(price),
    },
    {
      "@type": "WebPage",
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
    },
  ];

  if (chain) {
    nodes.push({
      "@type": "FAQPage",
      "@id": `${buildCanonicalUrl(params.path)}#authority-faq`,
      mainEntity: [
        {
          "@type": "Question",
          name: chain.primaryQuestion,
          acceptedAnswer: {
            "@type": "Answer",
            text: `${chain.directAnswer} ${chain.empathyLead}`,
            author: { "@id": `${siteConfig.canonicalOrigin}/#author` },
          },
        },
      ],
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
