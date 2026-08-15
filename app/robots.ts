import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site-config";

/**
 * Public crawl policy SSOT. The static Firebase fallback is generated/validated
 * from this contract by scripts/seo/sitemap-robots-sync-v6.ts.
 *
 * Do not replace /cbam/ with /cbam: public authority pages use /cbam-* and
 * must remain crawlable.
 */
export const PRIVATE_ROBOTS_DISALLOW = [
  "/dashboard/",
  "/cases/",
  "/reports/",
  "/account/",
  "/credits/",
  "/cbam/",
  "/login",
  "/register",
] as const;

export const PUBLIC_CRAWLER_USER_AGENTS = [
  "*",
  "OAI-SearchBot",
  "Googlebot",
  "GPTBot",
  "ChatGPT-User",
  "ClaudeBot",
  "anthropic-ai",
  "PerplexityBot",
  "Applebot-Extended",
  "Meta-ExternalAgent",
  "Amazonbot",
  "ByteDanceBot",
  "CCBot",
  "Google-Extended",
] as const;

export function buildRobotsPolicy(): MetadataRoute.Robots {
  return {
    rules: PUBLIC_CRAWLER_USER_AGENTS.map((userAgent) => ({
      userAgent,
      allow: "/",
      disallow: [...PRIVATE_ROBOTS_DISALLOW],
    })),
    sitemap: `${siteConfig.canonicalOrigin}/sitemap.xml`,
    host: siteConfig.canonicalOrigin,
  };
}

export default function robots(): MetadataRoute.Robots {
  return buildRobotsPolicy();
}
