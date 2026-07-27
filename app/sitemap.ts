import type { MetadataRoute } from "next";
import { buildCanonicalUrl } from "@/lib/seo/canonical";
import { listSitemapRoutes } from "@/lib/seo/registry";
import { siteConfig } from "@/lib/site-config";

/**
 * Multi-sitemap index (enterprise crawl budget control):
 * id 0 = pages (marketing + guides + hubs)
 * id 1 = cn detail pages
 * id 2 = brand / OG images
 *
 * Next.js emits /sitemap.xml index → /sitemap/0.xml … /sitemap/2.xml
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
