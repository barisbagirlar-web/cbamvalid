import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { siteConfig } from "@/lib/site-config";
import { generateBreadcrumbSchema } from "@/lib/seo/schema";
import { PREPARATION_PACK } from "@/lib/commerce/preparation-pack";

const VALID_CHAPTERS = ["72", "73", "76", "25", "27", "28", "31"];

interface PageProps {
  params: Promise<{ code: string }>;
}

function validCode(code: string): boolean {
  return /^\d{8}$/.test(code) && VALID_CHAPTERS.includes(code.slice(0, 2));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;
  if (!validCode(code)) {
    return { title: "Invalid CN Code | CBAMValid", robots: { index: false, follow: false } };
  }

  return {
    title: `CBAM Preparation for CN Code ${code} | CBAMValid`,
    description: `Prepare evidence-linked embedded-emissions calculations and verifier-preparation dossier schedules for CBAM goods under CN code ${code}.`,
    alternates: { canonical: `${siteConfig.canonicalOrigin}/cn-code/${code}` },
    robots: { index: true, follow: true },
  };
}

export default async function CNCodeLandingPage({ params }: PageProps) {
  const { code } = await params;
  if (!validCode(code)) notFound();
  const chapter = code.slice(0, 2);
  const nextRoute = `/cases/new?cn=${code}`;

  const jsonLd = [
    generateBreadcrumbSchema([
      { name: "Home", item: "/" },
      { name: "CN Code Hub", item: "/cn-code" },
      { name: `CN Code ${code}`, item: `/cn-code/${code}` },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: `CBAM Preparation Software for ${code}`,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      offers: {
        "@type": "Offer",
        price: (PREPARATION_PACK.priceMinor / 100).toFixed(2),
        priceCurrency: PREPARATION_PACK.currency,
      },
      description: `Evidence-linked CBAM calculation and verifier-preparation dossier software for CN code ${code}.`,
    },
  ];

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-24 text-center text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 inline-flex items-center rounded-full border border-border bg-surface px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-accent">CBAM chapter {chapter}</div>
        <h1 className="mb-6 font-serif text-4xl font-normal leading-tight tracking-tight md:text-6xl">CBAM preparation for<br /><span className="font-mono text-accent">CN {code}</span></h1>
        <p className="mb-8 text-lg leading-relaxed text-muted">Create an evidence-linked case for goods under CN code {code}. Calculate direct, indirect and precursor emissions, resolve readiness blockers and prepare controlled verifier schedules.</p>
        <p className="mb-10 text-sm text-muted">Drafting and calculations are free. One {PREPARATION_PACK.currency} {(PREPARATION_PACK.priceMinor / 100).toFixed(0)} Preparation Pack funds up to {PREPARATION_PACK.maxReleases} successful sealed versions for one case.</p>
        <Link href={`/register?next=${encodeURIComponent(nextRoute)}`} className="inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-8 py-4 text-base font-medium text-surface shadow-sm hover:bg-accent-hover">Start a Case for {code}</Link>
      </div>
    </main>
  );
}
