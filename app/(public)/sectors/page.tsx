import Link from 'next/link';
import { Metadata } from 'next';
import { siteConfig } from '@/lib/site-config';
import { generateBreadcrumbSchema, generateLegalServiceSchema } from '@/lib/seo/schema';
import { SECTOR_DETAILS } from '@/lib/cbam/sectors/sector-content';

export const metadata: Metadata = {
  title: 'CBAM Sectors — Compliance Guides & System Boundaries | CBAMValid',
  description: 'Explore the 6 primary CBAM sectors under Regulation (EU) 2023/956: Cement, Iron & Steel, Aluminium, Fertilisers, Hydrogen, and Electricity. Find sector guides and benchmarks.',
  alternates: { canonical: `${siteConfig.canonicalOrigin}/sectors` },
  robots: { index: true, follow: true },
};

export default function SectorsIndexPage() {
  const jsonLd = [
    generateBreadcrumbSchema([{ name: 'Home', item: '/' }, { name: 'Sectors', item: '/sectors' }]),
    generateLegalServiceSchema(),
  ];

  return (
    <div className='min-h-screen bg-background text-foreground font-sans'>
      <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className='max-w-4xl mx-auto px-6 py-12'>
        <div className='mb-10'>
          <h1 className='text-3xl md:text-4xl font-serif font-bold tracking-tight mb-3'>CBAM Sectors Guide</h1>
          <p className='text-lg text-muted leading-relaxed max-w-2xl'>
            EU CBAM applies to six energy-intensive sectors and downstream complex goods. Select a sector below to explore the calculation rules, system boundaries, and covered CN codes.
          </p>
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          {Object.values(SECTOR_DETAILS).map((sector) => (
            <Link
              key={sector.slug}
              href={`/sectors/${sector.slug}`}
              className='block p-6 bg-surface border border-border rounded-xl hover:border-accent/40 transition-colors shadow-sm'
            >
              <h2 className='text-xl font-bold mb-2'>{sector.name}</h2>
              <p className='text-sm text-muted line-clamp-3 mb-4'>{sector.introduction}</p>
              <span className='text-xs text-accent font-semibold underline underline-offset-2'>
                View Sector Guide &amp; Rules &rarr;
              </span>
            </Link>
          ))}
        </div>

        <div className='mt-12 p-4 border border-border/50 rounded-lg text-xs text-muted'>
          Legal Basis: Regulation (EU) 2023/956, Annex I. CBAMValid is an independent software service.
        </div>
      </main>
    </div>
  );
}
