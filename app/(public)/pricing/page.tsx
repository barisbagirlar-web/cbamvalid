import Link from "next/link";
import { Check, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Pricing | CBAMValid",
  description: "One $150 Exporter Verification Preparation Pack for one installation, one reporting year and five successful sealed report versions.",
};

const included = [
  "One installation and one reporting year",
  "Defined production processes and linked goods/CN groups",
  "Evidence upload, SHA-256 hashing and field linkage",
  "Direct, indirect and precursor emissions calculations",
  "Quality findings and sealing blockers",
  "Five successful immutable sealed report versions",
  "23-component verifier-preparation ZIP",
  "O3CI field-mapped structured export",
  "Calculation trace and data-integrity manifest",
  "Re-downloads and failed seals consume no version",
] as const;

export default function PricingPage() {
  return (
    <main className="bg-background text-foreground">
      <section className="mx-auto max-w-5xl px-6 pb-16 pt-24 text-center md:px-10 md:pt-32">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent">Simple commercial scope</p>
        <h1 className="mt-4 font-serif text-4xl font-bold tracking-tight md:text-6xl">
          Prepare the dossier first. Pay only before final sealing.
        </h1>
        <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-muted">
          Draft creation, data entry, evidence review and readiness checks remain available before purchase. The pack is linked to one selected installation-year dossier.
        </p>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-24 md:px-10">
        <div className="overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
          <div className="grid gap-8 p-7 md:grid-cols-[0.8fr_1.2fr] md:p-10">
            <div className="rounded-2xl bg-neutral-soft p-7">
              <p className="text-sm font-bold text-accent">Exporter Verification Preparation Pack</p>
              <div className="mt-5 flex items-end gap-2">
                <span className="font-serif text-6xl font-bold">$150</span>
                <span className="pb-2 text-sm font-semibold text-muted">USD</span>
              </div>
              <p className="mt-5 text-sm leading-relaxed text-muted">
                One installation × one reporting year × defined production processes × linked goods/CN groups.
              </p>
              <p className="mt-4 text-sm font-semibold">Includes five successful sealed versions.</p>
              <Link href="/register?next=/cases/new" className="mt-7 inline-flex h-12 w-full items-center justify-center rounded-md bg-accent px-5 font-semibold text-surface hover:bg-accent-hover">
                Create Your Draft Dossier
              </Link>
              <Link href="/sample-dossier" className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-md border border-border-strong px-5 font-semibold hover:bg-background">
                View Sample Dossier
              </Link>
            </div>

            <div>
              <h2 className="font-serif text-2xl font-bold">What the pack includes</h2>
              <ul className="mt-6 grid gap-4">
                {included.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm leading-relaxed">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-border bg-background p-6 md:px-10">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <p className="text-sm leading-relaxed text-muted">
                CBAMValid prepares data and evidence for independent verification. It does not issue an accredited verifier's opinion, customs approval, EU approval or acceptance guarantee. Paddle processes payment as Merchant of Record.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
