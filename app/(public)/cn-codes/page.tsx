import Link from 'next/link';
import { Metadata } from 'next';
import { siteConfig } from '@/lib/site-config';
import { generateBreadcrumbSchema, generateLegalServiceSchema } from '@/lib/seo/schema';
import { CN_CODE_REGISTRY, CbamSectorSlug } from '@/lib/cbam/cn-codes/cn-code-registry';

export const metadata: Metadata = {
  title: 'CBAM CN Code Hub — All 6 Sectors & Benchmarks | CBAMValid',
  description: 'Complete list of CBAM-covered CN codes under Regulation (EU) 2023/956. Browse embedded emissions benchmarks for cement, steel, aluminium, fertilisers, hydrogen, and electricity sectors.',
  alternates: { canonical: `${siteConfig.canonicalOrigin}/cn-codes` },
  robots: { index: true, follow: true },
};

const SECTOR_DISPLAY: Record<string, string> = {
  cement: 'Cement',
  steel: 'Iron and Steel',
  aluminium: 'Aluminium',
  fertilisers: 'Fertilisers',
  hydrogen: 'Hydrogen',
  electricity: 'Electricity',
  downstream: 'Downstream Complex Goods',
};

const SECTOR_ORDER: CbamSectorSlug[] = ['cement', 'steel', 'aluminium', 'fertilisers', 'hydrogen', 'electricity', 'downstream'];

export default function CnCodesIndexPage() {
  const grouped = SECTOR_ORDER.reduce((acc, sector) => {
    acc[sector] = CN_CODE_REGISTRY.filter(e => e.sector === sector);
    return acc;
  }, {} as Record<string, typeof CN_CODE_REGISTRY>);

  const jsonLd = [
    generateBreadcrumbSchema([{ name: 'Home', item: '/' }, { name: 'CN Code Hub', item: '/cn-codes' }]),
    generateLegalServiceSchema(),
  ];

  return (
    <div className='min-h-screen bg-background text-foreground font-sans'>
      <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className='max-w-5xl mx-auto px-6 py-12'>
        <div className='mb-10'>
          <h1 className='text-3xl md:text-4xl font-serif font-bold tracking-tight mb-3'>CBAM CN Code Hub</h1>
          <p className='text-lg text-muted leading-relaxed max-w-2xl'>
            All Combined Nomenclature (CN) codes covered by{' '}
            <a href='https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R0956#anx_I' target='_blank' rel='noopener noreferrer' className='text-accent underline underline-offset-2 hover:no-underline'>
              Regulation (EU) 2023/956, Annex I
            </a>
            . Click any code to view EU default benchmarks, system boundaries, and calculation methodology.
          </p>
        </div>

        {SECTOR_ORDER.filter(s => (grouped[s] ?? []).length > 0).map((sector) => (
          <section key={sector} className='mb-10'>
            <div className='flex items-center justify-between mb-4'>
              <h2 className='text-xl font-bold'>{SECTOR_DISPLAY[sector]} Sector</h2>
              <Link href={`/sectors/${sector}`} className='text-xs text-accent underline underline-offset-2 hover:no-underline'>
                Sector Guide &rarr;
              </Link>
            </div>
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'>
              {(grouped[sector] ?? []).map((entry) => (
                <Link
                  key={entry.code}
                  href={`/cn-codes/${entry.code}/${entry.sector}`}
                  className='block p-4 bg-surface border border-border rounded-xl hover:border-accent/40 transition-colors'
                >
                  <span className='font-mono text-accent text-sm font-bold'>{entry.code}</span>
                  <p className='text-xs text-muted mt-1 leading-snug line-clamp-2'>{entry.description}</p>
                  {entry.benchmarkTco2ePerTonne !== null ? (
                    <span className='text-xs text-muted mt-2 block font-mono'>{entry.benchmarkTco2ePerTonne} tCO2e/t</span>
                  ) : (
                    <span className='text-xs text-muted mt-2 block font-mono'>{entry.defaultIndirectFactor} tCO2e/MWh</span>
                  )}
                  {entry.indirectEmissionsInScope && (
                    <span className='text-xs text-accent mt-1 block'>Indirect in scope</span>
                  )}
                </Link>
              ))}
            </div>
          </section>
        ))}

        <div className='mt-8 p-4 border border-border/50 rounded-lg text-xs text-muted'>
          Source: Regulation (EU) 2023/956, Annex I. Benchmarks from Implementing Regulation (EU) 2023/1773, Annex III. CBAMValid is not an EU institution. Data reviewed: January 2024.
        </div>
      </main>
    </div>
  );
}
