import Link from "next/link";
import { Shield, ArrowRight, CheckCircle2, Globe2 } from "lucide-react";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { generateOrganizationSchema, generateWebSiteSchema, generateWebApplicationSchema, generateFAQSchema, generateEeatProductSchema } from "@/lib/seo/schema";

export const metadata = generateSeoMetadata("/");

export default function HomePage() {
  const jsonLd = [
    generateOrganizationSchema(),
    generateWebSiteSchema(),
    generateWebApplicationSchema("Prepare structured exporter evidence, identify documentation gaps, calculate embedded emissions, and generate auditable CBAM preparation dossiers."),
    generateEeatProductSchema(),
    generateFAQSchema([
      {
        question: "What is a CBAM evidence dossier?",
        answer: "A CBAM evidence dossier is a compiled report containing the direct and indirect embedded emissions data of imported goods, structured to align with EU regulations."
      },
      {
        question: "Is CBAMValid an official European Commission service?",
        answer: "No. CBAMValid is an independent software service that assists exporters and importers with calculations and reporting preparation."
      }
    ])
  ];

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />


      {/* 2. Hero Section */}
      <main className="flex-1">
        <section className="max-w-7xl mx-auto px-6 py-20 lg:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="max-w-2xl space-y-6">
              <div className="inline-flex items-center space-x-2 border border-border bg-accent-soft px-3 py-1.5 rounded-full text-xs font-semibold tracking-wider text-accent uppercase">
                <Globe2 className="w-4 h-4 mr-1" strokeWidth={1.75} /> 
                EU Regulatory Method Alignment
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
                  href="/register?next=/cases/new" 
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 font-medium text-surface transition-colors hover:bg-accent-hover active:bg-accent-active cursor-pointer"
                >
                  Start a Dossier <ArrowRight size={18} strokeWidth={1.75} />
                </Link>
                <Link 
                  href="/how-it-works" 
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border-strong bg-transparent px-5 py-3 font-medium text-foreground transition-colors hover:bg-neutral-soft"
                >
                  Watch the Workflow
                </Link>
                <Link 
                  href="/sample-dossier" 
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border-strong bg-transparent px-5 py-3 font-medium text-foreground transition-colors hover:bg-neutral-soft"
                >
                  View the Sample Dossier
                </Link>
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
                    <span className="text-muted">CBAMValid Exporter Evidence XML</span>
                    <span className="text-accent font-semibold">Included</span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </section>

        {/* Video CTA Section */}
        <section className="border-t border-border bg-surface py-20">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <h2 className="text-3xl font-bold font-serif mb-4">See CBAMValid in Action</h2>
            <p className="text-muted text-lg mb-10 max-w-2xl mx-auto">
              Review the full evidence-linked workflow before creating your first case.
            </p>
            <div className="relative max-w-4xl mx-auto rounded-xl overflow-hidden shadow-2xl border border-border bg-black group block">
              <div className="aspect-video relative">
                <img 
                  src="/media/cbamvalid-product-walkthrough-poster.webp" 
                  alt="Video Walkthrough Poster" 
                  className="w-full h-full object-cover opacity-80"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 bg-accent/90 rounded-full flex items-center justify-center shadow-lg transition-transform group-hover:scale-110">
                    <div className="w-0 h-0 border-y-8 border-y-transparent border-l-12 border-l-white ml-2" />
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-8">
              <Link 
                href="/how-it-works" 
                className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-8 py-3 font-medium text-surface transition-colors hover:bg-accent-hover"
              >
                Open Full Walkthrough <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
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

        {/* 4. Frequently Asked Questions */}
        <section className="border-t border-border bg-background py-20">
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="text-xl md:text-2xl font-bold mb-12 text-center">Frequently Asked Questions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <div className="bg-surface border border-border p-6 rounded-xl">
                <h3 className="font-semibold text-lg mb-2">What is a CBAM evidence dossier?</h3>
                <p className="text-muted text-sm leading-relaxed">
                  A CBAM evidence dossier is a compiled report containing the direct and indirect embedded emissions data of imported goods, structured to align with EU regulations.
                </p>
              </div>
              <div className="bg-surface border border-border p-6 rounded-xl">
                <h3 className="font-semibold text-lg mb-2">Is CBAMValid an official European Commission service?</h3>
                <p className="text-muted text-sm leading-relaxed">
                  No. CBAMValid is an independent software service that assists exporters and importers with calculations and reporting preparation.
                </p>
              </div>
            </div>
          </div>
        </section>
        {/* Academic Oversight & Expert Review */}
        <section className="border-t border-border bg-neutral-soft py-20">
          <div className="max-w-4xl mx-auto px-6">
            <div className="bg-surface border border-border rounded-2xl p-8 md:p-10 flex flex-col md:flex-row gap-8 items-center shadow-lg">
              <div className="w-20 h-20 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center font-bold text-accent text-3xl font-serif shrink-0 shadow-inner">
                IIT
              </div>
              <div className="space-y-4 text-left">
                <div className="inline-flex items-center space-x-2 border border-accent/20 bg-accent-soft px-3 py-1 rounded-full text-xs font-semibold tracking-wider text-accent uppercase">
                  Academic Oversight & Expert Review
                </div>
                <h3 className="text-2xl font-bold font-serif text-foreground">Rigorous Mathematical Integrity</h3>
                <p className="text-sm text-muted leading-relaxed">
                  Our embedded emissions calculation engines, allocation methodology, and compliance logic are reviewed for compliance with EU CBAM mathematical rules.
                </p>
                <div className="pt-4 border-t border-border/50">
                  <p className="font-bold text-foreground text-base">Prof. Dr. Neela Nataraj</p>
                  <p className="text-xs text-muted">
                    Department of Mathematics · Indian Institute of Technology Bombay (IIT Bombay)
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Trust & Disclaimers */}
        <section className="border-t border-border max-w-7xl mx-auto px-6 py-20 space-y-8">
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
