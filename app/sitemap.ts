import type { MetadataRoute } from "next";
import { buildCanonicalUrl } from "@/lib/seo/canonical";
import { listSitemapRoutes } from "@/lib/seo/registry";
import type { SeoRouteContract } from "@/lib/seo/types";

/**
 * Sitemap is a deterministic derived artifact of the SEO route registry.
 * No priority / changeFrequency. lastModified only when factual.
 */
export function buildSitemapEntries(
  routes: readonly SeoRouteContract[] = listSitemapRoutes(),
): MetadataRoute.Sitemap {
  return [...routes]
    .sort((left, right) => left.canonicalPath.localeCompare(right.canonicalPath))
    .map((route) => {
      const entry: MetadataRoute.Sitemap[number] = {
        url: buildCanonicalUrl(route.canonicalPath),
      };
      if (route.factualLastModified) {
        entry.lastModified = new Date(`${route.factualLastModified}T00:00:00.000Z`);
      }
      return entry;
    });
}

export default function sitemap(): MetadataRoute.Sitemap {
  return buildSitemapEntries();
}
