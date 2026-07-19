import { SECTOR_DETAILS } from '@/lib/cbam/sectors/sector-content';
import {
  buildEntityUrlsetStream,
  sitemapStreamResponse,
  safeLastMod,
  deduplicateUrls,
  CBAM_EXPERTS,
  type EntityUrl,
} from '@/lib/seo/sitemap-guards';

export const dynamic = 'force-static';

/**
 * Semantic SEO §2: eea: entity extension binds each sector URL to verified experts.
 * Sector pages carry both academic (methodology) and financial (impact) oversight.
 */
export async function GET() {
  const hubLastmod = safeLastMod('2026-07-18T00:00:00Z');

  const urls: EntityUrl[] = [
    {
      url: 'https://cbamvalid.com/sectors',
      lastmod: hubLastmod,
      verifiedBy: [
        { ref: CBAM_EXPERTS.NEELA_NATARAJ, role: 'academic-oversight' },
        { ref: CBAM_EXPERTS.BARIS_BAGIRLAR, role: 'financial-compliance' },
      ],
      regulatoryRef: 'EU-2023/956-Annex-I',
    },
    ...Object.keys(SECTOR_DETAILS).map((slug): EntityUrl => ({
      url: `https://cbamvalid.com/sectors/${slug}`,
      lastmod: safeLastMod(SECTOR_DETAILS[slug].contentLastModified),
      verifiedBy: [
        { ref: CBAM_EXPERTS.NEELA_NATARAJ, role: 'methodology-audit' },
        { ref: CBAM_EXPERTS.BARIS_BAGIRLAR, role: 'financial-compliance' },
      ],
      regulatoryRef: 'EU-2023/956-Annex-III',
    })),
  ];

  // MIL-STD §1.3: deduplicate
  const { clean } = deduplicateUrls(urls);

  // Semantic SEO §2 + MIL-STD §5.0 I5: Stream-based entity generation — O(1) memory
  const stream = buildEntityUrlsetStream(clean, { previousGoodCount: urls.length });
  if (!stream) return sitemapStreamResponse(new ReadableStream({ start(c) { c.close(); } }));

  return sitemapStreamResponse(stream);
}
