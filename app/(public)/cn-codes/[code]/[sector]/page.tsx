import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { siteConfig } from '@/lib/site-config';
import { generateBreadcrumbSchema, generateFAQSchema, generateEnterpriseGraphSchema } from '@/lib/seo/schema';
import { validateCnCodeSector, getCnCodesBySector, CbamSectorSlug } from '@/lib/cbam/cn-codes/cn-code-registry';
import { ExpertAuthoritySection } from '@/components/seo/ExpertAuthoritySection';
import { EmbeddedCarbonCalculator } from '@/components/seo/EmbeddedCarbonCalculator';

interface PageProps {
  params: Promise<{ code: string; sector: string }>;
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

export async function generateStaticParams() {
  const { CN_CODE_REGISTRY } = await import('@/lib/cbam/cn-codes/cn-code-registry');
  return CN_CODE_REGISTRY.map((entry) => ({ code: entry.code, sector: entry.sector }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code, sector } = await params;
  const entry = validateCnCodeSector(code, sector);
  if (!entry) return { title: 'CBAM CN Code Not Found | CBAMValid', robots: { index: false, follow: false } };
  const sectorLabel = SECTOR_DISPLAY[sector] ?? sector;
  const benchmark = entry.benchmarkTco2ePerTonne !== null ? `EU default benchmark: ${entry.benchmarkTco2ePerTonne} tCO2e/tonne.` : 'EU default values expressed per MWh.';
  return {
    title: `CBAM CN Code ${code} (${sectorLabel}) — Benchmark & Compliance | CBAMValid`,
    description: `${entry.description} under EU CBAM Regulation 2023/956. ${benchmark} Calculate embedded emissions and generate your CBAM compliance dossier.`,
    alternates: { canonical: `${siteConfig.canonicalOrigin}/cn-codes/${code}/${sector}` },
    robots: { index: true, follow: true },
  };
}

export default async function CnCodeSectorPage({ params }: PageProps) {
  const { code, sector } = await params;
  const entry = validateCnCodeSector(code, sector);
  if (!entry) notFound();
  const sectorLabel = SECTOR_DISPLAY[entry!.sector] ?? entry!.sector;
  const relatedCodes = getCnCodesBySector(entry!.sector as CbamSectorSlug).filter((e) => e.code !== code).slice(0, 5);

  const jsonLd = [
    generateEnterpriseGraphSchema(`/cn-codes/${code}/${sector}`),
    generateBreadcrumbSchema([
      { name: 'Home', item: '/' },
      { name: 'CN Code Hub', item: '/cn-codes' },
      { name: `${sectorLabel} Sector`, item: `/sectors/${sector}` },
      { name: `CN ${code}`, item: `/cn-codes/${code}/${sector}` },
    ]),
    generateFAQSchema([
      {
        question: `What is the CBAM benchmark for CN code ${code}?`,
        answer: entry!.benchmarkTco2ePerTonne !== null
          ? `The EU default embedded emissions benchmark for CN code ${code} (${entry!.description}) is ${entry!.benchmarkTco2ePerTonne} tCO2e per tonne of product, established by Implementing Regulation (EU) 2023/1773 Annex III. Importers using actual emission data must provide verified evidence.`
          : `For electrical energy (CN code ${code}), the EU default grid emission factor is ${entry!.defaultIndirectFactor} tCO2e/MWh per Implementing Regulation (EU) 2023/1773.`,
      },
      {
        question: `Are indirect emissions in scope for CN code ${code}?`,
        answer: entry!.indirectEmissionsInScope
          ? `Yes. For CN code ${code} in the ${sectorLabel} sector, indirect embedded emissions from electricity consumption are in scope and must be reported.`
          : `For CN code ${code}, only direct emissions are currently in scope. Indirect electricity emissions are not required for this product category.`,
      },
      {
        question: `Does CN code ${code} require precursor tracking?`,
        answer: entry!.requiresPrecursorTracking
          ? `Yes. CN code ${code} requires precursor embedded emissions tracking. You must account for emissions embedded in input materials.`
          : `No. CN code ${code} does not require precursor tracking — embedded emissions are calculated at the installation level.`,
      },
    ]),
  ];

  return (
    <div className='min-h-screen bg-background text-foreground font-sans'>
      <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className='max-w-4xl mx-auto px-6 py-12'>
        <nav className='text-xs text-muted mb-8 flex items-center gap-1.5' aria-label='Breadcrumb'>
          <Link href='/' className='hover:text-accent'>Home</Link>
          <span>/</span>
          <Link href='/cn-codes' className='hover:text-accent'>CN Code Hub</Link>
          <span>/</span>
          <Link href={`/sectors/${sector}`} className='hover:text-accent'>{sectorLabel}</Link>
          <span>/</span>
          <span className='text-foreground font-semibold'>{code}</span>
        </nav>

        <div className='mb-10'>
          <div className='inline-flex items-center gap-2 border border-border bg-surface px-3 py-1.5 rounded-full text-xs font-semibold tracking-wider text-accent uppercase mb-4'>
            {sectorLabel} Sector
          </div>
          <h1 className='text-3xl md:text-4xl font-serif font-bold tracking-tight mb-3'>
            CBAM for CN Code <span className='font-mono text-accent'>{code}</span>
          </h1>

          {/* PHASE 2 §4: Passage Indexing block — AI Overview "Definition & Default Factor" snippet */}
          <div className='bg-accent/5 border border-accent/20 rounded-lg p-4 mb-3'>
            <p className='text-sm text-foreground leading-relaxed'>
              <strong>Definition &amp; Default Factor:</strong> Under the EU Carbon Border Adjustment Mechanism (CBAM), CN Code <strong>{code}</strong> covers <em>{entry!.description.toLowerCase()}</em>. The European Commission Transitional Registry establishes the default embedded emissions benchmark at{' '}
              <strong className='font-mono text-accent'>{entry!.benchmarkTco2ePerTonne !== null ? `${entry!.benchmarkTco2ePerTonne} tCO2e per tonne` : `${entry!.defaultIndirectFactor} tCO2e/MWh`}</strong>{' '}
              of product, per Implementing Regulation (EU) 2023/1773 Annex III.{' '}
              {entry!.requiresPrecursorTracking ? 'Importers must also account for upstream precursor material emissions — tracking is mandatory for complex goods under this sector.' : ''}{' '}
              {entry!.indirectEmissionsInScope ? 'Indirect electricity emissions are fully in scope and must be reported using actual consumption data or applicable grid factors.' : 'Only direct process emissions are in scope for this product category.'}
            </p>
          </div>

          <p className='text-lg text-muted leading-relaxed'>{entry!.description}</p>
          <p className='mt-3 text-xs text-muted'>
            Source:{' '}
            <a href={entry!.eurLexUrl} target='_blank' rel='noopener noreferrer' className='text-accent underline underline-offset-2 hover:no-underline'>
              Regulation (EU) 2023/956, Annex I — {sectorLabel}
            </a>
          </p>
        </div>

        {/* Dynamic Calculator Component (SoftwareApplication UI) */}
        <div className='mb-10'>
          <EmbeddedCarbonCalculator
            defaultDirectFactor={entry!.defaultDirectFactor}
            defaultIndirectFactor={entry!.defaultIndirectFactor}
            benchmarkTco2ePerTonne={entry!.benchmarkTco2ePerTonne}
            sector={entry!.sector}
            code={code}
          />
        </div>

        <section className='bg-surface border border-border rounded-xl p-6 mb-10 shadow-sm' aria-labelledby='benchmark-heading'>
          <h2 id='benchmark-heading' className='text-xl font-bold mb-3'>
            {entry!.benchmarkTco2ePerTonne !== null ? `What is the CBAM benchmark for CN code ${code}?` : `CBAM emission factor for CN code ${code}`}
          </h2>
          {entry!.benchmarkTco2ePerTonne !== null ? (
            <p className='text-muted text-sm leading-relaxed mb-4'>
              The CBAM default embedded emissions benchmark for CN code <strong>{code}</strong> ({entry!.description}) is{' '}
              <strong className='text-foreground'>{entry!.benchmarkTco2ePerTonne} tCO2e per tonne</strong> of product, as established by{' '}
              <a href='https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R1773' target='_blank' rel='noopener noreferrer' className='text-accent underline underline-offset-2'>
                Implementing Regulation (EU) 2023/1773
              </a>
              , Annex III. Importers with actual installation data may substitute this default but must provide verified evidence.
            </p>
          ) : (
            <p className='text-muted text-sm leading-relaxed mb-4'>
              For electrical energy (CN code {code}), the EU default grid emission factor is{' '}
              <strong className='text-foreground'>{entry!.defaultIndirectFactor} tCO2e/MWh</strong> per{' '}
              <a href='https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R1773' target='_blank' rel='noopener noreferrer' className='text-accent underline underline-offset-2'>
                Implementing Regulation (EU) 2023/1773
              </a>
              . Country-specific factors apply where available.
            </p>
          )}
          <div className='overflow-x-auto'>
            <table className='w-full text-sm border-collapse'>
              <thead>
                <tr className='border-b border-border text-left'>
                  <th className='pb-2 pr-4 font-semibold text-foreground'>Parameter</th>
                  <th className='pb-2 pr-4 font-semibold text-foreground'>EU Default Value</th>
                  <th className='pb-2 font-semibold text-foreground'>Actual Value Pathway</th>
                </tr>
              </thead>
              <tbody className='text-muted'>
                <tr className='border-b border-border/50'>
                  <td className='py-2 pr-4'>Direct emissions factor</td>
                  <td className='py-2 pr-4 font-mono'>{entry!.defaultDirectFactor} tCO2e/t</td>
                  <td className='py-2 text-accent text-xs'>Installation measurement required</td>
                </tr>
                <tr className='border-b border-border/50'>
                  <td className='py-2 pr-4'>Indirect emissions factor</td>
                  <td className='py-2 pr-4 font-mono'>{entry!.defaultIndirectFactor} tCO2e/${entry!.sector === 'electricity' ? 'MWh' : 't'}`</td>
                  <td className='py-2 text-xs'>${entry!.indirectEmissionsInScope ? 'Grid factor from installation records' : 'Not in scope'}`</td>
                </tr>
                <tr className='border-b border-border/50'>
                  <td className='py-2 pr-4'>Total benchmark</td>
                  <td className='py-2 pr-4 font-mono font-bold text-foreground'>${entry!.benchmarkTco2ePerTonne !== null ? `${entry!.benchmarkTco2ePerTonne} tCO2e/t` : `${entry!.defaultIndirectFactor} tCO2e/MWh`}`</td>
                  <td className='py-2 text-xs text-muted'>Per Implementing Regulation (EU) 2023/1773</td>
                </tr>
                <tr className='border-b border-border/50'>
                  <td className='py-2 pr-4'>Indirect emissions in scope</td>
                  <td className='py-2 pr-4'>${entry!.indirectEmissionsInScope ? 'Yes' : 'No'}`</td>
                  <td className='py-2 text-xs'>Per Regulation (EU) 2023/956 sector rules</td>
                </tr>
                <tr>
                  <td className='py-2 pr-4'>Precursor tracking required</td>
                  <td className='py-2 pr-4'>${entry!.requiresPrecursorTracking ? 'Yes' : 'No'}`</td>
                  <td className='py-2 text-xs text-muted'>${entry!.requiresPrecursorTracking ? 'Upstream material emissions must be accounted' : 'Installation-level only'}`</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className='mb-10' aria-labelledby='boundary-heading'>
          <h2 id='boundary-heading' className='text-xl font-bold mb-3'>System Boundary for CN Code {code}</h2>
          <p className='text-sm text-muted leading-relaxed'>{entry!.systemBoundaryNote}</p>
          <p className='text-sm text-muted leading-relaxed mt-3'>
            The transitional period under{' '}
            <a href='https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R0956' target='_blank' rel='noopener noreferrer' className='text-accent underline underline-offset-2'>
              Regulation (EU) 2023/956
            </a>{' '}
            runs until 31 December 2025. From 1 January 2026, EU importers must surrender CBAM certificates annually for all covered CN codes including {code}.
          </p>
        </section>

        <section className='mb-10 border-t border-border pt-8' aria-labelledby='reg-heading'>
          <h2 id='reg-heading' className='text-lg font-bold mb-4'>Official Regulatory References</h2>
          <ul className='space-y-2 text-sm'>
            <li>
              <a href={entry!.eurLexUrl} target='_blank' rel='noopener noreferrer' className='text-accent underline underline-offset-2 hover:no-underline'>
                Regulation (EU) 2023/956 — Annex I (${sectorLabel})
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
          </ul>
        </section>

        {relatedCodes.length > 0 && (
          <section className='mb-10' aria-labelledby='related-heading'>
            <h2 id='related-heading' className='text-lg font-bold mb-4'>Related ${sectorLabel} CN Codes</h2>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
              {relatedCodes.map((rc) => (
                <Link key={rc.code} href={`/cn-codes/${rc.code}/${rc.sector}`} className='block p-4 bg-surface border border-border rounded-xl hover:border-accent/40 transition-colors'>
                  <span className='font-mono text-accent text-sm font-bold'>{rc.code}</span>
                  <p className='text-xs text-muted mt-1 line-clamp-2'>{rc.description}</p>
                  {rc.benchmarkTco2ePerTonne !== null && <span className='text-xs text-muted mt-1 block'>{rc.benchmarkTco2ePerTonne} tCO2e/t</span>}
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className='bg-accent/5 border border-accent/20 rounded-xl p-6 mb-10'>
          <h2 className='font-bold text-lg mb-2'>Ready to Calculate Your CBAM Obligations?</h2>
          <p className='text-sm text-muted mb-4'>
            Start a dossier for CN code {code}. Enter production data, link evidence, and generate a sealed CBAM Exporter Verification Preparation Pack.
          </p>
          <Link href={`/register?next=/cases/new&cn=${code}&sector=${sector}`} className='inline-flex items-center justify-center gap-2 rounded-md bg-accent px-6 py-3 font-medium text-surface transition-colors hover:bg-accent-hover'>
            Start Your CBAM Dossier for {code}
          </Link>
        </section>

        <ExpertAuthoritySection toolName={`CBAM Calculator — ${sectorLabel}`} />

        <div className='mt-8 p-4 border border-border/50 rounded-lg text-xs text-muted'>
          <strong>Regulatory Disclaimer:</strong> CBAMValid is not an EU institution or accredited CBAM verifier. Benchmark values are EU defaults from official regulations and may be superseded. Final CBAM obligations must be verified by accredited verifiers and submitted to the EU CBAM Registry.
        </div>
      </main>
    </div>
  );
}
