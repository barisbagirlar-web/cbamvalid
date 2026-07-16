import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Globe2, Shield } from "lucide-react";
import { COMMERCIAL_CONTRACT, formatCommercialPrice } from "@/lib/billing/commercial-contract";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import {
  generateFAQSchema,
  generateOrganizationSchema,
  generateWebApplicationSchema,
  generateWebSiteSchema,
} from "@/lib/seo/schema";

export const metadata = generateSeoMetadata("/");

export default function HomePage() {
  const price = formatCommercialPrice();
  const jsonLd = [
    generateOrganizationSchema(),
    generateWebSiteSchema(),
    generateWebApplicationSchema(
      "Prepare evidence-linked CBAM calculations and a signed verifier-preparation dossier with professional PDF and controlled XLSX outputs."
    ),
    generateFAQSchema([
      {
        question: "What does the CBAMValid Preparation Pack include?",
        answer: `One ${price} purchase adds ${COMMERCIAL_CONTRACT.creditsGranted} account credits. Those credits unlock one case-scoped Preparation Pack with ${COMMERCIAL_CONTRACT.releasesPerPack} sealed versions.`,
      },
      {
        question: "Does CBAMValid provide an accredited verification opinion?",
        answer: "No. CBAMValid prepares calculations, evidence mappings and controlled deliverables for review by an independent accredited verifier.",
      },
    ]),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <main className="flex-1">
        <section className="mx-auto max-w-7xl px-6 py-20 lg:py-28">
          <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
            <div className="max-w-2xl space-y-6">
              <div className="inline-flex items-center rounded-full border border-border bg-accent-soft px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-accent">
                <Globe2 className="mr-2 h-4 w-4" strokeWidth={1.75} />
                Definitive-period verifier preparation
              </div>

              <h1 className="text-4xl font-bold leading-[1.1] tracking-tight lg:text-6xl">
                CBAM evidence, calculations and
                <span className="block text-accent">controlled verifier deliverables</span>
              </h1>

              <p className="text-base leading-relaxed text-muted md:text-lg">
                Build one evidence-linked CBAM case, resolve automated blockers, and generate a signed 27-component verifier-preparation package with professional PDF, controlled XLSX, immutable hashes and calculation traceability.
              </p>

              <div className="rounded-xl border border-border bg-neutral-soft p-4 text-sm leading-relaxed">
                <strong>{price} one-time purchase.</strong> {COMMERCIAL_CONTRACT.creditsGranted} account credits unlock one selected case with {COMMERCIAL_CONTRACT.releasesPerPack} sealed versions. No subscription or automatic renewal.
              </div>

              <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
                <Link href="/register?next=/cases/new" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 font-medium text-surface transition-colors hover:bg-accent-hover">
                  Start a Dossier <ArrowRight size={18} strokeWidth={1.75} />
                </Link>
                <Link href="/how-it-works" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border-strong px-5 py-3 font-medium transition-colors hover:bg-neutral-soft">
                  Review the Workflow
                </Link>
                <Link href="/sample-dossier" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border-strong px-5 py-3 font-medium transition-colors hover:bg-neutral-soft">
                  View Sample Dossier
                </Link>
              </div>
            </div>

            <section className="hidden rounded-xl border border-border bg-surface p-8 shadow-[var(--shadow-card)] lg:block">
              <div className="flex items-center justify-between border-b border-border/50 pb-4">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-accent" strokeWidth={1.75} />
                  <span className="font-semibold">Verifier-Preparation Pack</span>
                </div>
                <span className="rounded-full border border-border bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">{price}</span>
              </div>
              <div className="mt-5 space-y-3 text-sm">
                {[
                  ["Professional operator emissions PDF", "Included"],
                  ["Controlled verifier XLSX workspace", "Included"],
                  ["27-component signed ZIP dossier", "Included"],
                  ["KMS signature and immutable manifest", "Included"],
                  ["Case-scoped sealed versions", String(COMMERCIAL_CONTRACT.releasesPerPack)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 border-b border-border/30 py-2">
                    <span className="text-muted">{label}</span>
                    <span className="font-semibold text-accent">{value}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>

        <section className="border-t border-border bg-surface py-20">
          <div className="mx-auto max-w-7xl px-6 text-center">
            <h2 className="font-serif text-3xl font-bold">See the controlled workflow before purchase</h2>
            <p className="mx-auto mb-10 mt-4 max-w-2xl text-lg text-muted">
              Drafting and automated checks are available before pack unlock. Credits are deducted only when you explicitly bind one Preparation Pack to one case.
            </p>
            <div className="group relative mx-auto block max-w-4xl overflow-hidden rounded-xl border border-border bg-black shadow-2xl">
              <div className="relative aspect-video">
                <Image
                  src="/media/cbamvalid-product-walkthrough-poster.webp"
                  alt="CBAMValid product workflow"
                  fill
                  sizes="(min-width: 1024px) 896px, 100vw"
                  className="object-cover opacity-80"
                  priority
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/90 shadow-lg transition-transform group-hover:scale-110">
                    <div className="ml-2 h-0 w-0 border-y-8 border-l-12 border-y-transparent border-l-white" />
                  </div>
                </div>
              </div>
            </div>
            <Link href="/how-it-works" className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-accent px-8 py-3 font-medium text-surface transition-colors hover:bg-accent-hover">
              Open Full Walkthrough <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="border-t border-border bg-neutral-soft py-20">
          <div className="mx-auto max-w-7xl px-6">
            <h2 className="mb-12 text-center text-xl font-bold md:text-2xl">End-to-end commercial and evidence workflow</h2>
            <div className="grid grid-cols-1 gap-6 text-sm md:grid-cols-5">
              {[
                "Create and validate a case draft",
                `Purchase ${COMMERCIAL_CONTRACT.creditsGranted} credits for ${price}`,
                "Unlock one case-scoped Preparation Pack",
                "Seal up to five correction-controlled versions",
                "Download and verify PDF, XLSX, manifest, signature and ZIP",
              ].map((step, index) => (
                <section key={step} className="space-y-3 rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
                  <span className="font-mono text-xs font-bold text-accent">Step {index + 1}</span>
                  <p className="font-semibold">{step}</p>
                </section>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-background py-20">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="mb-12 text-center text-xl font-bold md:text-2xl">Product boundary</h2>
            <div className="grid gap-8 md:grid-cols-2">
              <article className="rounded-xl border border-border bg-surface p-6">
                <h3 className="text-lg font-semibold">What is delivered?</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  A sealed verifier-preparation package containing evidence registers, calculation trace, quality controls, monitoring-plan coverage, professional PDFs and a controlled XLSX review workspace.
                </p>
              </article>
              <article className="rounded-xl border border-border bg-surface p-6">
                <h3 className="text-lg font-semibold">What is not delivered?</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  CBAMValid does not issue an accredited verification opinion, customs decision, Registry submission or acceptance guarantee. Independent verification remains a separate legal process.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl space-y-8 border-t border-border px-6 py-20">
          <div className="space-y-6 rounded-xl border border-border bg-surface p-6 shadow-[var(--shadow-card)] md:p-10">
            <div className="flex gap-3">
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0" strokeWidth={1.75} />
              <div>
                <h3 className="text-lg font-bold">Trust statement</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  The calculation, evidence, commercial and artifact contracts are server-controlled and covered by build, property, integration, commerce and report-package tests.
                </p>
              </div>
            </div>
            <div className="border-t border-border pt-6">
              <p className="text-xs leading-relaxed text-subtle">
                CBAMValid is an independent preparation platform. Actual emissions and supporting systems must be reviewed by an independent accredited verifier where legally required.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
