import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { siteConfig } from '@/lib/site-config';
import { generateBreadcrumbSchema, generateArticleSchema, generateEnterpriseGraphSchema } from '@/lib/seo/schema';
import { SECTOR_DETAILS } from '@/lib/cbam/sectors/sector-content';
import { getCnCodesBySector, CbamSectorSlug } from '@/lib/cbam/cn-codes/cn-code-registry';
import { ExpertAuthoritySection } from '@/components/seo/ExpertAuthoritySection';

interface PageProps {
  params: Promise<{ sector: string }>;
}

export async function generateStaticParams() {
  return Object.keys(SECTOR_DETAILS).map((sector) => ({ sector }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { sector } = await params;
  const detail = SECTOR_DETAILS[sector];
  if (!detail) return { title: 'Sector Not Found | CBAMValid', robots: { index: false, follow: false } };

  return {
    title: `${detail.name} CBAM Compliance Guide & System Boundary | CBAMValid`,
    description: `Official CBAM calculation rules for the ${detail.name} sector under Regulation (EU) 2023/956. Learn about system boundaries, precursors, and emissions benchmarks.`,
    alternates: { canonical: `${siteConfig.canonicalOrigin}/sectors/${sector}` },
    robots: { index: true, follow: true },
  };
}

export default async function SectorPage({ params }: PageProps) {
  const { sector } = await params;
  const detail = SECTOR_DETAILS[sector];
  if (!detail) notFound();

  const relatedCodes = getCnCodesBySector(sector as CbamSectorSlug);

  const jsonLd = [
    generateEnterpriseGraphSchema(`/sectors/${sector}`),
    generateBreadcrumbSchema([
      { name: 'Home', item: '/' },
      { name: 'Sectors', item: '/sectors' },
      { name: detail.name, item: `/sectors/${sector}` }
    ]),
    generateArticleSchema({
      headline: detail.headline,
      description: detail.introduction,
      url: `/sectors/${sector}`,
      citations: [
        { name: detail.regulationCitation, url: detail.regulationUrl },
        { name: 'Implementing Regulation (EU) 2023/1773', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R1773' }
      ]
    })
  ];

  return (
    <div className='min-h-screen bg-background text-foreground font-sans'>
      <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className='max-w-4xl mx-auto px-6 py-12'>
        <nav className='text-xs text-muted mb-8 flex items-center gap-1.5' aria-label='Breadcrumb'>
          <Link href='/' className='hover:text-accent'>Home</Link>
          <span>/</span>
          <Link href='/sectors' className='hover:text-accent'>Sectors</Link>
          <span>/</span>
          <span className='text-foreground font-semibold'>{detail.name}</span>
        </nav>

        <div className='mb-10'>
          <h1 className='text-3xl md:text-4xl font-serif font-bold tracking-tight mb-3'>{detail.headline}</h1>
          <p className='text-lg text-muted leading-relaxed'>{detail.introduction}</p>
          <p className='mt-3 text-xs text-muted'>
            Legal Basis:{' '}
            <a href={detail.regulationUrl} target='_blank' rel='noopener noreferrer' className='text-accent underline underline-offset-2 hover:no-underline'>
              {detail.regulationCitation}
            </a>
          </p>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-3 gap-8 mb-12'>
          <div className='md:col-span-2 space-y-8'>
            <section>
              <h2 className='text-xl font-bold mb-3'>System Boundary</h2>
              <p className='text-sm text-muted leading-relaxed'>{detail.systemBoundary}</p>
            </section>

            <section>
              <h2 className='text-xl font-bold mb-3'>Precursor Rules</h2>
              <p className='text-sm text-muted leading-relaxed'>{detail.precursorRules}</p>
            </section>

            <section>
              <h2 className='text-xl font-bold mb-3'>Electricity &amp; Indirect Emissions</h2>
              <p className='text-sm text-muted leading-relaxed'>{detail.electricityRules}</p>
            </section>
          </div>

          <div className='bg-surface border border-border rounded-xl p-6 h-fit shadow-sm'>
            <h3 className='font-bold text-sm mb-4 uppercase tracking-wider text-muted'>Sector CN Codes</h3>
            <ul className='space-y-3'>
              {relatedCodes.map((rc) => (
                <li key={rc.code}>
                  <Link href={`/cn-codes/${rc.code}/${rc.sector}`} className='group block'>
                    <span className='font-mono text-accent text-xs font-bold group-hover:underline'>{rc.code}</span>
                    <span className='text-xs text-muted block line-clamp-1'>{rc.description}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <section className='bg-accent/5 border border-accent/20 rounded-xl p-6 mb-10'>
          <h2 className='font-bold text-lg mb-2'>Exporter Verification Preparation for {detail.name}</h2>
          <p className='text-sm text-muted mb-4'>
            Are you exporting products in the {detail.name} sector? Calculate actual embedded emissions, track precursors, align system boundaries, and compile your evidence dossier.
          </p>
          <Link href='/register?next=/cases/new' className='inline-flex items-center justify-center gap-2 rounded-md bg-accent px-6 py-3 font-medium text-surface transition-colors hover:bg-accent-hover'>
            Start CBAM Calculation
          </Link>
        </section>

        <ExpertAuthoritySection toolName={`CBAM Sector Compliance Tool — ${detail.name}`} />

        <div className='mt-8 p-4 border border-border/50 rounded-lg text-xs text-muted'>
          <strong>Disclaimer:</strong> CBAMValid is an independent compliance preparation platform and is not affiliated with the European Commission or any EU member state authority.
        </div>
      </main>
    </div>
  );
}
