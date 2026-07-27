import type { MetadataRoute } from "next";
import { buildCanonicalUrl } from "@/lib/seo/canonical";
import { listSitemapRoutes } from "@/lib/seo/registry";

/**
 * Single sitemap.xml for Firebase Frameworks Hosting + Next.js App Router.
 * Multi-id sitemaps 404'd on the live SSR runtime; keep one crawlable index.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return listSitemapRoutes().map((route) => ({
    url: buildCanonicalUrl(route.canonicalPath),
    ...(route.factualLastModified
      ? { lastModified: new Date(route.factualLastModified) }
      : {}),
  }));
}
