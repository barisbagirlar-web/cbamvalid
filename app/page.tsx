import Link from "next/link";
import { Shield, ArrowRight, CheckCircle2, Globe2 } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
      {/* 1. Navigation Menu */}
      <nav className="w-full border-b border-border bg-surface/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <img src="/cbam_logo.svg" alt="CBAM Valid Logo" className="h-7 md:h-8 w-auto object-contain" />
          </div>
          <div className="flex items-center space-x-6">
            <Link href="/login" className="text-sm font-medium text-muted hover:text-foreground transition-colors">
              Client Login
            </Link>
            <Link 
              href="/cbam/new" 
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-5 py-2 font-medium text-surface transition-colors hover:bg-accent-hover active:bg-accent-active disabled:cursor-not-allowed disabled:opacity-45"
            >
              Start Report
            </Link>
          </div>
        </div>
      </nav>

      {/* 2. Hero Section */}
      <main className="flex-1">
        <section className="max-w-7xl mx-auto px-6 py-20 lg:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="max-w-2xl space-y-6">
              <div className="inline-flex items-center space-x-2 border border-border bg-accent-soft px-3 py-1.5 rounded-full text-xs font-semibold tracking-wider text-accent uppercase">
                <Globe2 className="w-4 h-4 mr-1" strokeWidth={1.75} /> 
                EU Registry Rules Aligned
              </div>
              
              <h1 className="text-4xl lg:text-6xl font-bold tracking-tight leading-[1.1]">
                CBAM Exporter <br />
                <span className="text-accent">Final Evidence Report</span>
              </h1>
              
              <p className="text-base md:text-lg text-muted leading-relaxed">
                Prepare a buyer-ready CBAM emissions and evidence package in one guided workflow. 
                Enter your product, shipment, installation and emissions data. Review missing evidence, 
                pay once, and download your final report in PDF, JSON and XML formats.
              </p>

              <div className="text-sm text-subtle font-semibold font-mono">
                USD 150 per final report. No subscription. No credits.
              </div>
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <Link 
                  href="/cbam/new" 
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 font-medium text-surface transition-colors hover:bg-accent-hover active:bg-accent-active cursor-pointer"
                >
                  Start Your Report <ArrowRight size={18} strokeWidth={1.75} />
                </Link>
                <a 
                  href="#how-it-works" 
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border-strong bg-transparent px-5 py-3 font-medium text-foreground transition-colors hover:bg-neutral-soft"
                >
                  See What Is Included
                </a>
              </div>
            </div>

            {/* Right side graphical placeholder */}
            <section className="hidden lg:block relative p-8 bg-surface border border-border rounded-xl shadow-[var(--shadow-card)]">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-border/50 pb-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-accent" strokeWidth={1.75} />
                    <span className="font-semibold text-sm">Evidence Dossier Preview</span>
                  </div>
                  <span className="text-xs bg-accent-soft text-accent px-2.5 py-1 rounded-full font-semibold border border-border">
                    USD 150
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted">PDF Evidence Manifest</span>
                    <span className="text-accent font-semibold">Included</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted">Canonical JSON Format</span>
                    <span className="text-accent font-semibold">Included</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted">Structured CBAMValid XML</span>
                    <span className="text-accent font-semibold">Included</span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </section>

        {/* 3. Steps section */}
        <section id="how-it-works" className="border-t border-border bg-neutral-soft py-20">
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="text-xl md:text-2xl font-bold mb-12 text-center">Five-Step Evidence Compilation Workflow</h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 text-sm">
              {[
                "Add your exported goods",
                "Add factory and production data",
                "Review emissions and missing evidence",
                "Pay USD 150",
                "Download PDF, JSON and XML"
              ].map((step, idx) => (
                <section key={idx} className="p-5 bg-surface border border-border rounded-xl space-y-3 shadow-[var(--shadow-card)]">
                  <span className="text-xs font-bold text-accent font-mono">Step {idx + 1}</span>
                  <p className="font-semibold text-foreground">{step}</p>
                </section>
              ))}
            </div>
          </div>
        </section>

        {/* 4. Trust & Disclaimers */}
        <section className="max-w-7xl mx-auto px-6 py-20 space-y-8">
          <div className="bg-surface border border-border rounded-xl p-6 md:p-10 space-y-6 shadow-[var(--shadow-card)]">
            <div className="flex gap-3">
              <CheckCircle2 className="w-6 h-6 text-foreground mt-0.5 shrink-0" strokeWidth={1.75} />
              <div>
                <h3 className="font-bold text-lg text-foreground">Trust Statement</h3>
                <p className="mt-2 text-sm text-muted leading-relaxed">
                  Built around current published EU CBAM rules and official source data. 
                  Designed for exporter-to-importer evidence transfer and verification readiness.
                </p>
              </div>
            </div>
            <div className="border-t border-border pt-6 space-y-2">
              <span className="text-xs font-bold text-subtle uppercase tracking-wider block">Mandatory Limitation & Regulatory Disclaimer</span>
              <p className="text-xs text-subtle leading-relaxed">
                CBAMValid prepares calculation and evidence packages. It is not an EU institution, customs authority, 
                or accredited CBAM verifier. Actual emissions must be independently verified where verification is legally required.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
