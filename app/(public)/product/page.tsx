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
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { formatPreparationPackPrice, PREPARATION_PACK } from "@/lib/commerce/preparation-pack";

export const metadata: Metadata = {
  title: "CBAMValid Product | Verifier-Preparation Dossier Software",
  description: "Prepare evidence-linked CBAM calculations, resolve quality blockers and generate controlled PDF, XLSX and signed ZIP verifier-preparation deliverables.",
};

const WORKFLOW = [
  ["01", "Create the case", "Define one installation, reporting year, production scope and applicable CN codes."],
  ["02", "Enter source data", "Capture production, direct emissions, electricity, precursors and allocation data."],
  ["03", "Link evidence", "Connect each material input to approved, malware-clean source documents."],
  ["04", "Run calculations", "Execute decimal-safe embedded-emissions calculations and allocation reconciliation."],
  ["05", "Resolve blockers", "Clear missing evidence, invalid scope, arithmetic and readiness blockers."],
  ["06", "Purchase one pack", `Pay ${formatPreparationPackPrice()} USD once to add ${PREPARATION_PACK.accountCredits} account credits.`],
  ["07", "Seal successfully", `Each successful sealed version deducts ${PREPARATION_PACK.creditsPerRelease} credits atomically.`],
  ["08", "Download and verify", "Receive controlled PDF, verifier XLSX and a signed 27-component ZIP dossier."],
] as const;

const DELIVERABLES = [
  { icon: FileText, title: "Controlled PDF set", detail: "Professional operator report, readiness summary, calculation trace and verifier navigation documents." },
  { icon: FileSpreadsheet, title: "Verifier XLSX workspace", detail: "Structured calculation, goods, evidence, precursor and carbon-price schedules." },
  { icon: FileArchive, title: "Signed 27-component ZIP", detail: "Manifest, KMS signature, immutable case snapshot, evidence index and controlled deliverables." },
] as const;

export default function ProductPage() {
  return (
    <main className="bg-background text-foreground">
      <section className="border-b border-border bg-gradient-to-b from-neutral-soft/60 to-background py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 lg:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Evidence-linked definitive-period preparation</p>
            <h1 className="mt-4 font-serif text-4xl font-black tracking-tight md:text-5xl">One controlled CBAM verifier-preparation workflow</h1>
            <p className="mt-6 text-lg leading-relaxed text-muted">Create the case and calculate without payment. Purchase one Preparation Pack only before the first successful seal. The same pack funds five successful sealed versions for one case.</p>
            <div className="mt-6 rounded-xl border border-border bg-surface p-5 text-sm shadow-sm">
              <strong>{formatPreparationPackPrice()} USD one-time</strong> · {PREPARATION_PACK.accountCredits} credits · {PREPARATION_PACK.maxReleases} successful versions · no subscription
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/register?next=/cases/new" className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-accent px-6 font-semibold text-surface hover:bg-accent-hover">Start a Dossier <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/sample-dossier" className="inline-flex h-12 items-center justify-center rounded-md border border-border-strong px-6 font-semibold hover:bg-neutral-soft">Review Sample Dossier</Link>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-surface p-8 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-5"><span className="text-xs font-bold uppercase tracking-wider text-muted">Commercial conservation</span><ShieldCheck className="h-6 w-6 text-accent" /></div>
            <div className="mt-6 space-y-4 font-mono text-sm">
              <ConservationRow label="Successful payment" value="+100 credits" />
              <ConservationRow label="Successful seal v1" value="−20 → 80" />
              <ConservationRow label="Successful seal v2" value="−20 → 60" />
              <ConservationRow label="Successful seal v3" value="−20 → 40" />
              <ConservationRow label="Successful seal v4" value="−20 → 20" />
              <ConservationRow label="Successful seal v5" value="−20 → 0" />
              <ConservationRow label="Blocked or failed seal" value="0 debit" />
            </div>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center"><h2 className="font-serif text-3xl font-black">Eight controlled stages</h2><p className="mt-4 text-muted">The system separates drafting, readiness, payment, sealing and immutable delivery.</p></div>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {WORKFLOW.map(([number, title, detail]) => <article key={number} className="rounded-2xl border border-border bg-surface p-6 shadow-sm"><span className="font-mono text-xl font-black text-accent/40">{number}</span><h3 className="mt-4 font-bold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-muted">{detail}</p></article>)}
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-neutral-soft py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-6 md:grid-cols-3">
            {DELIVERABLES.map(({ icon: Icon, title, detail }) => <article key={title} className="rounded-2xl border border-border bg-surface p-7 shadow-sm"><Icon className="h-7 w-7 text-accent" /><h2 className="mt-5 font-serif text-xl font-bold">{title}</h2><p className="mt-3 text-sm leading-relaxed text-muted">{detail}</p></article>)}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-border bg-surface p-8 shadow-sm">
            <div className="flex items-center gap-3"><Calculator className="h-6 w-6 text-accent" /><h2 className="font-serif text-2xl font-bold">Calculation and evidence controls</h2></div>
            <ul className="mt-6 space-y-4 text-sm text-muted">
              <Control>Decimal-safe embedded-emissions calculations with reproducible trace inputs.</Control>
              <Control>Goods allocation reconciliation and specific-emissions denominator controls.</Control>
              <Control>Evidence ownership, hash, storage metadata, approval and malware-clean checks.</Control>
              <Control>Definitive-period ruleset and source-snapshot identification.</Control>
            </ul>
          </article>

          <article className="rounded-2xl border border-amber-300 bg-amber-50 p-8">
            <div className="flex items-center gap-3 text-amber-900"><AlertTriangle className="h-6 w-6" /><h2 className="font-serif text-2xl font-bold">Legal and verification boundary</h2></div>
            <p className="mt-6 text-sm leading-relaxed text-amber-950/80">CBAMValid prepares calculations and verifier-preparation evidence packages. It is not an EU institution, customs authority or accredited verifier. It does not issue a verification opinion, customs approval, EU acceptance or legal compliance guarantee.</p>
            <p className="mt-4 text-sm leading-relaxed text-amber-950/80">Final emissions data must be independently verified where the applicable CBAM rules require accredited verification.</p>
          </article>
        </div>
      </section>

      <section className="border-t border-border bg-surface py-16">
        <div className="mx-auto flex max-w-4xl flex-col items-center px-6 text-center"><LockKeyhole className="h-7 w-7 text-accent" /><h2 className="mt-4 font-serif text-3xl font-bold">Draft freely. Pay once. Seal under transactional controls.</h2><p className="mt-4 text-muted">No credit is consumed until a version is successfully activated as an immutable sealed report.</p><Link href="/register?next=/cases/new" className="mt-7 inline-flex h-12 items-center gap-2 rounded-md bg-accent px-6 font-semibold text-surface hover:bg-accent-hover">Create a Case <ArrowRight className="h-4 w-4" /></Link></div>
      </section>
    </main>
  );
}

function ConservationRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between border-b border-border/50 pb-3"><span className="text-muted">{label}</span><strong>{value}</strong></div>;
}

function Control({ children }: { children: React.ReactNode }) {
  return <li className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" /><span>{children}</span></li>;
}
