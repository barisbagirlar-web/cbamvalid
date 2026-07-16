import Link from "next/link";
import { ArrowRight, CheckCircle2, FileArchive, FileSpreadsheet, Globe2, Shield } from "lucide-react";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import {
  generateOrganizationSchema,
  generateWebSiteSchema,
  generateWebApplicationSchema,
  generateFAQSchema,
} from "@/lib/seo/schema";
import { formatPreparationPackPrice, PREPARATION_PACK } from "@/lib/commerce/preparation-pack";

export const metadata = generateSeoMetadata("/");

export default function HomePage() {
  const price = formatPreparationPackPrice();
  const jsonLd = [
    generateOrganizationSchema(),
    generateWebSiteSchema(),
    generateWebApplicationSchema("Prepare evidence-linked CBAM calculations and a signed verifier-preparation dossier with controlled PDF and XLSX outputs."),
    generateFAQSchema([
      {
        question: "What does one CBAMValid Preparation Pack include?",
        answer: `One ${price} USD pack includes ${PREPARATION_PACK.accountCredits} account credits and funds up to ${PREPARATION_PACK.maxReleases} successful sealed versions for one CBAM case.`,
      },
      {
        question: "Is CBAMValid an accredited verifier or official EU service?",
        answer: "No. CBAMValid prepares calculation and evidence packages for independent accredited verification. It does not issue a verification opinion or EU acceptance decision.",
      },
    ]),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="flex-1">
        <section className="mx-auto grid max-w-7xl items-center gap-16 px-6 py-20 lg:grid-cols-2 lg:py-28">
          <div className="max-w-2xl space-y-6">
            <div className="inline-flex items-center rounded-full border border-border bg-accent-soft px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-accent"><Globe2 className="mr-2 h-4 w-4" />EU CBAM definitive-period preparation</div>
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight lg:text-6xl">CBAM Verifier-Preparation <span className="text-accent">Dossier</span></h1>
            <p className="text-base leading-relaxed text-muted md:text-lg">Build one evidence-linked case, resolve automated blockers, purchase one controlled pack, and generate professional PDF, verifier XLSX and a signed 27-component ZIP package.</p>
            <div className="rounded-lg border border-border bg-surface p-4 text-sm">
              <strong>{price} USD one-time</strong> · {PREPARATION_PACK.accountCredits} credits · {PREPARATION_PACK.maxReleases} successful sealed versions · {PREPARATION_PACK.creditsPerRelease} credits per successful seal
            </div>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Link href="/register?next=/cases/new" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 font-medium text-surface hover:bg-accent-hover">Start a Dossier <ArrowRight size={18} /></Link>
              <Link href="/sample-dossier" className="inline-flex min-h-11 items-center justify-center rounded-md border border-border-strong px-5 py-3 font-medium hover:bg-neutral-soft">View Sample Dossier</Link>
              <Link href="/product" className="inline-flex min-h-11 items-center justify-center rounded-md border border-border-strong px-5 py-3 font-medium hover:bg-neutral-soft">View Product Scope</Link>
            </div>
          </div>

          <section className="rounded-xl border border-border bg-surface p-8 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between border-b border-border/50 pb-4"><div className="flex items-center gap-2"><Shield className="h-5 w-5 text-accent" /><span className="font-semibold">Controlled Package</span></div><span className="rounded-full border border-border bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">{price} USD</span></div>
            <div className="mt-6 space-y-4 text-sm">
              <Deliverable icon={CheckCircle2} title="11 professional controlled PDFs" />
              <Deliverable icon={FileSpreadsheet} title="Verifier-grade XLSX workspace" />
              <Deliverable icon={FileArchive} title="Signed 27-component ZIP dossier" />
              <Deliverable icon={Shield} title="Manifest, KMS signature and immutable hashes" />
            </div>
          </section>
        </section>

        <section className="border-t border-border bg-neutral-soft py-20">
          <div className="mx-auto max-w-7xl px-6">
            <h2 className="mb-12 text-center text-2xl font-bold">End-to-End Controlled Workflow</h2>
            <div className="grid gap-5 md:grid-cols-4 lg:grid-cols-8">
              {[
                "Register and verify email",
                "Create one case",
                "Enter goods and installation data",
                "Link and approve evidence",
                "Resolve calculation and QC blockers",
                `Purchase ${price} USD pack`,
                `Seal version for ${PREPARATION_PACK.creditsPerRelease} credits`,
                "Download and independently verify package",
              ].map((step, index) => <article key={step} className="rounded-xl border border-border bg-surface p-4 shadow-sm"><span className="font-mono text-xs font-bold text-accent">{index + 1}</span><p className="mt-3 text-sm font-semibold">{step}</p></article>)}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-20">
          <div className="rounded-xl border border-border bg-surface p-8 shadow-[var(--shadow-card)]">
            <h2 className="font-serif text-2xl font-bold">Regulatory and Commercial Boundary</h2>
            <p className="mt-4 text-sm leading-relaxed text-muted">CBAMValid prepares calculations, evidence mapping, automated readiness controls and sealed verifier-preparation deliverables. It is not an EU institution, customs authority or accredited verifier. Actual emissions and the final operator report require independent accredited verification where applicable.</p>
            <p className="mt-3 text-sm leading-relaxed text-muted">Credits are consumed only when a report version is successfully sealed in the same transaction that activates the immutable report. Drafting, calculations and blocked attempts consume zero credits.</p>
          </div>
        </section>
      </main>
    </div>
  );
}

function Deliverable({ icon: Icon, title }: { icon: typeof Shield; title: string }) {
  return <div className="flex items-center justify-between border-b border-border/40 py-2"><span>{title}</span><Icon className="h-5 w-5 text-accent" /></div>;
}
