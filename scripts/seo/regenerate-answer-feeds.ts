/**
 * Regenerate public answer feeds from the AEO SSOTs:
 *   public/answers.json        — Dataset (authority chains + answer bank)
 *   public/answers.rss         — RSS 2.0 feed
 *   public/answers.feed.json   — JSON Feed 1.1
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { AUTHORITY_CHAINS } from "../../lib/seo/aeo/authority-chains";
import type { AuthorityChainRecord } from "../../lib/seo/aeo/types";
import { AEO_ANSWER_BANK } from "../../lib/seo/aeo/answer-bank";
import type { AeoAnswerRecord } from "../../lib/seo/aeo/types";
import {
  assertPublicCommercialClassification,
  toPublicAnswerRecord,
  toPublicAuthorityChain,
} from "../../lib/seo/aeo/public-answer-sanitizer";
import { siteConfig } from "../../lib/site-config";
import { CANONICAL_PRICING } from "../../lib/billing/pricing-config";
import { LEGAL_IDENTITY } from "../../lib/legal-identity";

const root = resolve(process.cwd());
const origin = siteConfig.canonicalOrigin;
const publicAnswers = AEO_ANSWER_BANK.map(toPublicAnswerRecord);
const publicChains = AUTHORITY_CHAINS.map(toPublicAuthorityChain);
const FEED_LICENSE = "https://creativecommons.org/licenses/by/4.0/" as const;
const FEED_CREDIT = "CBAMValid (cbamvalid.com)" as const;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function routeHref(path: string): string {
  return path === "/" ? origin : `${origin}${path}`;
}

function answerContentText(a: AeoAnswerRecord): string {
  return `${a.directAnswer}\n\n${a.empathyContext}`;
}

function buildRss(items: readonly AeoAnswerRecord[]): string {
  const channel = items
    .map(
      (a) => `    <item>\n      <title>${escapeXml(a.question)}</title>\n      <link>${escapeXml(routeHref(a.routes[0] ?? "/"))}</link>\n      <guid isPermaLink="false">${escapeXml(a.id)}</guid>\n      <description>${escapeXml(answerContentText(a))}</description>\n      <category>${escapeXml(a.routes.join(", "))}</category>\n    </item>`
    )
    .join("\n");

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:cc="http://creativecommons.org/ns#">
  <channel>
    <title>CBAMValid Self-Service Software Answer Feed</title>
    <link>${origin}</link>
    <description>Product, workflow, calculation and methodology answers for CBAMValid self-service B2B software.</description>
    <language>en</language>
    <copyright>${escapeXml(FEED_CREDIT)} — CC BY 4.0</copyright>
    <cc:license>${FEED_LICENSE}</cc:license>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${origin}/answers.rss" rel="self" type="application/rss+xml"/>
${channel}
  </channel>
</rss>
`;
  assertPublicCommercialClassification(rss, "public/answers.rss");
  return rss;
}

function buildJsonFeed(items: readonly AeoAnswerRecord[]): string {
  const feedItems = items.map((a) => ({
    id: a.id,
    url: `${origin}/answers#${a.id}`,
    title: a.question,
    content_text: answerContentText(a),
    tags: [...a.routes],
  }));
  const feed = {
    version: "https://jsonfeed.org/version/1.1",
    title: "CBAMValid Self-Service Software Answer Feed",
    home_page_url: origin,
    feed_url: `${origin}/answers.feed.json`,
    description: "Product, workflow, calculation and methodology answers for CBAMValid self-service B2B software.",
    language: "en",
    authors: [{ name: "CBAMValid", url: origin }],
    _license: FEED_LICENSE,
    _creditText: FEED_CREDIT,
    items: feedItems,
  };
  assertPublicCommercialClassification(feed, "public/answers.feed.json");
  return `${JSON.stringify(feed, null, 2)}\n`;
}

function buildDatasetJson(chains: readonly AuthorityChainRecord[], items: readonly AeoAnswerRecord[]): string {
  const dataset = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "CBAMValid Self-Service Software Answer Feed",
    description: "Machine-readable product, workflow, calculation and methodology answers for CBAMValid self-service B2B software.",
    url: `${origin}/answers.json`,
    creator: { "@type": "Organization", name: "CBAMValid", url: origin, email: LEGAL_IDENTITY.supportEmail },
    license: FEED_LICENSE,
    creditText: FEED_CREDIT,
    product: {
      name: CANONICAL_PRICING.packName,
      productType: "Self-service B2B software",
      price: CANONICAL_PRICING.priceFormatted,
      currency: CANONICAL_PRICING.currency,
      billing: "One-time working-file software unlock",
      delivery: "Automated PDF, JSON and XLSX files",
      customerControlsData: true,
      description: CANONICAL_PRICING.description,
    },
    authorityChains: chains,
    answers: items,
    commercialBoundary: { customerControlsData: true, automatedDigitalDelivery: true, humanServicesBundled: false },
  };
  assertPublicCommercialClassification(dataset, "public/answers.json");
  return `${JSON.stringify(dataset, null, 2)}\n`;
}

writeFileSync(resolve(root, "public/answers.json"), buildDatasetJson(publicChains, publicAnswers), "utf8");
writeFileSync(resolve(root, "public/answers.rss"), buildRss(publicAnswers), "utf8");
writeFileSync(resolve(root, "public/answers.feed.json"), buildJsonFeed(publicAnswers), "utf8");
console.log("Regenerated licensed CBAMValid public answer feeds");
