import sitemapFn from "@/lib/seo/sitemap-helper";

export const dynamic = "force-static";

export async function GET() {
  const entries = sitemapFn();

  const xmlUrls = entries
    .map((entry) => {
      // Format to YYYY-MM-DD exactly (L2 lastmod standard)
      const rawDate = entry.lastModified;
      const lastmodDate = rawDate ? new Date(rawDate) : new Date();
      const year = lastmodDate.getUTCFullYear();
      const month = String(lastmodDate.getUTCMonth() + 1).padStart(2, "0");
      const day = String(lastmodDate.getUTCDate()).padStart(2, "0");
      const formattedDate = `${year}-${month}-${day}`;

      const url = entry.url;
      let priority = "0.8";
      let changefreq = "weekly";

      if (url === "https://cbamvalid.com/") {
        priority = "1.0";
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
        priority = "0.6";
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
