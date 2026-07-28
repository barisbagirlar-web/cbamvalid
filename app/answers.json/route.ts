import { NextResponse } from "next/server";
import { AEO_ANSWER_BANK } from "@/lib/seo/aeo/answer-bank";
import { AUTHORITY_CHAINS } from "@/lib/seo/aeo/authority-chains";
import { TOPICAL_MAP } from "@/lib/seo/aeo/topical-map";
import { buildCanonicalUrl } from "@/lib/seo/canonical";
import { siteConfig } from "@/lib/site-config";
import {
  INDEPENDENCE_CLAIM,
  PRICE_CLAIM,
  PRODUCT_POSITIONING_CLAIM,
  SUPPORT_EMAIL_CLAIM,
  assertVerifiedClaim,
} from "@/lib/seo/claims";

/**
 * Machine-readable answer feed for LLMs / answer engines.
 * Additive discovery surface — no auth, calc, or commerce side effects.
 */
export function GET() {
  const price = assertVerifiedClaim(PRICE_CLAIM, "PRICE_CLAIM");
  const body = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "CBAMValid Answer Engine Authority Feed",
    description:
      "Canonical Direct Answer → Calculation → Explanation → Methodology → Evidence → Expert chains plus Answer+Evidence bank for CBAMValid public URLs.",
    url: buildCanonicalUrl("/answers.json"),
    creator: {
      "@type": "Organization",
      name: siteConfig.siteName,
      url: siteConfig.canonicalOrigin,
      email: assertVerifiedClaim(SUPPORT_EMAIL_CLAIM, "SUPPORT_EMAIL_CLAIM"),
    },
    license: "Informational product documentation — not legal advice or accredited verification",
    dateModified: "2026-07-27",
    product: {
      name: assertVerifiedClaim(PRODUCT_POSITIONING_CLAIM, "PRODUCT_POSITIONING_CLAIM"),
      price: price.formatted,
      independence: assertVerifiedClaim(INDEPENDENCE_CLAIM, "INDEPENDENCE_CLAIM"),
    },
    authorityChains: AUTHORITY_CHAINS.map((chain) => ({
      path: chain.path,
      url: buildCanonicalUrl(chain.path),
      primaryQuestion: chain.primaryQuestion,
      empathyLead: chain.empathyLead,
      directAnswer: chain.directAnswer,
      calculation: chain.calculation,
      explanation: chain.explanation,
      methodology: chain.methodology,
      evidence: chain.evidence,
      expert: chain.expert,
      relatedProblems: chain.relatedProblems,
      entities: chain.entities,
      fanOutQueries: chain.fanOutQueries,
    })),
    answers: AEO_ANSWER_BANK.map((answer) => ({
      id: answer.id,
      question: answer.question,
      aliases: answer.aliases,
      directAnswer: answer.directAnswer,
      empathyContext: answer.empathyContext,
      evidence: answer.evidence,
      routes: answer.routes.map((route) => buildCanonicalUrl(route.startsWith("/") ? route : `/${route}`)),
      relatedPaths: answer.relatedPaths,
    })),
    topicalMap: TOPICAL_MAP.map((node) => ({
      path: node.path,
      url: buildCanonicalUrl(node.path),
      topic: node.topic,
      role: node.role,
      parentPath: node.parentPath ?? null,
      childPaths: node.childPaths,
      covers: node.covers,
      entities: node.entities,
      fanOutQueries: node.fanOutQueries,
    })),
    nonClaims: [
      "Not an accredited verification opinion",
      "Not an official European Commission or CBAM Registry service",
      "No fabricated Review / AggregateRating nodes",
    ],
  };

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "Content-Type": "application/ld+json; charset=utf-8",
    },
  });
}
