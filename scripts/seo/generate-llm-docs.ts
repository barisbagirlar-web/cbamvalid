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
import { INDEXNOW_KEY, INDEXNOW_KEY_PATH } from "../../lib/seo/indexnow";

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

/** Hosting-safe sitemap index — Next multi-sitemap children live at /sitemap/{id}.xml */
export function renderSitemapIndexXml(origin: string = siteConfig.canonicalOrigin): string {
  const lastmod = new Date().toISOString();
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    `  <sitemap>`,
    `    <loc>${origin}/sitemap/0.xml</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `  </sitemap>`,
    `  <sitemap>`,
    `    <loc>${origin}/sitemap/1.xml</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `  </sitemap>`,
    `  <sitemap>`,
    `    <loc>${origin}/sitemap/2.xml</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `  </sitemap>`,
    `</sitemapindex>`,
    "",
  ].join("\n");
}

const root = resolve(process.cwd());
const model = buildLlmDocModel();
const llms = renderLlmsTxt(model);
const full = renderLlmsFullTxt(model);
const robots = renderRobotsTxt();
const sitemapIndex = renderSitemapIndexXml();

writeFileSync(resolve(root, "public/llms.txt"), llms, "utf8");
writeFileSync(resolve(root, "public/llm.txt"), llms, "utf8");
writeFileSync(resolve(root, "public/llms-full.txt"), full, "utf8");
writeFileSync(resolve(root, "public/robots.txt"), robots, "utf8");
writeFileSync(resolve(root, "public/sitemap.xml"), sitemapIndex, "utf8");

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

// IndexNow key file (must match keyLocation published to Bing / IndexNow).
writeFileSync(resolve(root, `public${INDEXNOW_KEY_PATH}`), `${INDEXNOW_KEY}\n`, "utf8");

// RSS feed — syndication + AI crawler friendly answer stream
function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const rssItems = AEO_ANSWER_BANK.map((answer) => {
  const link = buildCanonicalUrl(answer.routes[0] ?? "/");
  return [
    "    <item>",
    `      <title>${xmlEscape(answer.question)}</title>`,
    `      <link>${link}</link>`,
    `      <guid isPermaLink="false">${xmlEscape(answer.id)}</guid>`,
    `      <description>${xmlEscape(`${answer.directAnswer} ${answer.empathyContext}`)}</description>`,
    `      <category>${xmlEscape(answer.routes.join(", "))}</category>`,
    "    </item>",
  ].join("\n");
}).join("\n");

const rss = [
  `<?xml version="1.0" encoding="UTF-8"?>`,
  `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">`,
  `  <channel>`,
  `    <title>CBAMValid Answer Feed</title>`,
  `    <link>${siteConfig.canonicalOrigin}</link>`,
  `    <description>Direct answers for CBAM exporter verification preparation — machine-readable syndication for answer engines.</description>`,
  `    <language>en</language>`,
  `    <lastBuildDate>${new Date(model.lastUpdated).toUTCString()}</lastBuildDate>`,
  `    <atom:link href="${siteConfig.canonicalOrigin}/answers.rss" rel="self" type="application/rss+xml"/>`,
  rssItems,
  `  </channel>`,
  `</rss>`,
  "",
].join("\n");
writeFileSync(resolve(root, "public/answers.rss"), rss, "utf8");

// JSON Feed 1.1 — preferred by many AI/news aggregators over RSS alone
const jsonFeed = {
  version: "https://jsonfeed.org/version/1.1",
  title: "CBAMValid Answer Feed",
  home_page_url: siteConfig.canonicalOrigin,
  feed_url: `${siteConfig.canonicalOrigin}/answers.feed.json`,
  description:
    "Direct answers for CBAM exporter verification preparation — machine-readable syndication for answer engines.",
  language: "en",
  authors: [{ name: siteConfig.siteName, url: siteConfig.canonicalOrigin }],
  items: AEO_ANSWER_BANK.map((answer) => ({
    id: answer.id,
    url: `${siteConfig.canonicalOrigin}/answers#${answer.id}`,
    title: answer.question,
    content_text: `${answer.directAnswer}\n\n${answer.empathyContext}`,
    tags: [...answer.routes],
  })),
};
writeFileSync(resolve(root, "public/answers.feed.json"), `${JSON.stringify(jsonFeed, null, 2)}\n`, "utf8");

console.log(
  "Generated public/llms.txt, public/llm.txt, public/llms-full.txt, public/robots.txt, public/sitemap.xml, public/.well-known/ai.txt, public/ai-policy.txt, public/answers.json, public/answers.rss, public/answers.feed.json, IndexNow key from SEO SSOT",
);
