import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLdForRoute } from "@/components/seo/JsonLdForRoute";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { getRelatedCnEntries } from "@/lib/seo/cn-related-links";
import { evaluateCnIndexability } from "@/lib/seo/indexability";
import { listIndexablePublicCnEntries } from "@/lib/seo/cn-public-registry";
import { SEO_LEGAL_SOURCE_INDEX } from "@/lib/seo/regulatory-sources";

interface PageProps {
  params: Promise<{ code: string }>;
}

/**
 * Only Stage-1 verified allowlist codes are routable entities.
 * Unknown / unsupported CN detail URLs must hard-404 (not soft-404 + noindex).
 */
export const dynamicParams = false;

export async function generateStaticParams() {
  return listIndexablePublicCnEntries().map((entry) => ({ code: entry.cnCode }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;
  const result = evaluateCnIndexability(code);
  if (!result.indexable || !result.entry) {
    notFound();
  }
  return generateSeoMetadata(`/cn-code/${result.entry.cnCode}`);
}

export default async function CNCodeLandingPage({ params }: PageProps) {
  const { code } = await params;
  const result = evaluateCnIndexability(code);
  if (!result.indexable || !result.entry) {
    notFound();
  }

  const entry = result.entry;
  const relatedEntries = getRelatedCnEntries(entry.cnCode);
  const legal = SEO_LEGAL_SOURCE_INDEX.REG_2023_956;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <JsonLdForRoute path={`/cn-code/${entry.cnCode}`} />

      <main className="flex-1 max-w-3xl mx-auto px-6 py-16">
        <nav aria-label="Breadcrumb" className="text-sm text-muted mb-6">
          <ol className="flex flex-wrap gap-2">
            <li>
              <Link href="/" className="hover:text-accent">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/cn-code" className="hover:text-accent">
                CN Codes
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-foreground font-mono">{entry.cnCode}</li>
          </ol>
        </nav>

        <p className="text-xs font-mono uppercase tracking-widest text-accent mb-3">
          {entry.sector.replace("_", " ")} · CBAM Annex I scope
        </p>
        <h1 className="font-serif text-4xl tracking-tight text-foreground mb-4">
          CN {entry.cnCode} — CBAM Scope
        </h1>
        <p className="text-lg text-muted leading-relaxed mb-10">{entry.description}</p>

        <section className="mb-10 space-y-3">
          <h2 className="text-2xl font-serif">Direct answer</h2>
          <p className="text-sm text-muted leading-relaxed">
            CN code {entry.cnCode} is treated as in-scope for CBAM goods classification under the
            official scope dataset used by CBAMValid ({legal.id}). This page helps producers and
            importers understand the sector context, production-route considerations, and evidence
            needed before independent accredited verification.
          </p>
        </section>

        <section className="mb-10 space-y-3">
          <h2 className="text-2xl font-serif">Key facts</h2>
          <ul className="list-disc pl-5 space-y-2 text-sm text-muted">
            <li>Sector: {entry.sector}</li>
            <li>Effective from: {entry.effectiveFrom}</li>
            <li>Legal source: {legal.title}</li>
            <li>
              Default emission factors are multi-dimensional (year, country, route, direct/indirect)
              and are not collapsed into a single CN-level number on this page.
            </li>
          </ul>
        </section>

        <section className="mb-10 space-y-3">
          <h2 className="text-2xl font-serif">Production-route considerations</h2>
          <ul className="list-disc pl-5 space-y-2 text-sm text-muted">
            {entry.productionRoutes.map((route) => (
              <li key={route}>{route}</li>
            ))}
          </ul>
        </section>

        <section className="mb-10 space-y-3">
          <h2 className="text-2xl font-serif">Required producer data</h2>
          <ul className="list-disc pl-5 space-y-2 text-sm text-muted">
            {entry.requiredProducerData.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="mb-10 space-y-3">
          <h2 className="text-2xl font-serif">Evidence considerations</h2>
          <ul className="list-disc pl-5 space-y-2 text-sm text-muted">
            {entry.evidenceConsiderations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="mb-10 space-y-3">
          <h2 className="text-2xl font-serif">Related CBAM CN codes</h2>
          <p className="text-sm text-muted leading-relaxed">
            Review adjacent in-scope goods to compare sector context, producer-data requirements,
            and evidence expectations before starting a working file.
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {relatedEntries.map((related) => (
              <li key={related.cnCode}>
                <Link
                  href={`/cn-code/${related.cnCode}`}
                  className="block rounded-md border border-border bg-surface p-4 text-sm hover:border-accent"
                >
                  <span className="block font-mono text-accent">CN {related.cnCode}</span>
                  <span className="mt-1 block text-muted">{related.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-10 space-y-3">
          <h2 className="text-2xl font-serif">What CBAMValid prepares</h2>
          <p className="text-sm text-muted leading-relaxed">
            CBAMValid structures installation, goods, calculation and evidence records into an
            Exporter Verification Preparation Pack for independent accredited verification. It does
            not issue an accredited verification opinion or EU/customs approval.
          </p>
        </section>

        <div className="rounded-md border border-border bg-surface p-6 mb-10">
          <Link
            href={`/register?next=${encodeURIComponent(`/cases/new?cn=${entry.cnCode}`)}`}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-6 py-3 text-sm font-medium text-surface"
          >
            Start a Dossier for CN {entry.cnCode}
          </Link>
        </div>

        <section className="border-t border-border pt-6 text-xs text-muted space-y-2">
          <h2 className="text-sm font-semibold text-foreground">Regulatory source / review</h2>
          <p>Primary source: {legal.title}</p>
          <p>
            Source URL:{" "}
            <a className="text-accent underline" href={legal.eliUri} rel="noreferrer" target="_blank">
              {legal.eliUri}
            </a>
          </p>
          <p>Last content review: {entry.factualLastModified}</p>
          <p>
            Interpretation boundary: CBAMValid provides preparation software guidance only — not
            legal advice or accredited verification.
          </p>
        </section>
      </main>
    </div>
  );
}
