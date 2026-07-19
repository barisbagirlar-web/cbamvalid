import Link from "next/link";
import { Check, FileEdit, ShieldCheck } from "lucide-react";
import { CREDIT_PACKAGES, formatPackagePrice } from "@/lib/billing/catalog";
import { COMMERCIAL_CONTRACT } from "@/lib/billing/commercial-contract";

export const metadata = {
  title: "Pricing | CBAMValid",
  description: `Prepare CBAM case drafts without charge. A one-time ${COMMERCIAL_CONTRACT.currency} purchase adds ${COMMERCIAL_CONTRACT.creditsGranted} credits that unlock one case-scoped Preparation Pack with ${COMMERCIAL_CONTRACT.releasesPerPack} sealed versions.`,
};

export default function PricingPage() {
  const product = CREDIT_PACKAGES[0];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto max-w-5xl px-6 pb-14 pt-24 text-center md:px-12">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">One commercial product · no subscription</p>
        <h1 className="mt-4 font-serif text-4xl font-bold tracking-tight md:text-5xl">
          Prepare the case first. Unlock the sealed package only when ready.
        </h1>
        <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-muted">
          Case creation, editing, calculations and automated readiness checks are available before purchase. Payment adds account credits; credits are deducted only when you explicitly bind one Preparation Pack to one selected case.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/register?next=/cases/new" className="inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-6 py-3 font-semibold text-surface hover:bg-accent-hover">
            Start a Free Draft
          </Link>
          <Link href="/sample-dossier" className="inline-flex min-h-11 items-center justify-center rounded-md border border-border-strong px-6 py-3 font-semibold hover:bg-neutral-soft">
            Review the Sample Package
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-8 px-6 pb-24 md:grid-cols-2 md:px-12">
        <article className="flex flex-col rounded-2xl border border-border bg-surface p-8 shadow-sm">
          <div className="flex items-center gap-3">
            <FileEdit className="h-6 w-6 text-muted" aria-hidden="true" />
            <div>
              <h2 className="text-2xl font-bold">Draft Workspace</h2>
              <p className="text-sm text-muted">No charge before pack unlock</p>
            </div>
          </div>
          <p className="my-7 font-serif text-5xl font-bold">$0</p>
          <ul className="flex-1 space-y-4 text-sm">
            {[
              "Create and edit CBAM cases",
              "Run deterministic emissions calculations",
              "Upload and hash supporting evidence",
              "Review blockers, warnings and calculation trace",
              "Save drafts without consuming credits",
            ].map((item) => <li key={item} className="flex items-start gap-3"><Check className="mt-0.5 h-5 w-5 shrink-0 text-muted" /><span>{item}</span></li>)}
          </ul>
          <Link href="/register?next=/cases/new" className="mt-8 inline-flex h-12 items-center justify-center rounded-md border border-border-strong font-semibold hover:bg-neutral-soft">
            Create a Draft
          </Link>
        </article>

        <article className="relative flex flex-col rounded-2xl border-2 border-accent bg-surface p-8 shadow-md">
          <span className="absolute right-5 top-5 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">One-time purchase</span>
          <div className="flex items-center gap-3 pr-28">
            <ShieldCheck className="h-6 w-6 text-accent" aria-hidden="true" />
            <div>
              <h2 className="text-2xl font-bold">{product.displayName}</h2>
              <p className="text-sm text-muted">One selected case · five controlled versions</p>
            </div>
          </div>
          <p className="my-7 font-serif text-5xl font-bold">{formatPackagePrice(product)}</p>
          <p className="mb-6 rounded-lg border border-border bg-neutral-soft p-4 text-sm leading-relaxed">
            Purchase grants <strong>{COMMERCIAL_CONTRACT.creditsGranted} credits</strong>. Explicit case unlock deducts exactly <strong>{COMMERCIAL_CONTRACT.creditsRequiredToUnlock} credits once</strong> and creates one case-scoped pack with <strong>{COMMERCIAL_CONTRACT.releasesPerPack} sealed releases</strong>.
          </p>
          <ul className="flex-1 space-y-4 text-sm">
            {[
              "27-component signed verifier-preparation ZIP",
              "Professional operator and executive-readiness PDFs",
              "Controlled verifier XLSX workspace",
              "Per-good emissions and carbon-price CSV schedules",
              "Manifest hashes, signature, evidence index and calculation trace",
              "Correction reason required for sealed releases 2–5",
              "No automatic renewal or recurring subscription",
            ].map((item) => <li key={item} className="flex items-start gap-3"><Check className="mt-0.5 h-5 w-5 shrink-0 text-accent" /><span>{item}</span></li>)}
          </ul>
          <Link href="/credits/buy" className="mt-8 inline-flex h-12 items-center justify-center rounded-md bg-accent font-semibold text-surface hover:bg-accent-hover">
            Purchase {COMMERCIAL_CONTRACT.creditsGranted} Credits
          </Link>
        </article>
      </section>

      <section className="border-t border-border bg-neutral-soft py-14">
        <div className="mx-auto max-w-4xl px-6 text-sm leading-relaxed text-muted">
          <h2 className="font-serif text-xl font-bold text-foreground">Commercial boundary</h2>
          <p className="mt-3">
            CBAMValid sells preparation software and controlled deliverables. The purchase does not include an accredited verification opinion, customs acceptance, Registry submission, regulatory approval or a guarantee that an authority will accept the underlying data.
          </p>
        </div>
      </section>
    </main>
  );
}
