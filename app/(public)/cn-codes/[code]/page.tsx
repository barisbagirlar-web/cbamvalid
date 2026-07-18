/**
 * PHASE 3 §2: Programmatic CN Code Detail Page — Data Moat SSG Route
 *
 * Protocol: Generates static pages for ALL CN codes in the registry via
 * generateStaticParams. Each page is a self-contained CBAM compliance
 * reference with PassageIndexingFactBox for AI Overview dominance.
 *
 * Route: /cn-codes/:code
 * Scale: 100+ entries → 100+ unique static HTML pages
 */

import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { siteConfig } from '@/lib/site-config';
import { generateBreadcrumbSchema, generateFAQSchema, generateEnterpriseGraphSchema, generateLegalServiceSchema } from '@/lib/seo/schema';
import { getCnCodeEntry, CN_CODE_REGISTRY } from '@/lib/cbam/cn-codes/cn-code-registry';
import { ExpertAuthoritySection } from '@/components/seo/ExpertAuthoritySection';
import { EmbeddedCarbonCalculator } from '@/components/seo/EmbeddedCarbonCalculator';
import { PassageIndexingFactBox, TransitionalPeriodFactBox } from '@/components/seo/PassageIndexingFactBox';
import { TopologyLinker } from '@/components/seo/TopologyLinker';

interface PageProps {
  params: Promise<{ code: string }>;
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

// ─── SSG: Generate ALL static params from the registry ───

export async function generateStaticParams() {
  return CN_CODE_REGISTRY.map((entry) => ({ code: entry.code }));
}

// ─── Metadata per CN code ───

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;
  const entry = getCnCodeEntry(code);
  if (!entry) return { title: 'CN Code Not Found | CBAMValid', robots: { index: false, follow: false } };
  const sectorLabel = SECTOR_DISPLAY[entry.sector] ?? entry.sector;
  const benchmark = entry.benchmarkTco2ePerTonne !== null
    ? `EU default benchmark: ${entry.benchmarkTco2ePerTonne} tCO2e/tonne.`
    : 'EU default values expressed per MWh.';
  return {
    title: `CBAM CN Code ${code} — Emissions Benchmark & Compliance | CBAMValid`,
    description: `${entry.description} (${sectorLabel} sector) under EU CBAM Regulation 2023/956. ${benchmark} Calculate embedded emissions and prepare your 2026 compliance dossier.`,
    alternates: { canonical: `${siteConfig.canonicalOrigin}/cn-codes/${code}` },
    robots: { index: true, follow: true },
  };
}

// ─── PAGE COMPONENT ───

export default async function CnCodeDetailPage({ params }: PageProps) {
  const { code } = await params;
  const entry = getCnCodeEntry(code);
  if (!entry) notFound();
  const sectorLabel = SECTOR_DISPLAY[entry.sector] ?? entry.sector;

  // Related codes in same sector
  const relatedCodes = CN_CODE_REGISTRY
    .filter((e) => e.sector === entry.sector && e.code !== code)
    .slice(0, 5);

  // PHASE 4: Extended related codes for TopologyLinker (up to 50 for graph connectivity)
  const topologyRelatedCodes = CN_CODE_REGISTRY
    .filter((e) => e.sector === entry.sector && e.code !== code)
    .slice(0, 50);

  // ─── AI Overview Fact Box content ───
  const factBoxQuestion = `What is the CBAM emission factor for CN code ${code}?`;
  const factBoxAnswer = entry.benchmarkTco2ePerTonne !== null
    ? `Under EU Carbon Border Adjustment Mechanism (CBAM), CN code ${code} covers ${entry.description.toLowerCase()} in the ${sectorLabel.toLowerCase()} sector. The EU default embedded emissions benchmark is ${entry.benchmarkTco2ePerTonne} tonnes of CO2 equivalent per tonne of product, comprising ${entry.defaultDirectFactor} tCO2e/t direct emissions and ${entry.defaultIndirectFactor} tCO2e/t indirect emissions. This benchmark is established by Implementing Regulation (EU) 2023/1773, Annex III, and applies during the CBAM transitional period. From 2026, importers must use actual installation data where default values are no longer accepted as substitutes for verified emissions.`
    : `Under EU Carbon Border Adjustment Mechanism (CBAM), CN code ${code} covers ${entry.description.toLowerCase()} in the ${sectorLabel.toLowerCase()} sector. The EU default emission factor is ${entry.defaultIndirectFactor} tCO2e per MWh, based on the EU average grid emission factor per Regulation (EU) 2023/956 Annex I, Section 3. Country-specific grid factors may apply where certified. Importers must report embedded indirect emissions using actual electricity consumption data or applicable grid emission factors.`;

  // ─── JSON-LD ───
  const jsonLd = [
    generateEnterpriseGraphSchema(`/cn-codes/${code}`),
    generateBreadcrumbSchema([
      { name: 'Home', item: '/' },
      { name: 'CN Code Hub', item: '/cn-codes' },
      { name: `CN ${code}`, item: `/cn-codes/${code}` },
    ]),
    generateFAQSchema([
      {
        question: factBoxQuestion,
        answer: factBoxAnswer,
      },
      {
        question: `Is CN code ${code} in scope for CBAM reporting?`,
        answer: `Yes. CN code ${code} (${entry.description}) is explicitly covered by Regulation (EU) 2023/956, Annex I under the ${sectorLabel} sector. Importers must report embedded emissions quarterly during the transitional period and annually from 2026, with EU CBAM certificate surrenders due by 31 May each year.`,
      },
      {
        question: `Does CN code ${code} require precursor tracking for embedded emissions?`,
        answer: entry.requiresPrecursorTracking
          ? `Yes. CN code ${code} requires full precursor embedded emissions tracking. Importers must account for emissions embedded in all upstream input materials (precursors) used in manufacturing this product. This is mandatory for complex goods under the ${sectorLabel} sector.`
          : `No. CN code ${code} does not require precursor tracking. Embedded emissions are calculated at the installation level for this product category. Only direct and indirect emissions from the reporting installation are in scope.`,
      },
    ]),
    generateLegalServiceSchema(),
  ];

  return (
    <div className='min-h-screen bg-background text-foreground font-sans'>
      <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <main className='max-w-4xl mx-auto px-6 py-12'>
        {/* ─── Breadcrumb ─── */}
        <nav className='text-xs text-muted mb-8 flex items-center gap-1.5' aria-label='Breadcrumb'>
          <Link href='/' className='hover:text-accent'>Home</Link>
          <span>/</span>
          <Link href='/cn-codes' className='hover:text-accent'>CN Code Hub</Link>
          <span>/</span>
          <span className='text-foreground font-semibold'>{code}</span>
        </nav>

        {/* ─── Header ─── */}
        <div className='mb-6'>
          <div className='inline-flex items-center gap-2 border border-border bg-surface px-3 py-1.5 rounded-full text-xs font-semibold tracking-wider text-accent uppercase mb-4'>
            {sectorLabel} Sector
          </div>
          <h1 className='text-3xl md:text-4xl font-serif font-bold tracking-tight mb-3'>
            CBAM for CN Code <span className='font-mono text-accent'>{code}</span>
          </h1>
          <p className='text-lg text-muted leading-relaxed'>{entry.description}</p>
          <p className='mt-2 text-xs text-muted'>
            Classification:{' '}
            <a href={entry.eurLexUrl} target='_blank' rel='noopener noreferrer' className='text-accent underline underline-offset-2 hover:no-underline'>
              Regulation (EU) 2023/956, Annex I — {sectorLabel}
            </a>
            {' '}| System boundary: {entry.systemBoundaryNote}
          </p>
        </div>

        {/* ─── PHASE 3: AI Overview PassageIndexingFactBox ─── */}
        <PassageIndexingFactBox
          question={factBoxQuestion}
          answer={factBoxAnswer}
          sourceRegulation='Implementing Regulation (EU) 2023/1773, Annex III'
          sourceUrl='https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R1773'
          cnCode={code}
        />

        {/* ─── PHASE 3: 2026 Actual Data Transition CTA ─── */}
        <TransitionalPeriodFactBox cnCode={code} sector={entry.sector} />

        {/* ─── Embedded Carbon Calculator ─── */}
        <EmbeddedCarbonCalculator
          defaultDirectFactor={entry.defaultDirectFactor}
          defaultIndirectFactor={entry.defaultIndirectFactor}
          benchmarkTco2ePerTonne={entry.benchmarkTco2ePerTonne}
          sector={entry.sector}
          code={code}
        />

        {/* ─── Benchmark Card ─── */}
        <section className='bg-surface border border-border rounded-xl p-6 mb-10 shadow-sm' aria-labelledby='data-card'>
          <h2 id='data-card' className='text-xl font-bold mb-4'>CBAM Data Card — CN Code {code}</h2>
          <div className='overflow-x-auto'>
            <table className='w-full text-sm border-collapse'>
              <thead>
                <tr className='border-b border-border text-left'>
                  <th className='pb-2 pr-4 font-semibold text-foreground'>Parameter</th>
                  <th className='pb-2 font-semibold text-foreground'>Value</th>
                </tr>
              </thead>
              <tbody className='text-muted'>
                <tr className='border-b border-border/50'>
                  <td className='py-2 pr-4'>Direct emissions factor</td>
                  <td className='py-2 font-mono'>{entry.defaultDirectFactor} tCO2e/t</td>
                </tr>
                <tr className='border-b border-border/50'>
                  <td className='py-2 pr-4'>Indirect emissions factor</td>
                  <td className='py-2 font-mono'>{entry.defaultIndirectFactor} tCO2e/{entry.sector === 'electricity' ? 'MWh' : 't'}</td>
                </tr>
                <tr className='border-b border-border/50'>
                  <td className='py-2 pr-4'>Total benchmark</td>
                  <td className='py-2 font-mono font-bold text-foreground'>
                    {entry.benchmarkTco2ePerTonne !== null ? `${entry.benchmarkTco2ePerTonne} tCO2e/t` : `${entry.defaultIndirectFactor} tCO2e/MWh`}
                  </td>
                </tr>
                <tr className='border-b border-border/50'>
                  <td className='py-2 pr-4'>Indirect emissions in scope</td>
                  <td className='py-2'>{entry.indirectEmissionsInScope ? 'Yes' : 'No'}</td>
                </tr>
                <tr className='border-b border-border/50'>
                  <td className='py-2 pr-4'>Precursor tracking</td>
                  <td className='py-2'>{entry.requiresPrecursorTracking ? 'Required' : 'Not required'}</td>
                </tr>
                <tr>
                  <td className='py-2 pr-4'>Data source</td>
                  <td className='py-2'>{entry.annexRef}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ─── Detailed guidance ─── */}
        <section className='mb-10' aria-labelledby='guidance-heading'>
          <h2 id='guidance-heading' className='text-xl font-bold mb-3'>Regulatory Context for CN Code {code}</h2>
          <div className='prose prose-sm max-w-none text-muted space-y-3'>
            <p>
              This Combined Nomenclature code falls under the{' '}
              <strong>{sectorLabel}</strong> sector as defined in{' '}
              <a href='https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R0956' target='_blank' rel='noopener noreferrer' className='text-accent underline underline-offset-2'>
                Regulation (EU) 2023/956
              </a>
              , Annex I. Importers of goods classified under this code must report embedded emissions quarterly during the
              transitional period and annually from 2026 onwards.
            </p>
            <p>
              The default emission factors are sourced from{' '}
              <a href='https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R1773' target='_blank' rel='noopener noreferrer' className='text-accent underline underline-offset-2'>
                Implementing Regulation (EU) 2023/1773
              </a>
              , Annex III. Where actual installation data is available and independently verified,
              importers may substitute these default values.
            </p>
            <p>{entry.systemBoundaryNote}</p>
          </div>
        </section>

        {/* ─── Official Regulatory References ─── */}
        <section className='mb-10 border-t border-border pt-8' aria-labelledby='reg-heading'>
          <h2 id='reg-heading' className='text-lg font-bold mb-4'>Official Regulatory References</h2>
          <ul className='space-y-2 text-sm'>
            <li>
              <a href={entry.eurLexUrl} target='_blank' rel='noopener noreferrer' className='text-accent underline underline-offset-2 hover:no-underline'>
                Regulation (EU) 2023/956 — Annex I ({sectorLabel})
              </a>
            </li>
            <li>
              <a href='https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R1773' target='_blank' rel='noopener noreferrer' className='text-accent underline underline-offset-2 hover:no-underline'>
                Implementing Regulation (EU) 2023/1773 — Default Values Annex III
              </a>
            </li>
            <li>
              <a href='https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ:L_202403215' target='_blank' rel='noopener noreferrer' className='text-accent underline underline-offset-2 hover:no-underline'>
                Commission Delegated Regulation (EU) 2024/3215 — CBAM Calculation Methodology
              </a>
            </li>
            <li>
              <a href={`/cn-codes/${code}/${entry.sector}`} className='text-accent underline underline-offset-2 hover:no-underline font-semibold'>
                Detailed Analysis: CN {code} in {sectorLabel} Sector (Full Benchmark Table)
              </a>
            </li>
          </ul>
        </section>

        {/* ─── Related CN Codes ─── */}
        {relatedCodes.length > 0 && (
          <section className='mb-10' aria-labelledby='related-heading'>
            <h2 id='related-heading' className='text-lg font-bold mb-4'>Related {sectorLabel} CN Codes</h2>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
              {relatedCodes.map((rc) => (
                <Link key={rc.code} href={`/cn-codes/${rc.code}`} className='block p-4 bg-surface border border-border rounded-xl hover:border-accent/40 transition-colors'>
                  <span className='font-mono text-accent text-sm font-bold'>{rc.code}</span>
                  <p className='text-xs text-muted mt-1 line-clamp-2'>{rc.description}</p>
                  {rc.benchmarkTco2ePerTonne !== null && <span className='text-xs text-muted mt-1 block font-mono'>{rc.benchmarkTco2ePerTonne} tCO2e/t</span>}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ─── Lead Magnet CTA — XML Export ─── */}
        <section className='bg-accent/5 border border-accent/20 rounded-xl p-6 mb-10' aria-labelledby='cta-heading'>
          <h2 id='cta-heading' className='font-bold text-lg mb-2'>
            Export Your CBAM Data for CN Code {code}
          </h2>
          <p className='text-sm text-muted mb-4'>
            Prepare a verified emissions dossier with actual installation data. Generate your CBAM
            Declarant Portal-compatible report including embedded emissions, evidence linkage, and
            calculation trace ready for independent accredited verification.
          </p>
          <div className='flex flex-col sm:flex-row gap-3'>
            <Link
              href={`/register?next=/cases/new&cn=${code}&sector=${entry.sector}`}
              className='inline-flex items-center justify-center gap-2 rounded-md bg-accent px-6 py-3 font-medium text-surface transition-colors hover:bg-accent-hover'
            >
              Start Your CBAM Dossier for {code}
            </Link>
            <Link
              href={`/cn-codes/${code}/${entry.sector}`}
              className='inline-flex items-center justify-center gap-2 rounded-md border border-border bg-surface px-6 py-3 font-medium text-foreground transition-colors hover:bg-neutral-soft'
            >
              View Full Sector Analysis
            </Link>
          </div>
        </section>

        {/* ─── Expert Authority ─── */}
        <ExpertAuthoritySection toolName={`CBAM Calculator — ${sectorLabel}`} />

        {/* ─── PHASE 4: TopologyLinker — Hub-Spoke Internal Link Graph ─── */}
        <TopologyLinker
          currentCode={code}
          sectorSlug={entry.sector}
          relatedCodes={topologyRelatedCodes}
        />

        {/* ─── Disclaimer ─── */}
        <div className='mt-8 p-4 border border-border/50 rounded-lg text-xs text-muted'>
          <strong>Regulatory Disclaimer:</strong> CBAMValid is not an EU institution or accredited
          CBAM verifier. Benchmark values are EU defaults from official regulations and may be
          superseded. Final CBAM obligations must be verified by accredited verifiers and submitted
          to the EU CBAM Registry. This page is an independent technical reference prepared for
          operator/verifier readiness.
        </div>
      </main>
    </div>
  );
}
