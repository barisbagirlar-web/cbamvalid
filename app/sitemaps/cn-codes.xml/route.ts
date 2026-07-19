import { CN_CODE_REGISTRY } from '@/lib/cbam/cn-codes/cn-code-registry';
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
 * Semantic SEO §2: eea: entity extension binds each CN code URL to Prof. Dr. Neela
 * Nataraj (methodology audit). CN code emission factors are academically validated.
 */
export async function GET() {
  const urls: EntityUrl[] = [];

  for (const entry of CN_CODE_REGISTRY) {
    const lastmod = safeLastMod(entry.contentLastModified);
    const verifiedBy = [{ ref: CBAM_EXPERTS.NEELA_NATARAJ, role: 'methodology-audit' }];
    const regulatoryRef = 'EU-2023/956-Annex-I';
    urls.push({ url: `https://cbamvalid.com/cn-codes/${entry.code}`, lastmod, verifiedBy, regulatoryRef });
    urls.push({ url: `https://cbamvalid.com/cn-codes/${entry.code}/${entry.sector}`, lastmod, verifiedBy, regulatoryRef });
  }

  // MIL-STD §1.3: deduplicate (SHA-256 normalization)
  const { clean } = deduplicateUrls(urls);

  // Semantic SEO §2 + MIL-STD §5.0 I5: Stream-based entity generation — O(1) memory
  const stream = buildEntityUrlsetStream(clean, { previousGoodCount: CN_CODE_REGISTRY.length * 2 });
  if (!stream) return sitemapStreamResponse(new ReadableStream({ start(c) { c.close(); } }));

  return sitemapStreamResponse(stream);
}
