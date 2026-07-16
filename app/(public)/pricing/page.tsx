import React from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { CREDIT_PACKAGES } from "@/lib/billing/catalog";

export const metadata = {
  title: "Pricing | CBAMValid",
  description: "Get started with the CBAM Exporter Verification Preparation Pack. Purchase the pack ($149) before starting your CBAM case.",
};

export default function PricingPage() {
  const packages = CREDIT_PACKAGES.filter((p) => p.active).sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="flex-1 bg-surface text-foreground">
      <section className="pt-24 pb-16 px-6 md:px-12 lg:px-24 max-w-5xl mx-auto text-center">
        <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
          Get started with the CBAM Exporter Verification Pack
        </h1>
        <p className="text-lg md:text-xl text-muted max-w-3xl mx-auto leading-relaxed mb-8">
          Get instant access to the eight-step CBAM workspace, real-time quality controls, and calculations. You must purchase the preparation pack ($149) before starting your CBAM case.
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
        <div className="max-w-md mx-auto">
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
                  <span className="text-sm text-foreground"><strong>5 Sealed Dossier Releases:</strong> Exactly 5 successful sealed package generation tokens.</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                  <span className="text-sm text-foreground"><strong>23-Component Complete Pack:</strong> ZIP containing process maps, activity ledgers, field matrices, and logs.</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                  <span className="text-sm text-foreground"><strong>Verification Readiness:</strong> Interactive 18-point fail-closed compliance gap analysis and quality checks.</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                  <span className="text-sm text-foreground"><strong>Audit & Calculation Trace:</strong> Full deterministic trace logs with cryptographic SHA-256 integrity hashes.</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                  <span className="text-sm text-foreground"><strong>Definitive PDF Dossier:</strong> Premium audit-ready cover page, TOC, tables, and methodological decision logs.</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                  <span className="text-sm text-foreground"><strong>XML Interoperability Exports:</strong> Custom Exporter Evidence XML and EU Registry Import XML formats.</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                  <span className="text-sm text-foreground"><strong>Excel & JSON Data Ledgers:</strong> Structured spreadsheets and case JSON backups.</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                  <span className="text-sm text-foreground"><strong>Document Seal Signature:</strong> Cryptographic verification lookup URL for verifiers and custom officials.</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                  <span className="text-sm text-foreground"><strong>Zero Risk Consumption:</strong> Credits are consumed only for successful releases. Errors consume zero.</span>
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
        </div>
      </section>
    </div>
  );
}
