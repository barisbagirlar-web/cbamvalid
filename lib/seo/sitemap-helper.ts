import { MetadataRoute } from "next";
import { seoRegistry } from "./registry";
import sitemapDates from "./sitemap-dates.json";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://cbamvalid.com";

  // Dynamic route parity from seoRegistry (L7 compliance)
  const registryEntries = Object.entries(seoRegistry)
    .filter(([_, meta]) => meta.indexable)
    .map(([route, meta]) => {
      // Find dynamic date in generated dates json or fallback to dateModified
      const lastModStr = sitemapDates[route as keyof typeof sitemapDates] || meta.dateModified || new Date().toISOString();
      return {
        url: `${baseUrl}${route === "/" ? "" : route}`,
        lastModified: new Date(lastModStr),
      };
    });

  // Dynamic CN Code entries to guarantee coverage (L7 compliance)
  const validCnCodes = ["72085120", "76011000", "25231000", "31021010", "28041000"];
  const cnCodeEntries = validCnCodes.map((code) => {
    const route = `/cn-code/${code}`;
    const lastModStr = sitemapDates[route as keyof typeof sitemapDates] || new Date().toISOString();
    return {
      url: `${baseUrl}${route}`,
      lastModified: new Date(lastModStr),
    };
  });

  return [...registryEntries, ...cnCodeEntries];
}
