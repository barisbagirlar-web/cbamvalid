import type { MetadataRoute } from "next";
import { buildCanonicalUrl } from "@/lib/seo/canonical";
import { listSitemapRoutes } from "@/lib/seo/registry";
import { siteConfig } from "@/lib/site-config";

const BRAND_LASTMOD = new Date("2026-07-28");

/**
 * Multi-sitemap segments (crawl-budget split):
 * id 0 = pages, id 1 = CN details, id 2 = brand / OG / favicon assets
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
    const brandUrls = [
      siteConfig.ogImage,
      `${siteConfig.canonicalOrigin}/brand/cbamvalid-mark.svg`,
      `${siteConfig.canonicalOrigin}/brand/cbamvalid-lockup.svg`,
      `${siteConfig.canonicalOrigin}/favicon.svg`,
      `${siteConfig.canonicalOrigin}/favicon.ico`,
      `${siteConfig.canonicalOrigin}/favicon-32.png`,
      `${siteConfig.canonicalOrigin}/apple-touch-icon.png`,
      `${siteConfig.canonicalOrigin}/icon-192.png`,
      `${siteConfig.canonicalOrigin}/icon-512.png`,
      `${siteConfig.canonicalOrigin}/site.webmanifest`,
    ];
    return brandUrls.map((url) => ({
      url,
      lastModified: BRAND_LASTMOD,
    }));
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
