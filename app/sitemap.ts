import type { MetadataRoute } from "next";
import { buildCanonicalUrl } from "@/lib/seo/canonical";
import { listSitemapRoutes } from "@/lib/seo/registry";

/**
 * Sitemap is a derived artifact of the SEO route registry.
 * No priority / changeFrequency. lastModified only when factual.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return listSitemapRoutes().map((route) => {
    const entry: MetadataRoute.Sitemap[number] = {
      url: buildCanonicalUrl(route.canonicalPath),
    };
    if (route.factualLastModified) {
      entry.lastModified = new Date(route.factualLastModified);
    }
    return entry;
  });
}
