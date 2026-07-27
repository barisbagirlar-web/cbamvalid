import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { buildLlmDocModel, renderLlmsFullTxt, renderLlmsTxt } from "../../lib/seo/llm-doc-model";
import { renderAiTxt } from "../../lib/seo/ai-txt";
import { AEO_ANSWER_BANK } from "../../lib/seo/aeo/answer-bank";
import { AUTHORITY_CHAINS } from "../../lib/seo/aeo/authority-chains";
import { TOPICAL_MAP } from "../../lib/seo/aeo/topical-map";
import { buildCanonicalUrl } from "../../lib/seo/canonical";
import {
  INDEPENDENCE_CLAIM,
  PRICE_CLAIM,
  PRODUCT_POSITIONING_CLAIM,
  SUPPORT_EMAIL_CLAIM,
  assertVerifiedClaim,
} from "../../lib/seo/claims";
import { siteConfig } from "../../lib/site-config";

const DISALLOW_PRIVATE = [
  "/dashboard/",
  "/admin/",
  "/api/",
  "/cases/",
  "/reports/",
  "/account/",
  "/credits/",
  "/cbam/",
  "/login",
  "/register",
] as const;

/**
 * Must stay aligned with app/robots.ts.
 * Static public/robots.txt is required for Firebase Hosting reliability:
 * the frameworks Cloud Run adapter has returned empty 404 for /robots.txt
 * even when app/robots.ts prerenders successfully in the Next build.
 */
export function renderRobotsTxt(origin: string = siteConfig.canonicalOrigin): string {
  const lines: string[] = [];

  const emitAgent = (userAgent: string, withDisallow: boolean) => {
    lines.push(`User-Agent: ${userAgent}`);
    lines.push("Allow: /");
    if (withDisallow) {
      for (const path of DISALLOW_PRIVATE) {
        lines.push(`Disallow: ${path}`);
      }
    }
    lines.push("");
  };

  emitAgent("*", true);
  emitAgent("OAI-SearchBot", true);
  emitAgent("Googlebot", true);
  emitAgent("GPTBot", false);
  emitAgent("ClaudeBot", false);
  emitAgent("Google-Extended", false);

  lines.push(`Sitemap: ${origin}/sitemap.xml`);
  lines.push(`Host: ${origin}`);
  lines.push("");
  return lines.join("\n");
}

const root = resolve(process.cwd());
const model = buildLlmDocModel();
const llms = renderLlmsTxt(model);
const full = renderLlmsFullTxt(model);
const robots = renderRobotsTxt();

writeFileSync(resolve(root, "public/llms.txt"), llms, "utf8");
writeFileSync(resolve(root, "public/llm.txt"), llms, "utf8");
writeFileSync(resolve(root, "public/llms-full.txt"), full, "utf8");
writeFileSync(resolve(root, "public/robots.txt"), robots, "utf8");

const wellKnownDir = resolve(root, "public/.well-known");
mkdirSync(wellKnownDir, { recursive: true });
writeFileSync(resolve(wellKnownDir, "ai.txt"), renderAiTxt(), "utf8");
writeFileSync(resolve(root, "public/ai-policy.txt"), renderAiTxt(), "utf8");

const price = assertVerifiedClaim(PRICE_CLAIM, "PRICE_CLAIM");
const answersFeed = {
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
  dateModified: model.lastUpdated,
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
    routes: answer.routes,
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
writeFileSync(resolve(root, "public/answers.json"), `${JSON.stringify(answersFeed, null, 2)}\n`, "utf8");

console.log(
  "Generated public/llms.txt, public/llm.txt, public/llms-full.txt, public/robots.txt, public/.well-known/ai.txt, public/ai-policy.txt, public/answers.json from SEO SSOT",
);
