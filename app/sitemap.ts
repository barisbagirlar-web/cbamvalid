import type { MetadataRoute } from "next";

const BASE_URL = "https://cbamvalid.com";
/** Keep in sync with public/sitemap.xml lastmod when publishing IA changes. */
const LAST_MOD = new Date("2026-07-26T00:00:00.000Z");

type Freq = MetadataRoute.Sitemap[number]["changeFrequency"];

type RouteSpec = {
  path: string;
  changeFrequency: Freq;
  priority: number;
};

const PUBLIC_ROUTES: RouteSpec[] = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/product", changeFrequency: "weekly", priority: 0.9 },
  { path: "/pricing", changeFrequency: "weekly", priority: 0.9 },
  { path: "/sample-dossier", changeFrequency: "weekly", priority: 0.9 },
  { path: "/how-it-works", changeFrequency: "weekly", priority: 0.8 },
  { path: "/methodology", changeFrequency: "weekly", priority: 0.8 },
  { path: "/cn-code", changeFrequency: "weekly", priority: 0.8 },
  { path: "/verify", changeFrequency: "monthly", priority: 0.7 },
  { path: "/about", changeFrequency: "monthly", priority: 0.7 },
  { path: "/contact", changeFrequency: "yearly", priority: 0.5 },
  { path: "/cookie-policy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/legal-notice", changeFrequency: "yearly", priority: 0.3 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/refund-policy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
];

/** Representative CN codes across all six CBAM sectors. */
const CN_CODES = [
  "72011011", // Pig iron (Iron & Steel)
  "72085120", // Flat-rolled products (Iron & Steel)
  "76011000", // Unwrought aluminum (Aluminum)
  "25231000", // Cement clinkers (Cement)
  "25232900", // Portland cement (Cement)
  "31021010", // Urea (Fertilizers)
  "28080000", // Nitric acid (Fertilizers)
  "28041000", // Hydrogen (Hydrogen)
  "27160000", // Electrical energy (Electricity)
];

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = PUBLIC_ROUTES.map((route) => ({
    url: `${BASE_URL}${route.path}`,
    lastModified: LAST_MOD,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const cnEntries = CN_CODES.map((code) => ({
    url: `${BASE_URL}/cn-code/${code}`,
    lastModified: LAST_MOD,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [...routes, ...cnEntries];
}
