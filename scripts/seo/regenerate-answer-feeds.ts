/**
 * Regenerate public answer feeds from the AEO SSOTs:
 *   public/answers.json        — Dataset (authority chains + answer bank)
 *   public/answers.rss         — RSS 2.0 feed
 *   public/answers.feed.json   — JSON Feed 1.1
 *
 * Run: npx tsx scripts/seo/regenerate-answer-feeds.ts
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { AUTHORITY_CHAINS } from "../../lib/seo/aeo/authority-chains";
import type { AuthorityChainRecord } from "../../lib/seo/aeo/types";
import { AEO_ANSWER_BANK } from "../../lib/seo/aeo/answer-bank";
import type { AeoAnswerRecord } from "../../lib/seo/aeo/types";
import { siteConfig } from "../../lib/site-config";
import { CANONICAL_PRICING } from "../../lib/billing/pricing-config";
import { LEGAL_IDENTITY } from "../../lib/legal-identity";

const root = resolve(process.cwd());
const origin = siteConfig.canonicalOrigin;

function routeHref(path: string): string {
  return path === "/" ? origin : `${origin}${path}`;
}

function answerContentText(a: AeoAnswerRecord): string {
  return `${a.directAnswer}\n\n${a.empathyContext}`;
}

function buildRss(items: readonly AeoAnswerRecord[]): string {
  const channel = items
    .map(
      (a) => `    <item>
      <title>${a.question}</title>
      <link>${routeHref(a.routes[0] ?? "/")}</link>
      <guid isPermaLink="false">${a.id}</guid>
      <description>${answerContentText(a)}</description>
      <category>${a.routes.join(", ")}</category>
    </item>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>CBAMValid Answer Feed</title>
    <link>${origin}</link>
    <description>Direct answers for CBAM exporter verification preparation — machine-readable syndication for answer engines.</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${origin}/answers.rss" rel="self" type="application/rss+xml"/>
${channel}
  </channel>
</rss>
`;
}

function buildJsonFeed(items: readonly AeoAnswerRecord[]): string {
  const feedItems = items.map((a) => ({
    id: a.id,
    url: `${origin}/answers#${a.id}`,
    title: a.question,
    content_text: answerContentText(a),
    tags: [...a.routes],
  }));

  return `${JSON.stringify(
    {
      version: "https://jsonfeed.org/version/1.1",
      title: "CBAMValid Answer Feed",
      home_page_url: origin,
      feed_url: `${origin}/answers.feed.json`,
      description:
        "Direct answers for CBAM exporter verification preparation — machine-readable syndication for answer engines.",
      language: "en",
      authors: [{ name: "CBAMValid", url: origin }],
      items: feedItems,
    },
    null,
    2
  )}\n`;
}

function buildDatasetJson(
  chains: readonly AuthorityChainRecord[],
  items: readonly AeoAnswerRecord[]
): string {
  return `${JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: "CBAMValid Answer Engine Authority Feed",
      description:
        "Canonical Direct Answer → Calculation → Explanation → Methodology → Evidence → Expert chains plus Answer+Evidence bank for CBAMValid public URLs.",
      url: `${origin}/answers.json`,
      creator: {
        "@type": "Organization",
        name: "CBAMValid",
        url: origin,
        email: LEGAL_IDENTITY.supportEmail,
      },
      license:
        "Informational product documentation — not legal advice or accredited verification",
      dateModified: new Date().toISOString().slice(0, 10),
      product: {
        name: `${CANONICAL_PRICING.packName} — ${CANONICAL_PRICING.description}`,
        price: CANONICAL_PRICING.priceFormatted,
        independence:
          "CBAMValid is an independent software service for exporter-to-importer evidence packaging. It is not an EU institution, customs authority, or accredited CBAM verifier. Actual emissions data must be independently verified where verification is legally required.",
      },
      authorityChains: chains,
      answers: items,
      nonClaims: [
        "Not an accredited verification opinion",
        "Not an official European Commission or CBAM Registry service",
        "No fabricated Review / AggregateRating nodes",
      ],
    },
    null,
    2
  )}\n`;
}

writeFileSync(
  resolve(root, "public/answers.json"),
  buildDatasetJson(AUTHORITY_CHAINS, AEO_ANSWER_BANK),
  "utf8"
);
writeFileSync(
  resolve(root, "public/answers.rss"),
  buildRss([...AEO_ANSWER_BANK]),
  "utf8"
);
writeFileSync(
  resolve(root, "public/answers.feed.json"),
  buildJsonFeed([...AEO_ANSWER_BANK]),
  "utf8"
);

console.log(
  "Regenerated public/answers.json, public/answers.rss, public/answers.feed.json from AEO SSOT"
);
