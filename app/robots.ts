import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site-config";

/**
 * Central robots contract. Do not block /_next/static or other render assets.
 * OAI-SearchBot is explicit for ChatGPT Search; GPTBot is a separate training crawler.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard/",
          "/admin/",
          "/api/",
          "/cases/",
          "/reports/",
          "/account/",
          "/credits/",
          "/cbam/",
          "/login",
          "/register",
        ],
      },
      {
        userAgent: "OAI-SearchBot",
        allow: "/",
        disallow: [
          "/dashboard/",
          "/admin/",
          "/api/",
          "/cases/",
          "/reports/",
          "/account/",
          "/credits/",
          "/cbam/",
          "/login",
          "/register",
        ],
      },
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: [
          "/dashboard/",
          "/admin/",
          "/api/",
          "/cases/",
          "/reports/",
          "/account/",
          "/credits/",
          "/cbam/",
          "/login",
          "/register",
        ],
      },
      {
        userAgent: "GPTBot",
        allow: "/",
      },
      {
        userAgent: "ClaudeBot",
        allow: "/",
      },
      {
        userAgent: "Google-Extended",
        allow: "/",
      },
    ],
    sitemap: `${siteConfig.canonicalOrigin}/sitemap.xml`,
    host: siteConfig.canonicalOrigin,
  };
}
