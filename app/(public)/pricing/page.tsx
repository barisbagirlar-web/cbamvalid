import React from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { CREDIT_PACKAGES } from "@/lib/billing/catalog";

export const metadata = {
  title: "Pricing | CBAMValid",
  description: "Prepare your CBAM case before you pay. Credits are consumed only after a dossier is successfully sealed.",
};

export default function PricingPage() {
  const packages = CREDIT_PACKAGES.filter((p) => p.active).sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="flex-1 bg-surface text-foreground">
      <section className="pt-24 pb-16 px-6 md:px-12 lg:px-24 max-w-5xl mx-auto text-center">
        <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
          Prepare your CBAM case before you pay
        </h1>
        <p className="text-lg md:text-xl text-muted max-w-3xl mx-auto leading-relaxed mb-8">
          Create, complete and review your case without charge. Credits are consumed only after a dossier is successfully sealed.
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
          {packages.map((pkg) => (
            <div 
              key={pkg.slug} 
              className="relative flex flex-col rounded-2xl border border-border shadow-sm bg-surface p-8"
            >
              <div className="mb-6">
                <h3 className="text-xl font-bold mb-2 text-foreground">{pkg.cbamReportUses} CBAM Reports</h3>
                <p className="text-muted text-sm">{pkg.accountCredits} account credits included</p>
              </div>
              
              <div className="mb-6">
                <span className="text-4xl font-bold font-serif">$149</span>
              </div>
              
              <ul className="mb-8 space-y-4 flex-1">
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                  <span className="text-sm text-foreground">Emissions calculations and validation</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                  <span className="text-sm text-foreground">Unlimited draft revisions</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                  <span className="text-sm text-foreground">XML registry format output</span>
                </li>
              </ul>
              
              <Link 
                href="/credits/buy" 
                className={`w-full h-[44px] flex items-center justify-center rounded-md font-medium transition-colors ${pkg.featured ? 'bg-accent text-surface hover:bg-accent-hover' : 'bg-surface border border-border text-foreground hover:bg-border/30'}`}
              >
                Buy Credits
              </Link>
            </div>
          ))}

          {/* Pay As You Go Card / Free Tier Card */}
          <div className="relative flex flex-col rounded-2xl border border-border shadow-sm bg-surface p-8">
            <div className="mb-6">
              <h3 className="text-xl font-bold mb-2 text-foreground">Free Drafts</h3>
              <p className="text-muted text-sm">Prepare and review without cost</p>
            </div>
            
            <div className="mb-6">
              <span className="text-4xl font-bold font-serif">€0</span>
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
