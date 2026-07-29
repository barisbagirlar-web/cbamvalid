import Link from "next/link";
import { Check } from "lucide-react";
import { CANONICAL_PRICING } from "@/lib/billing/pricing-config";

export default function PricingPage() {
  return (
    <main id="main" className="flex-1 bg-surface text-foreground">
      <section className="pt-24 pb-16 px-6 md:px-12 lg:px-24 max-w-5xl mx-auto text-center">
        <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
          Prepare your CBAM case before you pay
        </h1>
        <p className="text-lg md:text-xl text-muted max-w-3xl mx-auto leading-relaxed mb-8">
          Create, complete and review one operator, one installation and one reporting year without
          charge. Pay {CANONICAL_PRICING.priceFormatted} only when you are ready to lock and download
          that working file.
        </p>
        <div className="flex justify-center">
          <Link 
            href="/register?next=/cases/new"
            prefetch={false}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 font-medium text-surface transition-colors hover:bg-accent-hover"
          >
            Start a Free Draft
          </Link>
        </div>
        <p className="mt-4 text-sm text-muted">
          Want to inspect the output first? <Link className="underline" href="/sample-dossier">View the public sample dossier.</Link>
        </p>
      </section>

      {/* Pricing Cards Section */}
      <section id="tiers" className="px-6 md:px-12 lg:px-24 max-w-5xl mx-auto pb-12 scroll-mt-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 justify-center items-stretch max-w-5xl mx-auto">
          {/* Main Premium Dossier Card */}
          <div className="relative flex flex-col rounded-2xl border border-border shadow-sm bg-surface p-8">
            <div className="mb-6">
              <h3 className="text-xl font-bold mb-2 text-foreground">{CANONICAL_PRICING.packName}</h3>
              <p className="text-muted text-sm">{CANONICAL_PRICING.description}</p>
            </div>
            
            <div className="mb-6">
              <span className="text-4xl font-bold font-serif">{CANONICAL_PRICING.priceFormatted}</span>
            </div>
            
            <ul className="mb-8 space-y-4 flex-1">
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                <span className="text-sm text-foreground">{CANONICAL_PRICING.includedInstallations} Installation included</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                <span className="text-sm text-foreground">{CANONICAL_PRICING.includedReportingYears} Reporting year included</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                <span className="text-sm text-foreground">Same-file correction re-locks included</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                <span className="text-sm text-foreground">Emissions calculations and validation</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                <span className="text-sm text-foreground">{CANONICAL_PRICING.draftPolicy}</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                <span className="text-sm text-foreground">O3CI field-mapped structured data export</span>
              </li>
            </ul>
            
            <Link 
              href="/register?next=/cases/new"
              prefetch={false}
              className="w-full h-[44px] flex items-center justify-center rounded-md font-medium transition-colors bg-accent text-surface hover:bg-accent-hover"
            >
              Start a Free Draft
            </Link>
          </div>

          {/* Pay As You Go Card / Free Tier Card */}
          <div className="relative flex flex-col rounded-2xl border border-border shadow-sm bg-surface p-8">
            <div className="mb-6">
              <h3 className="text-xl font-bold mb-2 text-foreground">Free Drafts</h3>
              <p className="text-muted text-sm">Prepare and review without cost</p>
            </div>
            
            <div className="mb-6">
              <span className="text-4xl font-bold font-serif">$0</span>
            </div>
            
            <ul className="mb-8 space-y-4 flex-1">
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-muted shrink-0 mt-0.5" />
                <span className="text-sm text-foreground">Create unlimited cases</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-muted shrink-0 mt-0.5" />
                <span className="text-sm text-foreground">Real-time QC engine</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-muted shrink-0 mt-0.5" />
                <span className="text-sm text-foreground">Data gap analysis</span>
              </li>
            </ul>
            
            <Link 
              href="/register?next=/cases/new"
              prefetch={false}
              className="w-full h-[44px] flex items-center justify-center rounded-md font-medium transition-colors bg-surface border border-border text-foreground hover:bg-border/30"
            >              Start for Free
            </Link>
          </div>

          <div className="relative flex flex-col rounded-2xl border border-border shadow-sm bg-surface p-8">
            <div className="mb-6">
              <h3 className="text-xl font-bold mb-2 text-foreground">Exporter Annual</h3>
              <p className="text-muted text-sm">Annual plan for recurring exporter preparation work</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold font-serif">$2,400</span>
              <span className="text-muted"> / year</span>
            </div>
            <ul className="mb-8 space-y-4 flex-1">
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                <span className="text-sm text-foreground">For recurring exporter workflows</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                <span className="text-sm text-foreground">Case scope remains explicit per working file</span>
              </li>
            </ul>
            <Link
              href="/contact?subject=Exporter%20Annual"
              className="w-full h-[44px] flex items-center justify-center rounded-md font-medium transition-colors bg-surface border border-border text-foreground hover:bg-border/30"
            >
              Ask About Exporter Annual
            </Link>
          </div>

          <div className="relative flex flex-col rounded-2xl border border-border shadow-sm bg-surface p-8">
            <div className="mb-6">
              <h3 className="text-xl font-bold mb-2 text-foreground">Enterprise</h3>
              <p className="text-muted text-sm">Contracted scope for multi-site and procurement requirements</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold font-serif">From $12,000</span>
              <span className="text-muted"> / year</span>
            </div>
            <ul className="mb-8 space-y-4 flex-1">
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                <span className="text-sm text-foreground">SSO, SLA and holding scope available by contract</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                <span className="text-sm text-foreground">Contact sales only</span>
              </li>
            </ul>
            <Link
              href="/enterprise"
              className="w-full h-[44px] flex items-center justify-center rounded-md font-medium transition-colors bg-surface border border-border text-foreground hover:bg-border/30"
            >
              Explore Enterprise
            </Link>
          </div>
        </div>
      </section>

      <section id="how-payment-works" className="px-6 md:px-12 lg:px-24 max-w-3xl mx-auto pb-24 scroll-mt-24">
        <div className="rounded-2xl border border-border bg-surface p-8">
          <h2 className="text-2xl font-bold mb-4">How payment works</h2>
          <p className="text-muted leading-relaxed">
            Payment is tied to one working file. A successful payment unlocks lock and download for
            that file; same-file corrections can be re-locked without another payment. A new working
            file requires a new payment. A blocked or failed lock consumes no charge, and re-downloads
            are free.
          </p>
          <p className="mt-4 text-sm text-muted">
            Exporter Annual is USD 2,400 per year. Enterprise starts at USD 12,000 per year and is
            scoped through sales.
          </p>
        </div>
      </section>
    </main>
  );
}
