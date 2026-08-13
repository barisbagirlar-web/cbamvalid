import { legalConfig } from "@/lib/legal-config";
import { siteConfig } from "@/lib/site-config";
import { buildCanonicalUrl } from "./canonical";

/**
 * Visible + schema attribution for YMYL-adjacent regulatory guides.
 * Honest org desks only — no invented personal credentials or accredited-expert claims.
 */
export const GUIDE_EDITORIAL = {
  author: {
    name: "CBAMValid Editorial Desk",
    role: "Software editorial team for operator-facing CBAM preparation guides",
    parentOrganization: legalConfig.legalEntityName,
    tradingName: legalConfig.tradingName,
    aboutPath: "/about" as const,
  },
  reviewer: {
    name: "CBAMValid Regulatory Source Desk",
    role: "Citation accuracy and product-boundary honesty review against the EUR-Lex source index",
  },
  expertiseBasis: [
    "Guides map operator preparation workflows to named EUR-Lex instruments in the CBAMValid regulatory source index.",
    "Calculation and sealing semantics stay aligned with the published methodology page and versioned ruleset registry.",
    "A prior independent academic assessment of selected calculation logic is disclosed on /about, with explicit non-advice and non-verification boundaries.",
  ],
  boundaryLines: [
    "Not legal, customs, tax, or compliance advice.",
    "Not an accredited CBAM verification opinion.",
    "Not an EU authority publication.",
  ],
} as const;

export function guideAuthorSchemaNode(): Record<string, unknown> {
  return {
    "@type": "Organization",
    "@id": `${siteConfig.canonicalOrigin}/#editorial-desk`,
    name: GUIDE_EDITORIAL.author.name,
    description: GUIDE_EDITORIAL.author.role,
    url: buildCanonicalUrl(GUIDE_EDITORIAL.author.aboutPath),
    parentOrganization: { "@id": `${siteConfig.canonicalOrigin}/#organization` },
  };
}

export function guideReviewerSchemaNode(): Record<string, unknown> {
  return {
    "@type": "Organization",
    "@id": `${siteConfig.canonicalOrigin}/#regulatory-source-desk`,
    name: GUIDE_EDITORIAL.reviewer.name,
    description: GUIDE_EDITORIAL.reviewer.role,
    parentOrganization: { "@id": `${siteConfig.canonicalOrigin}/#organization` },
  };
}
