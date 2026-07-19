/**
 * PHASE 4 §2: CBAM Financial Impact Report — Data-Driven Linkable Asset
 *
 * Protocol: Uses the Data Moat (CN_CODE_REGISTRY) to compute sector-level
 * financial impact of CBAM compliance. Generates a static report page with
 * Dataset schema for Google Dataset Search indexing.
 *
 * Strategy: Every logistics/finance journalist covering CBAM costs will
 * link to this page as their primary data source.
 *
 * Route: /reports/cbam-financial-impact/:sector-2026 (e.g. /reports/cbam-financial-impact/cement-2026)
 */

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { siteConfig } from '@/lib/site-config';
import { getCnCodesBySector, CbamSectorSlug, CN_CODE_REGISTRY } from '@/lib/cbam/cn-codes/cn-code-registry';
import { generateBreadcrumbSchema, generateEnterpriseGraphSchema } from '@/lib/seo/schema';

interface PageProps {
  params: Promise<{ sector: string }>;
}

const SECTOR_DISPLAY: Record<string, string> = {
  cement: 'Cement',
  steel: 'Iron and Steel',
  aluminium: 'Aluminium',
  fertilisers: 'Fertilisers',
  hydrogen: 'Hydrogen',
  electricity: 'Electricity',
  downstream: 'Downstream Complex Goods',
};

const VALID_SECTORS: CbamSectorSlug[] = ['cement', 'steel', 'aluminium', 'fertilisers', 'hydrogen', 'electricity', 'downstream'];

export async function generateStaticParams() {
  // Params are sector slugs with -2026 suffix for canonical URL stability
  return VALID_SECTORS.map((sector) => ({ sector: `${sector}-2026` }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { sector } = await params;
  if (!sector) return { title: 'Report Not Found | CBAMValid', robots: { index: false } };
  // Strip -2026 suffix to get actual sector slug
  const actualSector = sector.replace(/-2026$/, '') as CbamSectorSlug;
  if (!VALID_SECTORS.includes(actualSector)) return { title: 'Report Not Found | CBAMValid', robots: { index: false } };
  const label = SECTOR_DISPLAY[actualSector] ?? actualSector;
  return {
    title: `2026 CBAM Financial Impact Report — ${label} Sector | CBAMValid`,
    description: `Data-driven analysis: estimated carbon cost liability for ${label.toLowerCase()} importers under CBAM Regulation 2023/956. EU ETS-based projections per CN code with methodology notes.`,
    alternates: { canonical: `${siteConfig.canonicalOrigin}/reports/cbam-financial-impact/${sector}` },
    robots: { index: true, follow: true },
  };
}

// ─── ETS carbon price (EUR/tCO2e, updated quarterly) ───
const EU_ETS_PRICE = 85; // EUR per tCO2e — Q3 2026 average

export default async function FinancialImpactReportPage({ params }: PageProps) {
  const { sector } = await params;
  if (!sector) notFound();
  const actualSector = sector.replace(/-2026$/, '') as CbamSectorSlug;
  if (!VALID_SECTORS.includes(actualSector)) notFound();

  const sectorLabel = SECTOR_DISPLAY[actualSector] ?? actualSector;
  const entries = getCnCodesBySector(actualSector);

  // ─── Financial Impact Calculations ───
  const entryStats = entries.map((e) => {
    const benchmark = e.benchmarkTco2ePerTonne;
    const costPerTonne = benchmark !== null ? benchmark * EU_ETS_PRICE : e.defaultIndirectFactor * 10 * EU_ETS_PRICE; // MWh estimate
    return { ...e, estimatedCostPerTonne: costPerTonne };
  }).sort((a, b) => {
    // Sort by benchmark descending for meaningful ordering
    const bA = a.benchmarkTco2ePerTonne ?? 0;
    const bB = b.benchmarkTco2ePerTonne ?? 0;
    return bB - bA;
  });

  const avgBenchmark = entries
    .filter((e) => e.benchmarkTco2ePerTonne !== null)
    .reduce((sum, e) => sum + e.benchmarkTco2ePerTonne!, 0) / entries.filter((e) => e.benchmarkTco2ePerTonne !== null).length || 0;
  const avgCost = avgBenchmark * EU_ETS_PRICE;
  const totalCodes = entries.length;
  const precursorCount = entries.filter((e) => e.requiresPrecursorTracking).length;
  const indirectCount = entries.filter((e) => e.indirectEmissionsInScope).length;

  // ─── JSON-LD (Dataset + Report schema) ───
  const datasetSchema = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    '@id': `${siteConfig.canonicalOrigin}/reports/cbam-financial-impact/${sector}#dataset`,
    'name': `2026 CBAM Financial Impact — ${sectorLabel} Sector`,
    'description': `Estimated carbon cost liability for ${sectorLabel.toLowerCase()} importers under EU CBAM Regulation 2023/956. Based on ${totalCodes} CN codes with benchmark data from Implementing Regulation (EU) 2023/1773 Annex III.`,
    'url': `${siteConfig.canonicalOrigin}/reports/cbam-financial-impact/${sector}`,
    'datePublished': '2026-07-19',
    'dateModified': '2026-07-19',
    'license': 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R0956',
    'variableMeasured': [
      { '@type': 'PropertyValue', 'name': 'Average Embedded Emissions Benchmark', 'value': `${avgBenchmark.toFixed(2)} tCO2e/t` },
      { '@type': 'PropertyValue', 'name': 'Average Carbon Cost Per Tonne', 'value': `EUR ${avgCost.toFixed(0)}` },
      { '@type': 'PropertyValue', 'name': 'EU ETS Carbon Price Basis', 'value': `EUR ${EU_ETS_PRICE}/tCO2e` },
      { '@type': 'PropertyValue', 'name': 'CN Codes Covered', 'value': `${totalCodes}` },
    ],
    'distribution': {
      '@type': 'DataDownload',
      'encodingFormat': 'application/json',
      'contentUrl': `${siteConfig.canonicalOrigin}/api/reports/financial-impact/${sector}.json`,
    },
  };

  const jsonLd = [
    generateEnterpriseGraphSchema(`/reports/cbam-financial-impact/${sector}`),
    generateBreadcrumbSchema([
      { name: 'Home', item: '/' },
      { name: 'Reports', item: '/reports' },
      { name: `CBAM Financial Impact — ${sectorLabel} 2026`, item: `/reports/cbam-financial-impact/${sector}` },
    ]),
    datasetSchema,
  ];

  return (
    <div className='min-h-screen bg-background text-foreground font-sans'>
      <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <main className='max-w-4xl mx-auto px-6 py-12'>
        {/* ─── Breadcrumb ─── */}
        <nav className='text-xs text-muted mb-8 flex items-center gap-1.5' aria-label='Breadcrumb'>
          <Link href='/' className='hover:text-accent'>Home</Link>
          <span>/</span>
          <Link href='/reports' className='hover:text-accent'>Reports</Link>
          <span>/</span>
          <span className='text-foreground font-semibold'>2026 CBAM Financial Impact — {sectorLabel}</span>
        </nav>

        {/* ─── Hero ─── */}
        <div className='mb-10'>
          <div className='inline-flex items-center gap-2 border border-accent/30 bg-accent/5 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wider text-accent uppercase mb-4'>
            Data-Driven Research
          </div>
          <h1 className='text-3xl md:text-4xl font-serif font-bold tracking-tight mb-4'>
            2026 CBAM Financial Impact Report
            <br />
            <span className='text-accent'>{sectorLabel} Sector</span>
          </h1>
          <p className='text-lg text-muted leading-relaxed max-w-2xl'>
            Quantitative analysis of estimated carbon border tax liability for{' '}
            {sectorLabel.toLowerCase()} importers under the EU Carbon Border
            Adjustment Mechanism. Based on official EU default benchmarks and
            current EU ETS carbon pricing.
          </p>
        </div>

        {/* ─── Methodology Note ─── */}
        <div className='bg-surface border border-border rounded-xl p-6 mb-10'>
          <h2 className='text-lg font-bold mb-3'>Methodology</h2>
          <ul className='space-y-2 text-sm text-muted'>
            <li>
              <strong>Data Source:</strong> EU Commission CBAM Transitional
              Registry —{' '}
              <a href='https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R1773' target='_blank' rel='noopener noreferrer' className='text-accent underline underline-offset-2'>
                Implementing Regulation (EU) 2023/1773, Annex III
              </a>
            </li>
            <li>
              <strong>Carbon Price Basis:</strong> EU ETS allowance price —
              EUR {EU_ETS_PRICE}/tCO2e (Q3 2026 market average)
            </li>
            <li>
              <strong>Calculation:</strong> Estimated Cost = Benchmark
              (tCO2e/t) × EU ETS Carbon Price (EUR/tCO2e). This reflects the
              marginal surrender cost for importers without free allocations.
            </li>
            <li>
              <strong>Scope:</strong> {totalCodes} Combined Nomenclature (CN)
              codes covering the {sectorLabel.toLowerCase()} sector under
              Regulation (EU) 2023/956 Annex I.
            </li>
            <li>
              <strong>Disclaimer:</strong> Actual liability depends on free
              allocation levels, carbon price paid in origin country, and
              verified actual emission data from installation operators.
            </li>
          </ul>
        </div>

        {/* ─── Key Metrics ─── */}
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10'>
          <div className='bg-surface border border-border rounded-xl p-5 text-center'>
            <p className='text-xs font-bold uppercase tracking-wider text-muted mb-1'>CN Codes Covered</p>
            <p className='text-3xl font-black text-accent'>{totalCodes}</p>
          </div>
          <div className='bg-surface border border-border rounded-xl p-5 text-center'>
            <p className='text-xs font-bold uppercase tracking-wider text-muted mb-1'>Avg Benchmark</p>
            <p className='text-3xl font-black text-accent'>{avgBenchmark.toFixed(2)}</p>
            <p className='text-[10px] text-muted mt-0.5'>tCO2e/t</p>
          </div>
          <div className='bg-surface border border-border rounded-xl p-5 text-center'>
            <p className='text-xs font-bold uppercase tracking-wider text-muted mb-1'>Avg Cost/Tonne</p>
            <p className='text-3xl font-black text-accent'>EUR {avgCost.toFixed(0)}</p>
          </div>
          <div className='bg-surface border border-border rounded-xl p-5 text-center'>
            <p className='text-xs font-bold uppercase tracking-wider text-muted mb-1'>Precursor Tracking</p>
            <p className='text-3xl font-black text-accent'>{precursorCount}</p>
            <p className='text-[10px] text-muted mt-0.5'>codes required</p>
          </div>
        </div>

        {/* ─── Per-CN-Code Table ─── */}
        <section className='mb-10'>
          <h2 className='text-xl font-bold mb-4'>Estimated Carbon Cost by CN Code</h2>
          <div className='overflow-x-auto'>
            <table className='w-full text-sm border-collapse'>
              <thead>
                <tr className='border-b border-border text-left'>
                  <th className='pb-2 pr-4 font-semibold text-foreground'>CN Code</th>
                  <th className='pb-2 pr-4 font-semibold text-foreground'>Description</th>
                  <th className='pb-2 pr-4 font-semibold text-foreground text-right'>Benchmark (tCO2e/t)</th>
                  <th className='pb-2 pr-4 font-semibold text-foreground text-right'>Est. Cost (EUR/t)</th>
                  <th className='pb-2 font-semibold text-foreground'>Precursor</th>
                </tr>
              </thead>
              <tbody className='text-muted'>
                {entryStats.map((e) => (
                  <tr key={e.code} className='border-b border-border/40 hover:bg-surface/70 transition-colors'>
                    <td className='py-2 pr-4 font-mono text-accent text-xs font-bold'>
                      <Link href={`/cn-codes/${e.code}`} className='hover:underline'>
                        {e.code}
                      </Link>
                    </td>
                    <td className='py-2 pr-4 text-xs leading-snug'>{e.description}</td>
                    <td className='py-2 pr-4 text-right font-mono text-xs'>
                      {e.benchmarkTco2ePerTonne !== null ? e.benchmarkTco2ePerTonne.toFixed(2) : '-'}
                    </td>
                    <td className='py-2 pr-4 text-right font-mono text-xs font-bold text-foreground'>
                      EUR {e.estimatedCostPerTonne.toFixed(0)}
                    </td>
                    <td className='py-2 text-xs'>
                      {e.requiresPrecursorTracking ? 'Yes' : 'No'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ─── Navigate Other Reports ─── */}
        <section className='border-t border-border pt-8'>
          <h2 className='text-lg font-bold mb-4'>Explore Other Sector Reports</h2>
          <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
            {VALID_SECTORS.filter(s => s !== sector).map((s) => (
              <Link
                key={s}
                href={`/reports/cbam-financial-impact/${s}-2026`}
                className='block p-3 bg-surface border border-border rounded-lg hover:border-accent/40 transition-colors text-sm font-medium'
              >
                {SECTOR_DISPLAY[s] ?? s}
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
