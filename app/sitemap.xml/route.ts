import sitemapFn from "@/lib/seo/sitemap-helper";

export const dynamic = "force-static";

export async function GET() {
  const entries = sitemapFn();

  const xmlUrls = entries
    .map((entry) => {
      // Format to ISO 8601 tam format (2026-07-15T19:39:01.944Z)
      const rawDate = entry.lastModified;
      const lastmodDate = rawDate ? new Date(rawDate) : new Date();
      const formattedDate = lastmodDate.toISOString();

      const url = entry.url;
      let priority = "0.80";
      let changefreq = "weekly";

      if (url === "https://cbamvalid.com/") {
        priority = "1.00";
        changefreq = "weekly";
      } else if (
        url.includes("/privacy") ||
        url.includes("/terms") ||
        url.includes("/refund-policy") ||
        url.includes("/cookie-policy") ||
        url.includes("/legal-notice") ||
        url.includes("/cn-code") ||
        url.includes("/verify") ||
        url.includes("/sample-dossier")
      ) {
        priority = "0.60";
        changefreq = "monthly";
      }

      return `  <url>
    <loc>${url}</loc>
    <lastmod>${formattedDate}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
    })
    .join("\n");

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlUrls}
</urlset>`;

  return new Response(sitemapXml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=43200",
    },
  });
}
