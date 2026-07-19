import { SECTOR_DETAILS } from '@/lib/cbam/sectors/sector-content';
import { buildUrlsetStream, sitemapStreamResponse, safeLastMod, deduplicateUrls } from '@/lib/seo/sitemap-guards';

export const dynamic = 'force-static';

export async function GET() {
  const hubLastmod = safeLastMod('2026-07-18T00:00:00Z');

  const urls = [
    { url: 'https://cbamvalid.com/sectors', lastmod: hubLastmod },
    ...Object.keys(SECTOR_DETAILS).map(slug => ({
      url: `https://cbamvalid.com/sectors/${slug}`,
      lastmod: safeLastMod(SECTOR_DETAILS[slug].contentLastModified),
    })),
  ];

  // MIL-STD §1.3: deduplicate
  const { clean } = deduplicateUrls(urls);

  // MIL-STD §5.0 I5: Stream-based generation — O(1) memory, safe for scale
  const stream = buildUrlsetStream(clean, { previousGoodCount: urls.length });
  if (!stream) return sitemapStreamResponse(new ReadableStream({ start(c) { c.close(); } }));

  return sitemapStreamResponse(stream);
}
