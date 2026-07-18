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

  const metadata: Metadata = {
    title: meta.title,
    description: meta.description,
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

  const pathPart = meta.canonicalPath === "/" ? "" : meta.canonicalPath;
  // PHASE 2: x-default hreflang anchors global audience to English canonical
  metadata.alternates = {
    canonical: `${siteConfig.canonicalOrigin}${meta.canonicalPath}`,
    languages: {
      "en": `${siteConfig.canonicalOrigin}${meta.canonicalPath}`,
      "de": `${siteConfig.canonicalOrigin}/de${pathPart}`,
      "fr": `${siteConfig.canonicalOrigin}/fr${pathPart}`,
      "x-default": `${siteConfig.canonicalOrigin}${meta.canonicalPath}`,
    },
  };

  return metadata;
}
