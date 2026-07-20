import React from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { CANONICAL_PRICING } from "@/lib/billing/pricing-config";

export const metadata = {
  title: "Pricing | CBAMValid",
  description: "Prepare your CBAM case before you pay. Releases are consumed only after a dossier is successfully sealed.",
};

export default function PricingPage() {
  return (
    <div className="flex-1 bg-surface text-foreground">
      <section className="pt-24 pb-16 px-6 md:px-12 lg:px-24 max-w-5xl mx-auto text-center">
        <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
          Prepare your CBAM case before you pay
        </h1>
        <p className="text-lg md:text-xl text-muted max-w-3xl mx-auto leading-relaxed mb-8">
          Create, complete and review your case without charge. Releases are consumed only after a dossier is successfully sealed.
        </p>
        <div className="flex justify-center">
          <Link 
            href="/sample-dossier" 
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border-strong bg-transparent px-5 py-3 font-medium text-foreground transition-colors hover:bg-neutral-soft"
          >
            View Sample Dossier Before Buying
          </Link>
        </div>
      </section>

      {/* Pricing Cards Section */}
      <section className="px-6 md:px-12 lg:px-24 max-w-5xl mx-auto pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 justify-center items-stretch max-w-3xl mx-auto">
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
                <span className="text-sm text-foreground">{CANONICAL_PRICING.includedSealedReleases} Sealed releases included</span>
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
              href="/credits/buy" 
              className="w-full h-[44px] flex items-center justify-center rounded-md font-medium transition-colors bg-accent text-surface hover:bg-accent-hover"
            >
              Get Preparation Pack
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
              className="w-full h-[44px] flex items-center justify-center rounded-md font-medium transition-colors bg-surface border border-border text-foreground hover:bg-border/30"
            >
              Start for Free
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
