import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Calculator,
  CheckCircle2,
  FileArchive,
  FileSpreadsheet,
  FileText,
  Fingerprint,
  Layers,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { COMMERCIAL_CONTRACT, formatCommercialPrice } from "@/lib/billing/commercial-contract";

export const metadata: Metadata = {
  title: "CBAMValid Product | Evidence-Linked Verifier-Preparation Software",
  description: "Build evidence-linked CBAM cases, resolve automated blockers and generate a signed 27-component verifier-preparation package with controlled PDF, XLSX, CSV and manifest outputs.",
};

const workflow = [
  { title: "Create the account and case", description: "A revocation-checked server session creates the trusted user profile and opens a private case workspace." },
  { title: "Define goods and installation scope", description: "Record reporting period, CN codes, production route, output quantities and system boundaries with strict schemas and units." },
  { title: "Link immutable evidence", description: "Upload supporting records, calculate SHA-256 hashes and connect each source document to the input it supports." },
  { title: "Calculate and resolve blockers", description: "Run decimal-safe emissions calculations, allocation reconciliation, evidence coverage and deterministic quality controls." },
  { title: `Purchase ${COMMERCIAL_CONTRACT.creditsGranted} credits`, description: `${formatCommercialPrice()} is processed through a server-created Paddle transaction. Browser-supplied prices and order identities are rejected.` },
  { title: "Unlock one selected case", description: `Explicit unlock deducts ${COMMERCIAL_CONTRACT.creditsRequiredToUnlock} credits exactly once and creates a case-scoped Preparation Pack.` },
  { title: "Generate controlled sealed versions", description: `The pack provides ${COMMERCIAL_CONTRACT.releasesPerPack} releases. Releases 2–5 require a correction reason and sequential version number.` },
  { title: "Download and verify the package", description: "Review the 27 top-level components, manifest hashes, signature, PDF reports, verifier workbook, schedules and supporting evidence." },
] as const;

const deliverables = [
  {
    icon: FileText,
    title: "Professional PDF reports",
    description: "Operator emissions report, executive verification-readiness summary, calculation and control narratives, navigation guide and verifier-boundary statements.",
  },
  {
    icon: FileSpreadsheet,
    title: "Controlled verifier workspace",
    description: "A multi-sheet XLSX workbook with filters, frozen panes, conditional formatting, validation lists, legal sources, quality controls and sign-off fields.",
  },
  {
    icon: FileArchive,
    title: "Signed 27-component ZIP",
    description: "Per-good and carbon-price schedules, evidence index, monitoring-plan coverage, calculation trace, integrity manifest, signature and supporting evidence.",
  },
] as const;

export default function ProductPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="border-b border-border bg-gradient-to-b from-neutral-soft/60 to-background py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-6 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Evidence-linked CBAM preparation</p>
            <h1 className="mt-4 font-serif text-4xl font-bold leading-tight tracking-tight md:text-5xl">
              One controlled workflow from raw production data to verifier-ready deliverables
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted">
              CBAMValid converts a structured case, evidence register and deterministic calculation trace into a signed preparation package for independent review. It does not issue an accredited verification opinion or submit to the EU Registry.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/register?next=/cases/new" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-accent px-7 font-semibold text-surface hover:bg-accent-hover">
                Start a Free Draft <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/pricing" className="inline-flex min-h-12 items-center justify-center rounded-md border border-border-strong px-7 font-semibold hover:bg-neutral-soft">
                Review Pricing
              </Link>
            </div>
          </div>

          <aside className="rounded-3xl border border-border bg-surface p-8 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-accent" /><span className="font-semibold">Canonical Preparation Pack</span></div>
              <span className="rounded-full bg-accent-soft px-3 py-1 text-sm font-bold text-accent">{formatCommercialPrice()}</span>
            </div>
            <dl className="mt-6 space-y-4 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-muted">Credits granted</dt><dd className="font-mono font-bold">{COMMERCIAL_CONTRACT.creditsGranted}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">Credits deducted at case unlock</dt><dd className="font-mono font-bold">{COMMERCIAL_CONTRACT.creditsRequiredToUnlock}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">Cases unlocked</dt><dd className="font-mono font-bold">1</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">Sealed versions</dt><dd className="font-mono font-bold">{COMMERCIAL_CONTRACT.releasesPerPack}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">Top-level package components</dt><dd className="font-mono font-bold">27</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">Subscription</dt><dd className="font-bold">None</dd></div>
            </dl>
          </aside>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-serif text-3xl font-bold">Eight-stage controlled workflow</h2>
            <p className="mt-4 text-muted">Each transition has a typed input contract, explicit failure state and server-side authority boundary.</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {workflow.map((stage, index) => (
              <article key={stage.title} className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
                <span className="font-mono text-2xl font-bold text-accent/40">{String(index + 1).padStart(2, "0")}</span>
                <h3 className="mt-4 text-lg font-bold">{stage.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{stage.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-neutral-soft py-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Calculation integrity</p>
            <h2 className="mt-3 font-serif text-3xl font-bold">Deterministic calculations, units and traceability</h2>
            <p className="mt-5 leading-relaxed text-muted">
              Direct emissions, electricity, grid factors, precursors, allocation shares and per-good intensities are validated against strict units. Decimal arithmetic is isolated from display rounding, and every formula output carries its source values, unit and calculation hash.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "No implicit unit conversion or silent default masking",
                "Allocation shares reconcile to the installation total",
                "Evidence references are checked before sealing",
                "Materiality and quality-control outcomes are reproduced in the package",
              ].map((item) => <li key={item} className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" /><span>{item}</span></li>)}
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-7 shadow-sm">
            <div className="flex items-center gap-2 border-b border-border pb-4"><Calculator className="h-5 w-5 text-accent" /><h3 className="font-bold">Audit trace example</h3></div>
            <div className="mt-5 space-y-4 font-mono text-xs">
              <div className="rounded-lg bg-neutral-soft p-4"><span className="text-accent">DIRECT_EMISSIONS_TOTAL</span><p className="mt-2">80 tCO2e</p></div>
              <div className="rounded-lg bg-neutral-soft p-4"><span className="text-accent">INDIRECT_EMISSIONS_TOTAL</span><p className="mt-2">40 tCO2e</p></div>
              <div className="rounded-lg bg-neutral-soft p-4"><span className="text-accent">TOTAL_EMBEDDED_EMISSIONS</span><p className="mt-2">120 tCO2e</p></div>
              <div className="rounded-lg bg-neutral-soft p-4"><span className="text-accent">SPECIFIC_EMBEDDED_EMISSIONS</span><p className="mt-2">1.2 tCO2e/t</p></div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-serif text-3xl font-bold">What the sealed package contains</h2>
            <p className="mt-4 text-muted">The package is designed for structured review, not automatic regulatory acceptance.</p>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {deliverables.map(({ icon: Icon, title, description }) => (
              <article key={title} className="rounded-2xl border border-border bg-surface p-7 shadow-sm">
                <Icon className="h-7 w-7 text-accent" />
                <h3 className="mt-5 text-xl font-bold">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-surface py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-3">
          <article className="rounded-2xl border border-border bg-background p-7">
            <Fingerprint className="h-7 w-7 text-accent" />
            <h3 className="mt-4 text-xl font-bold">Integrity verification</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted">The integrity manifest lists SHA-256 hashes for package files. The manifest is signed and the sealed report can be checked through the document verification endpoint.</p>
          </article>
          <article className="rounded-2xl border border-border bg-background p-7">
            <LockKeyhole className="h-7 w-7 text-accent" />
            <h3 className="mt-4 text-xl font-bold">Atomic release consumption</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted">A release is consumed only after readiness validation, artifact generation, storage commit, signature completion and report-record finalization succeed.</p>
          </article>
          <article className="rounded-2xl border border-border bg-background p-7">
            <Layers className="h-7 w-7 text-accent" />
            <h3 className="mt-4 text-xl font-bold">Correction-controlled history</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted">The first sealed version establishes the case scope. Later versions remain tied to the same case and require an explicit reason describing the correction.</p>
          </article>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="rounded-3xl border border-amber-300 bg-amber-50 p-8">
            <div className="flex items-start gap-4">
              <AlertTriangle className="mt-1 h-7 w-7 shrink-0 text-amber-800" />
              <div>
                <h2 className="font-serif text-2xl font-bold text-amber-950">Mandatory verification boundary</h2>
                <p className="mt-4 text-sm leading-relaxed text-amber-950/80">
                  CBAMValid is independent preparation software. It is not an EU institution, customs authority or accredited verifier. The package does not constitute a verification opinion, Registry submission, customs decision or legal acceptance. An appointed independent accredited verifier must review the underlying data and evidence where verification is legally required.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-neutral-soft py-20 text-center">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="font-serif text-3xl font-bold">Review the workflow before purchase</h2>
          <p className="mx-auto mt-4 max-w-2xl leading-relaxed text-muted">Build and test the case as a draft, inspect the sample deliverables, then purchase credits only when the case is ready for controlled pack unlock.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/register?next=/cases/new" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-accent px-7 font-semibold text-surface hover:bg-accent-hover">Start a Dossier <ArrowRight className="h-4 w-4" /></Link>
            <Link href="/sample-dossier" className="inline-flex min-h-12 items-center justify-center rounded-md border border-border-strong bg-surface px-7 font-semibold hover:bg-background">View Sample Dossier</Link>
            <Link href="/pricing" className="inline-flex min-h-12 items-center justify-center rounded-md border border-border-strong bg-surface px-7 font-semibold hover:bg-background">View Pricing</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
