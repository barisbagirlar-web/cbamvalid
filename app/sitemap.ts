import type { MetadataRoute } from "next";
import { buildCanonicalUrl } from "@/lib/seo/canonical";
import { listSitemapRoutes } from "@/lib/seo/registry";
import { siteConfig } from "@/lib/site-config";

/**
 * Multi-sitemap segments (crawl-budget split):
 * id 0 = pages, id 1 = CN details, id 2 = brand/OG images
 *
 * Firebase Hosting returns HTML 404 for Next's generated /sitemap.xml index,
 * while /sitemap/{id}.xml works. A static public/sitemap.xml sitemapindex
 * (written by seo:generate-llm-docs) is the Hosting-safe index entry point.
 */
export async function generateSitemaps() {
  return [{ id: 0 }, { id: 1 }, { id: 2 }];
}

export default async function sitemap(props: {
  id: Promise<number> | number;
}): Promise<MetadataRoute.Sitemap> {
  const id = Number(await props.id);
  const routes = listSitemapRoutes();

  if (id === 1) {
    return routes
      .filter((route) => route.pageType === "cn-detail")
      .map((route) => ({
        url: buildCanonicalUrl(route.canonicalPath),
        ...(route.factualLastModified
          ? { lastModified: new Date(route.factualLastModified) }
          : {}),
      }));
  }

  if (id === 2) {
    return [
      {
        url: siteConfig.ogImage,
        lastModified: new Date("2026-07-27"),
      },
      {
        url: `${siteConfig.canonicalOrigin}/brand/cbamvalid-mark.svg`,
        lastModified: new Date("2026-07-27"),
      },
      {
        url: `${siteConfig.canonicalOrigin}/brand/cbamvalid-lockup.svg`,
        lastModified: new Date("2026-07-27"),
      },
    ];
  }

  return routes
    .filter((route) => route.pageType !== "cn-detail")
    .map((route) => ({
      url: buildCanonicalUrl(route.canonicalPath),
      ...(route.factualLastModified
        ? { lastModified: new Date(route.factualLastModified) }
        : {}),
    }));
}
