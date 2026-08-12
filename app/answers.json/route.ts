import { NextResponse } from "next/server";
import { AEO_ANSWER_BANK } from "@/lib/seo/aeo/answer-bank";
import { AUTHORITY_CHAINS } from "@/lib/seo/aeo/authority-chains";
import {
  assertPublicCommercialClassification,
  toPublicAnswerRecord,
  toPublicAuthorityChain,
} from "@/lib/seo/aeo/public-answer-sanitizer";
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

/** Machine-readable answer feed for LLMs / answer engines. */
export function GET() {
  const price = assertVerifiedClaim(PRICE_CLAIM, "PRICE_CLAIM");
  const publicChains = AUTHORITY_CHAINS.map(toPublicAuthorityChain);
  const publicAnswers = AEO_ANSWER_BANK.map(toPublicAnswerRecord);

  const body = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "CBAMValid Self-Service Software Answer Feed",
    description:
      "Machine-readable product, workflow, calculation and methodology answers for CBAMValid self-service B2B software.",
    url: buildCanonicalUrl("/answers.json"),
    creator: {
      "@type": "Organization",
      name: siteConfig.siteName,
      url: siteConfig.canonicalOrigin,
      email: assertVerifiedClaim(SUPPORT_EMAIL_CLAIM, "SUPPORT_EMAIL_CLAIM"),
    },
    license: "https://creativecommons.org/licenses/by/4.0/",
    creditText: "CBAMValid (cbamvalid.com)",
    dateModified: "2026-08-13",
    product: {
      name: assertVerifiedClaim(PRODUCT_POSITIONING_CLAIM, "PRODUCT_POSITIONING_CLAIM"),
      productType: "Self-service B2B software",
      price: price.formatted,
      billing: "One-time working-file software unlock",
      delivery: "Automated PDF, JSON and XLSX files",
      independence: assertVerifiedClaim(INDEPENDENCE_CLAIM, "INDEPENDENCE_CLAIM"),
    },
    authorityChains: publicChains.map((chain) => ({
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
    answers: publicAnswers.map((answer) => ({
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
    commercialBoundary: {
      customerControlsData: true,
      automatedDigitalDelivery: true,
      humanServicesBundled: false,
    },
  };

  assertPublicCommercialClassification(body, "app/answers.json/route.ts");

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "Content-Type": "application/ld+json; charset=utf-8",
    },
  });
}
