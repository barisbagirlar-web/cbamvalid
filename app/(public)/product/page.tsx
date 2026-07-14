import Link from "next/link";
import {
  ArrowRight,
  FileArchive,
  FileCheck2,
  FolderSearch2,
  ShieldCheck,
} from "lucide-react";

export const metadata = {
  title: "Exporter Verification Preparation Pack | CBAMValid",
  description: "Prepare one installation-year CBAM dossier with evidence traceability, quality findings, calculations and a sealed verifier-preparation package.",
};

const workflow = [
  ["1", "Case & Reporting Scope", "Define the exporter, declarant, installation and reporting year."],
  ["2", "Goods & Customs Data", "Record linked goods, CN codes, production quantities and shipment data."],
  ["3", "Installation & Production Route", "Document monitored processes, boundaries and production routes."],
  ["4", "Embedded Emissions", "Calculate direct, indirect and product-specific embedded emissions."],
  ["5", "Precursors & Adjustments", "Document relevant precursors and supported carbon-price adjustments."],
  ["6", "Evidence Register", "Upload, hash and link source documents to material data fields."],
  ["7", "Quality Review", "Resolve missing evidence, inconsistencies, blockers and methodology findings."],
  ["8", "Seal & Deliverables", "Generate an immutable package with a data-integrity manifest."],
] as const;

const deliverables = [
  "Product Scope Assessment",
  "CN Code Reasoning",
  "Required Data Checklist",
  "Installation Monitoring Plan",
  "Production Process Map",
  "System Boundary Register",
  "Source Stream Register",
  "Emission Source Register",
  "Measurement and Meter Register",
  "Activity Data Ledger",
  "Evidence Register",
  "Field-to-Evidence Matrix",
  "Methodology Decision Log",
  "Embedded Emissions Calculation Annex",
  "Operator Emissions Report",
  "Operator Summary Emissions Report",
  "Verification Readiness Assessment",
  "Misstatement and Non-Conformity Register",
  "Corrective Action Log",
  "O3CI Field-Mapped Structured Export",
  "Calculation Trace",
  "Data Integrity Manifest",
  "Supporting Evidence Folder",
] as const;

export default function ProductPage() {
  return (
    <main className="bg-background text-foreground">
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-24 md:px-10 md:pt-32">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.22em] text-accent">
              CBAMValid Exporter Verification Preparation Pack
            </p>
            <h1 className="max-w-4xl font-serif text-4xl font-bold tracking-tight md:text-6xl">
              Turn installation, emissions and evidence data into a verifier-preparation dossier.
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-relaxed text-muted">
              Built for non-EU producers and exporters of CBAM-covered goods. Prepare one installation and one reporting year, link supporting evidence, resolve quality findings and generate a sealed 23-component package.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/register?next=/cases/new" className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-accent px-6 font-semibold text-surface hover:bg-accent-hover">
                Create Your Draft Dossier <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/sample-dossier" className="inline-flex h-12 items-center justify-center rounded-md border border-border-strong px-6 font-semibold hover:bg-neutral-soft">
                View Sample Dossier
              </Link>
            </div>
            <p className="mt-4 text-sm text-muted">
              Draft preparation is free. Purchase the $150 Preparation Pack only before sealing and downloading final deliverables.
            </p>
          </div>

          <div className="rounded-3xl border border-border bg-surface p-7 shadow-sm">
            <p className="text-sm font-bold text-accent">Commercial scope</p>
            <div className="mt-5 space-y-4 text-sm">
              <ScopeRow label="Installation" value="1" />
              <ScopeRow label="Reporting year" value="1" />
              <ScopeRow label="Production processes" value="Defined in the dossier" />
              <ScopeRow label="Linked goods / CN groups" value="Included in the selected case" />
              <ScopeRow label="Successful sealed versions" value="5" />
              <ScopeRow label="Price" value="$150 USD" strong />
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 md:grid-cols-3 md:px-10">
          <ValueCard icon={<FolderSearch2 />} title="Field-to-evidence lineage" text="Material inputs are linked to source files, page references, SHA-256 hashes and review status." />
          <ValueCard icon={<ShieldCheck />} title="Fail-closed quality review" text="Open blockers prevent sealing. Failed generation consumes no report version." />
          <ValueCard icon={<FileArchive />} title="Immutable release package" text="Each successful version receives a release ID, calculation hash, manifest hash and package hash." />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 md:px-10">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Workflow</p>
          <h2 className="mt-3 font-serif text-3xl font-bold md:text-4xl">A structured eight-step preparation process</h2>
          <p className="mt-4 leading-relaxed text-muted">The workflow separates data collection, evidence linkage, quality remediation and final sealing so users can see exactly what remains incomplete.</p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {workflow.map(([number, title, description]) => (
            <div key={number} className="rounded-2xl border border-border bg-surface p-6">
              <div className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-surface">{number}</span>
                <div>
                  <h3 className="font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-20 md:px-10">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Final delivery</p>
              <h2 className="mt-3 font-serif text-3xl font-bold md:text-4xl">23 top-level components in one verifier-preparation package</h2>
              <p className="mt-4 leading-relaxed text-muted">PDF reports, CSV registers, calculation trace, O3CI field mapping, integrity manifest and the linked supporting evidence are assembled into one downloadable ZIP.</p>
              <Link href="/sample-dossier" className="mt-6 inline-flex items-center gap-2 font-semibold text-accent hover:underline">
                Review the sample structure <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {deliverables.map((item, index) => (
                <div key={item} className="flex items-start gap-3 rounded-xl border border-border bg-background p-4 text-sm">
                  <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <span><strong>{String(index + 1).padStart(2, "0")}.</strong> {item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20 text-center md:px-10">
        <h2 className="font-serif text-3xl font-bold md:text-4xl">Prepare the case before you pay.</h2>
        <p className="mx-auto mt-4 max-w-3xl leading-relaxed text-muted">
          Create and review a draft without charge. The $150 pack is linked to one dossier and unlocks five successful sealed versions. Failed or blocked seals and re-downloads consume no version.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/register?next=/cases/new" className="inline-flex h-12 items-center justify-center rounded-md bg-accent px-7 font-semibold text-surface hover:bg-accent-hover">
            Start Your Verification Preparation Pack
          </Link>
          <Link href="/pricing" className="inline-flex h-12 items-center justify-center rounded-md border border-border-strong px-7 font-semibold hover:bg-neutral-soft">
            View Pricing
          </Link>
        </div>
      </section>

      <section className="border-t border-border bg-neutral-soft">
        <div className="mx-auto max-w-5xl px-6 py-10 text-sm leading-relaxed text-muted md:px-10">
          <p className="font-bold text-foreground">Verification and regulatory boundary</p>
          <p className="mt-2">
            CBAMValid prepares data and evidence for independent verification. It does not issue an accredited verifier&apos;s opinion, customs approval, EU approval or acceptance guarantee. The O3CI field-mapped structured export is not an official CBAM Registry submission file. Users remain responsible for source-data accuracy and professional review where required.
          </p>
        </div>
      </section>
    </main>
  );
}

function ScopeRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="flex items-start justify-between gap-4 border-b border-border pb-3"><span className="text-muted">{label}</span><span className={`text-right ${strong ? "text-lg font-bold text-accent" : "font-semibold"}`}>{value}</span></div>;
}

function ValueCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">{icon}</div>
      <h3 className="mt-4 font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
    </div>
  );
}
