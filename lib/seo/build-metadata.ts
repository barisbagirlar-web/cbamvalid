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
  const isArticleSurface =
    meta.pageType === "methodology" || meta.pageType === "guide" || meta.path.startsWith("/cbam-");

  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical,
      types: {
        "text/plain": [
          { url: `${siteConfig.canonicalOrigin}/llms.txt`, title: "LLM index" },
          { url: `${siteConfig.canonicalOrigin}/.well-known/ai.txt`, title: "AI crawler policy" },
        ],
        "application/ld+json": [
          { url: `${siteConfig.canonicalOrigin}/answers.json`, title: "Answer authority feed" },
        ],
        "application/rss+xml": [
          { url: `${siteConfig.canonicalOrigin}/answers.rss`, title: "CBAMValid answers feed" },
        ],
      },
    },
    robots: {
      index: indexable,
      follow: indexable,
      noarchive: !indexable,
      nosnippet: !indexable,
      googleBot: indexable
        ? {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          }
        : {
            index: false,
            follow: false,
          },
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
      type: isArticleSurface ? "article" : "website",
      ...(isArticleSurface && meta.factualLastModified
        ? {
            publishedTime: meta.factualLastModified,
            modifiedTime: meta.factualLastModified,
            authors: [siteConfig.supportEmail],
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
      images: [siteConfig.ogImage],
    },
    other: {
      // Machine-readable discovery hints beyond standard alternates.
      "llms-txt": `${siteConfig.canonicalOrigin}/llms.txt`,
      "answer-feed": `${siteConfig.canonicalOrigin}/answers.json`,
    },
  };
}
