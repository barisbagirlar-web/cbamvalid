import { Metadata } from "next";
import { seoRegistry } from "./registry";
import { siteConfig } from "../site-config";

export function generateSeoMetadata(path: string): Metadata {
  const meta = seoRegistry[path];
  
  if (!meta) {
    // Fallback for unregistered paths (should ideally fail in CI)
    return {
      title: siteConfig.defaultTitle,
      description: siteConfig.defaultDescription,
      robots: { index: false, follow: false },
    };
  }

  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: meta.canonicalPath === "/" ? "https://cbamvalid.com/" : `${siteConfig.canonicalOrigin}${meta.canonicalPath}`,
    },
    robots: {
      index: meta.indexable,
      follow: meta.indexable,
      noarchive: !meta.indexable,
      nosnippet: !meta.indexable,
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: `${siteConfig.canonicalOrigin}${meta.canonicalPath}`,
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
