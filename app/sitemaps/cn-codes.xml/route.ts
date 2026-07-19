import { CN_CODE_REGISTRY } from '@/lib/cbam/cn-codes/cn-code-registry';
import { buildUrlsetStream, sitemapStreamResponse, safeLastMod, deduplicateUrls } from '@/lib/seo/sitemap-guards';

export const dynamic = 'force-static';

export async function GET() {
  const urls: { url: string; lastmod: string }[] = [];

  for (const entry of CN_CODE_REGISTRY) {
    const lastmod = safeLastMod(entry.contentLastModified);
    urls.push({ url: `https://cbamvalid.com/cn-codes/${entry.code}`, lastmod });
    urls.push({ url: `https://cbamvalid.com/cn-codes/${entry.code}/${entry.sector}`, lastmod });
  }

  // MIL-STD §1.3: deduplicate (SHA-256 normalization)
  const { clean } = deduplicateUrls(urls);

  // MIL-STD §5.0 I5: Stream-based generation — O(1) memory
  const stream = buildUrlsetStream(clean, { previousGoodCount: CN_CODE_REGISTRY.length * 2 });
  if (!stream) return sitemapStreamResponse(new ReadableStream({ start(c) { c.close(); } }));

  return sitemapStreamResponse(stream);
}
