import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, CreditCard, FileArchive, LockKeyhole } from "lucide-react";
import { COMMERCIAL_CONTRACT, formatCommercialPrice } from "@/lib/billing/commercial-contract";

export const metadata: Metadata = {
  title: "How CBAMValid Works | Controlled CBAM Dossier Workflow",
  description: "Follow the CBAMValid workflow from trusted account access and evidence-linked case preparation to server-controlled payment, case pack unlock and signed 27-component dossier delivery.",
};

const workflowStages = [
  { title: "Account and private workspace", description: "Sign in through Firebase Authentication; CBAMValid establishes a revocation-checked HttpOnly server session before workspace access." },
  { title: "Case and reporting scope", description: "Define importer, exporter, reporting period, goods, CN codes, installation, production route and system boundaries." },
  { title: "Emissions and precursors", description: "Enter direct emissions, electricity, grid factors, production volumes, allocation shares, precursor data and carbon-price records with strict units." },
  { title: "Evidence register", description: "Upload source documents, record SHA-256 hashes and link evidence to the exact input or methodology decision it supports." },
  { title: "Calculation and quality review", description: "Run deterministic calculations, allocation reconciliation, coverage checks and blocker/warning controls without consuming credits." },
  { title: "Purchase account credits", description: `A one-time ${formatCommercialPrice()} server-created Paddle transaction grants ${COMMERCIAL_CONTRACT.creditsGranted} account credits after signed webhook verification.` },
  { title: "Unlock one case pack", description: `Explicit unlock deducts ${COMMERCIAL_CONTRACT.creditsRequiredToUnlock} credits exactly once and binds ${COMMERCIAL_CONTRACT.releasesPerPack} sealed versions to the selected case.` },
  { title: "Seal, download and verify", description: "Each successful release generates the controlled 27-component ZIP. Versions 2–5 require a correction reason and remain tied to the original case." },
] as const;

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-background pb-20 pt-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <section className="mx-auto mb-16 max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">A controlled preparation workflow</p>
          <h1 className="mt-4 font-serif text-4xl font-extrabold tracking-tight text-foreground md:text-5xl">
            How CBAMValid Works
          </h1>
          <p className="mt-6 text-xl leading-relaxed text-muted">
            Prepare and test the case as a draft, purchase credits through a server-authorized payment, unlock one case, then generate correction-controlled signed deliverables.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/register?next=/cases/new" className="flex w-full items-center justify-center rounded-full bg-accent px-8 py-3 font-medium text-surface transition-colors hover:bg-accent-hover sm:w-auto">
              Start a Free Draft <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link href="/sample-dossier" className="flex w-full items-center justify-center rounded-full border border-border bg-surface px-8 py-3 font-medium text-foreground transition-colors hover:bg-neutral-soft sm:w-auto">
              View Sample Dossier
            </Link>
            <Link href="/pricing" className="flex w-full items-center justify-center rounded-full border border-border bg-surface px-8 py-3 font-medium text-foreground transition-colors hover:bg-neutral-soft sm:w-auto">
              View Pricing
            </Link>
          </div>
        </section>

        <section className="mx-auto mb-20 max-w-5xl">
          <div className="mb-10 text-center">
            <h2 className="font-serif text-3xl font-bold text-foreground">See the case workflow</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted">
              The walkthrough covers data entry and evidence preparation. The commercial lifecycle below explains when payment, credit deduction and release consumption occur.
            </p>
          </div>
          <div className="group relative aspect-video overflow-hidden rounded-2xl border border-border bg-black shadow-2xl">
            <video
              controls
              playsInline
              preload="metadata"
              poster="/media/cbamvalid-product-walkthrough-poster.webp"
              aria-label="CBAMValid product workflow walkthrough"
              className="h-full w-full object-cover"
            >
              <source src="/media/cbamvalid-product-walkthrough.mp4#t=3" type="video/mp4" />
              <p className="p-4 text-white">Your browser does not support the video tag.</p>
            </video>
          </div>
        </section>

        <section className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {workflowStages.map((stage, index) => (
              <article key={stage.title} className="rounded-xl border border-border bg-surface p-6 transition-colors hover:border-accent/50">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-sm font-bold text-accent">{index + 1}</div>
                  <h3 className="font-bold text-foreground">{stage.title}</h3>
                </div>
                <p className="text-sm leading-relaxed text-muted">{stage.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-16 grid max-w-6xl gap-6 md:grid-cols-3">
          <article className="rounded-xl border border-border bg-neutral-soft p-6">
            <CreditCard className="h-6 w-6 text-accent" />
            <h2 className="mt-4 font-bold">Payment fulfillment</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">The browser receives only a server-created Paddle transaction ID. Signed webhook data must exactly match user, order, product, price, currency and amount before credits are written.</p>
          </article>
          <article className="rounded-xl border border-border bg-neutral-soft p-6">
            <LockKeyhole className="h-6 w-6 text-accent" />
            <h2 className="mt-4 font-bold">Atomic consumption</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">Credits are deducted during explicit case pack unlock, not while editing and not per individual seal. A release is consumed only after the report artifact transaction completes.</p>
          </article>
          <article className="rounded-xl border border-border bg-neutral-soft p-6">
            <FileArchive className="h-6 w-6 text-accent" />
            <h2 className="mt-4 font-bold">Verifier-preparation output</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">The final ZIP contains 27 top-level components including PDFs, XLSX, CSV schedules, evidence, calculation trace, manifest and signature.</p>
          </article>
        </section>

        <section className="mx-auto mt-16 max-w-4xl rounded-2xl border border-amber-300 bg-amber-50 p-7">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-amber-800" />
            <div>
              <h2 className="font-serif text-xl font-bold text-amber-950">Independent-verifier boundary</h2>
              <p className="mt-3 text-sm leading-relaxed text-amber-950/80">CBAMValid prepares calculation and evidence packages. It does not issue an accredited verification opinion, submit to the EU Registry, make a customs decision or guarantee regulatory acceptance.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
