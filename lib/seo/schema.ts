import { legalConfig } from "@/lib/legal-config";
import { siteConfig } from "@/lib/site-config";
import { assertVerifiedClaim, FORBIDDEN_SOCIAL_PROOF, PRICE_CLAIM } from "./claims";
import { buildCanonicalUrl } from "./canonical";

export type JsonLdNode = Record<string, unknown>;

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
  const price = assertVerifiedClaim(PRICE_CLAIM, "PRICE_CLAIM");
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationNode(),
      {
        "@type": "Product",
        "@id": `${siteConfig.canonicalOrigin}/#product`,
        name: price.packName,
        description: price.description,
        brand: { "@id": `${siteConfig.canonicalOrigin}/#organization` },
        offers: {
          "@type": "Offer",
          price: price.amount,
          priceCurrency: price.currency,
          availability: "https://schema.org/InStock",
          url: buildCanonicalUrl("/pricing"),
          seller: { "@id": `${siteConfig.canonicalOrigin}/#organization` },
        },
      },
    ],
  };
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

function normalizeGraphNode(node: JsonLdNode): JsonLdNode {
  const copy = { ...node };
  delete copy["@context"];
  return copy;
}

/**
 * Deduplicate graph identities at the schema layer, not only at one component call site.
 * Conflicting nodes with the same @id are BLOCK-worthy because silently choosing one
 * would make the entity graph depend on insertion order.
 */
export function dedupeGraphNodes(nodes: readonly JsonLdNode[]): JsonLdNode[] {
  const byId = new Map<string, JsonLdNode>();
  const anonymous: JsonLdNode[] = [];
  for (const raw of nodes) {
    const node = normalizeGraphNode(raw);
    const id = typeof node["@id"] === "string" ? node["@id"] : null;
    if (!id) {
      anonymous.push(node);
      continue;
    }
    const previous = byId.get(id);
    if (!previous) {
      byId.set(id, node);
      continue;
    }
    if (JSON.stringify(previous) !== JSON.stringify(node)) {
      throw new Error(`SEO schema gate: conflicting duplicate @id ${id}`);
    }
  }
  return [...byId.values(), ...anonymous];
}

export function buildPageGraph(nodes: JsonLdNode[]): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@graph": dedupeGraphNodes(nodes),
  };
}
