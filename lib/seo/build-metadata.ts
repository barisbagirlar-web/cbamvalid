import type { Metadata } from "next";
import { siteConfig } from "@/lib/site-config";
import { buildCanonicalUrl } from "./canonical";
import { getSeoRoute } from "./registry";

export function generateSeoMetadata(path: string): Metadata {
  const meta = getSeoRoute(path);

  if (!meta) {
    // Unknown public routes fail closed to noindex — never silent index defaults.
    return {
      title: siteConfig.defaultTitle,
      description: siteConfig.defaultDescription,
      robots: { index: false, follow: false, noarchive: true, nosnippet: true },
    };
  }

  const canonical = buildCanonicalUrl(meta.canonicalPath);
  const indexable = meta.indexability === "index";

  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical,
    },
    robots: {
      index: indexable,
      follow: indexable,
      noarchive: !indexable,
      nosnippet: !indexable,
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: canonical,
      siteName: siteConfig.siteName,
      images: [
        {
          url: siteConfig.ogImage,
          width: 1200,
          height: 630,
          alt: meta.title,
        },
      ],
      locale: siteConfig.locale,
      type: meta.pageType === "methodology" || meta.pageType === "guide" ? "article" : "website",
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
      images: [siteConfig.ogImage],
    },
  };
}
