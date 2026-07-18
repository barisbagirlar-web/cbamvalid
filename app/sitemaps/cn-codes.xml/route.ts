import { CN_CODE_REGISTRY } from '@/lib/cbam/cn-codes/cn-code-registry';

export const dynamic = 'force-static';

export async function GET() {
  const urlsXml = CN_CODE_REGISTRY.map(entry => {
    // PHASE 3: Each CN code generates TWO URLs — the programmatic /[code] page
    // and the detailed /[code]/[sector] analysis page. Both are indexed.
    const codeUrl = `https://cbamvalid.com/cn-codes/${entry.code}`;
    const sectorUrl = `https://cbamvalid.com/cn-codes/${entry.code}/${entry.sector}`;
    return `  <url>
    <loc>${codeUrl}</loc>
    10|    <lastmod>${entry.contentLastModified}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.80</priority>
  </url>
  <url>
    <loc>${sectorUrl}</loc>
    <lastmod>${entry.contentLastModified}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.75</priority>
  </url>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlsXml}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
