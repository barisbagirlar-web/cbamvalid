import {
  buildEntityUrlsetStream,
  sitemapStreamResponse,
  deduplicateUrls,
  fileLastMod,
  CBAM_EXPERTS,
  type EntityUrl,
} from '@/lib/seo/sitemap-guards';
import path from 'path';

export const dynamic = 'force-static';

/**
 * Content-derived lastmod from actual source file modification timestamps.
 * MIL-STD §1.1: Replaces hardcoded date tiers. Each tool page gets its
 * real file mtime, providing genuine freshness signals to Googlebot.
 *
 * Semantic SEO §2: eea: entity extension binds each URL to verified experts.
 */
const APP_PUBLIC = path.join(process.cwd(), 'app', '(public)');

interface ToolPage {
  path: string;
  pageFile: string;
  verifiedBy?: { ref: string; role: string }[];
  regulatoryRef?: string;
}

const TOOLS_PAGES: ToolPage[] = [
  { path: '/', pageFile: 'page.tsx',
    verifiedBy: [
      { ref: CBAM_EXPERTS.NEELA_NATARAJ, role: 'academic-oversight' },
      { ref: CBAM_EXPERTS.BARIS_BAGIRLAR, role: 'financial-compliance' },
    ],
    regulatoryRef: 'EU-2023/956-Annex-III' },
  { path: '/about', pageFile: 'about/page.tsx' },
  { path: '/methodology', pageFile: 'methodology/page.tsx',
    verifiedBy: [{ ref: CBAM_EXPERTS.NEELA_NATARAJ, role: 'methodology-audit' }],
    regulatoryRef: 'EU-2023/956-Annex-III' },
  { path: '/how-it-works', pageFile: 'how-it-works/page.tsx' },
  { path: '/pricing', pageFile: 'pricing/page.tsx',
    verifiedBy: [{ ref: CBAM_EXPERTS.BARIS_BAGIRLAR, role: 'financial-compliance' }] },
  { path: '/product', pageFile: 'product/page.tsx',
    verifiedBy: [
      { ref: CBAM_EXPERTS.NEELA_NATARAJ, role: 'academic-oversight' },
      { ref: CBAM_EXPERTS.BARIS_BAGIRLAR, role: 'financial-compliance' },
    ] },
  { path: '/contact', pageFile: 'contact/page.tsx' },
  { path: '/privacy', pageFile: 'privacy/page.tsx' },
  { path: '/terms', pageFile: 'terms/page.tsx' },
  { path: '/refund-policy', pageFile: 'refund-policy/page.tsx' },
  { path: '/cookie-policy', pageFile: 'cookie-policy/page.tsx' },
  { path: '/legal-notice', pageFile: 'legal-notice/page.tsx' },
  { path: '/sample-dossier', pageFile: 'sample-dossier/page.tsx',
    verifiedBy: [{ ref: CBAM_EXPERTS.NEELA_NATARAJ, role: 'methodology-audit' }] },
  { path: '/verify', pageFile: 'verify/page.tsx' },
  { path: '/cn-codes', pageFile: 'cn-codes/page.tsx',
    verifiedBy: [{ ref: CBAM_EXPERTS.NEELA_NATARAJ, role: 'methodology-audit' }],
    regulatoryRef: 'EU-2023/956-Annex-I' },
];

export async function GET() {
  const urls: EntityUrl[] = TOOLS_PAGES.map(({ path: pagePath, pageFile, verifiedBy, regulatoryRef }) => {
    const filePath = path.join(APP_PUBLIC, pageFile);
    // §1.1: Derive lastmod from actual file mtime, not hardcoded tier
    const lastmod = fileLastMod(filePath, '2026-07-18T00:00:00Z');
    return {
      url: `https://cbamvalid.com${pagePath === '/' ? '' : pagePath}`,
      lastmod,
      verifiedBy,
      regulatoryRef,
    };
  });

  // MIL-STD §1.3: deduplicate before XML generation
  const { clean } = deduplicateUrls(urls);

  // Semantic SEO §2 + MIL-STD §5.0 I5: Stream-based entity generation — O(1) memory
  const stream = buildEntityUrlsetStream(clean, { previousGoodCount: TOOLS_PAGES.length });
  if (!stream) return sitemapStreamResponse(new ReadableStream({ start(c) { c.close(); } }));

  return sitemapStreamResponse(stream);
}
