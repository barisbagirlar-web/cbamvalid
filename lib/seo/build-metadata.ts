import type { Metadata } from "next";
import { siteConfig } from "@/lib/site-config";
import { buildCanonicalUrl } from "./canonical";
import { getSeoRoute } from "./registry";

const COMMERCIAL_METADATA_OVERRIDES: Readonly<
  Record<string, { title: string; description: string }>
> = {
  "/": {
    title: "CBAMValid — Self-Service Emissions Data Software",
    description:
      "B2B self-service software for customer-entered emissions data, deterministic calculations, automated quality controls, and automated PDF, JSON and XLSX delivery.",
  },
  "/product": {
    title: "CBAMValid Product | Self-Service Emissions Data Software",
    description:
      "Customer-controlled B2B software for emissions data, deterministic calculations, automated quality controls, and automated PDF, JSON and XLSX delivery.",
  },
  "/pricing": {
    title: "Pricing | USD 449 Working File Software Unlock | CBAMValid",
    description:
      "USD 449 one-time software unlock for one customer-controlled working file with automated calculations, quality controls and PDF, JSON and XLSX delivery.",
  },
  "/sample-dossier": {
    title: "Sample Automated Digital Output | CBAMValid Software",
    description:
      "Preview an automated CBAMValid software output with PDF, structured data, workbook, integrity manifest and customer-controlled evidence links.",
  },
};

export function generateSeoMetadata(path: string): Metadata {
  const meta = getSeoRoute(path);

  if (!meta) {
    return {
      title: siteConfig.defaultTitle,
      description: siteConfig.defaultDescription,
      robots: { index: false, follow: false, noarchive: true, nosnippet: true },
    };
  }

  const override = COMMERCIAL_METADATA_OVERRIDES[path];
  const title = override?.title ?? meta.title;
  const description = override?.description ?? meta.description;
  const canonical = buildCanonicalUrl(meta.canonicalPath);
  const indexable = meta.indexability === "index";

  return {
    title,
    description,
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
      title,
      description,
      url: canonical,
      siteName: siteConfig.siteName,
      images: [
        {
          url: siteConfig.ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      locale: siteConfig.locale,
      type: meta.pageType === "methodology" || meta.pageType === "guide" ? "article" : "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [siteConfig.ogImage],
    },
  };
}
