import { buildUrlsetStream, sitemapStreamResponse, deduplicateUrls, fileLastMod } from '@/lib/seo/sitemap-guards';
import path from 'path';

export const dynamic = 'force-static';

/**
 * Content-derived lastmod from actual source file modification timestamps.
 * MIL-STD §1.1: Replaces hardcoded date tiers. Each tool page gets its
 * real file mtime, providing genuine freshness signals to Googlebot.
 */
const APP_PUBLIC = path.join(process.cwd(), 'app', '(public)');

const TOOLS_PAGES: { path: string; pageFile: string }[] = [
  { path: '/', pageFile: 'page.tsx' },
  { path: '/about', pageFile: 'about/page.tsx' },
  { path: '/methodology', pageFile: 'methodology/page.tsx' },
  { path: '/how-it-works', pageFile: 'how-it-works/page.tsx' },
  { path: '/pricing', pageFile: 'pricing/page.tsx' },
  { path: '/product', pageFile: 'product/page.tsx' },
  { path: '/contact', pageFile: 'contact/page.tsx' },
  { path: '/privacy', pageFile: 'privacy/page.tsx' },
  { path: '/terms', pageFile: 'terms/page.tsx' },
  { path: '/refund-policy', pageFile: 'refund-policy/page.tsx' },
  { path: '/cookie-policy', pageFile: 'cookie-policy/page.tsx' },
  { path: '/legal-notice', pageFile: 'legal-notice/page.tsx' },
  { path: '/sample-dossier', pageFile: 'sample-dossier/page.tsx' },
  { path: '/verify', pageFile: 'verify/page.tsx' },
  { path: '/cn-codes', pageFile: 'cn-codes/page.tsx' },
];

export async function GET() {
  const urls = TOOLS_PAGES.map(({ path: pagePath, pageFile }) => {
    const filePath = path.join(APP_PUBLIC, pageFile);
    // §1.1: Derive lastmod from actual file mtime, not hardcoded tier
    const lastmod = fileLastMod(filePath, '2026-07-18T00:00:00Z');
    return {
      url: `https://cbamvalid.com${pagePath === '/' ? '' : pagePath}`,
      lastmod,
    };
  });

  // MIL-STD §1.3: deduplicate before XML generation
  const { clean } = deduplicateUrls(urls);

  // MIL-STD §5.0 I5: Stream-based generation — O(1) memory
  const stream = buildUrlsetStream(clean, { previousGoodCount: TOOLS_PAGES.length });
  if (!stream) return sitemapStreamResponse(new ReadableStream({ start(c) { c.close(); } }));

  return sitemapStreamResponse(stream);
}
