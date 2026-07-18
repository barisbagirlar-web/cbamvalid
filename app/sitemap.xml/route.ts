import { SECTOR_DETAILS } from '@/lib/cbam/sectors/sector-content';
import { CN_CODE_REGISTRY } from '@/lib/cbam/cn-codes/cn-code-registry';

export const dynamic = 'force-static';

/**
 * Content-derived lastmod computation for sitemap index.
 * Each sub-sitemap entry gets the most recent contentLastModified from its
 * underlying data registry — never a build-time artifact.
 */
function getMaxTimestamp(dates: string[]): string {
  const sorted = dates.filter(Boolean).sort().reverse();
  return sorted[0] ?? new Date().toISOString();
}

export async function GET() {
  const toolsLastmod = '2026-07-18T00:00:00Z';
  const sectorsLastmod = getMaxTimestamp(Object.values(SECTOR_DETAILS).map(s => s.contentLastModified));
  const cnCodesLastmod = getMaxTimestamp(CN_CODE_REGISTRY.map(e => e.contentLastModified));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://cbamvalid.com/sitemaps/tools.xml</loc>
    <lastmod>${toolsLastmod}</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://cbamvalid.com/sitemaps/sectors.xml</loc>
    <lastmod>${sectorsLastmod}</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://cbamvalid.com/sitemaps/cn-codes.xml</loc>
    <lastmod>${cnCodesLastmod}</lastmod>
  </sitemap>
</sitemapindex>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
