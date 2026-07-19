import { SECTOR_DETAILS } from '@/lib/cbam/sectors/sector-content';
import { CN_CODE_REGISTRY } from '@/lib/cbam/cn-codes/cn-code-registry';
import { buildSitemapIndexXml, sitemapResponse, safeLastMod, deduplicateUrls } from '@/lib/seo/sitemap-guards';

export const dynamic = 'force-static';

/**
 * MIL-STD §1.2: Content-derived lastmod with monotonic MAX(contentDate, epoch) guard.
 * MIL-STD §1.4: Empty sitemap index blocked — 503 returned instead of destructive empty XML.
 * MIL-STD §1.3: Child sitemap entries deduplicated.
 */
function getMaxTimestamp(dates: string[]): string {
  const sorted = dates.filter(Boolean).sort().reverse();
  return safeLastMod(sorted[0] ?? new Date().toISOString());
}

export async function GET() {
  const toolsLastmod = safeLastMod('2026-07-18T00:00:00Z');
  const sectorsLastmod = getMaxTimestamp(Object.values(SECTOR_DETAILS).map(s => s.contentLastModified));
  const cnCodesLastmod = getMaxTimestamp(CN_CODE_REGISTRY.map(e => e.contentLastModified));

  // §1.3: Dedup child sitemap entries
  const entries = deduplicateUrls([
    { url: 'https://cbamvalid.com/sitemaps/tools.xml', lastmod: toolsLastmod },
    { url: 'https://cbamvalid.com/sitemaps/sectors.xml', lastmod: sectorsLastmod },
    { url: 'https://cbamvalid.com/sitemaps/cn-codes.xml', lastmod: cnCodesLastmod },
  ]).clean;

  const xml = buildSitemapIndexXml(
    entries.map(e => ({ loc: e.url, lastmod: e.lastmod })),
  );

  return sitemapResponse(xml);
}
