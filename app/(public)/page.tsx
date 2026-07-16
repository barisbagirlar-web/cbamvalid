import Link from "next/link";
import { Shield, ArrowRight, CheckCircle2, Globe2 } from "lucide-react";
import VideoPlayer from "@/components/VideoPlayer";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { generateOrganizationSchema, generateWebSiteSchema, generateWebApplicationSchema, generateFAQSchema } from "@/lib/seo/schema";

export const metadata = generateSeoMetadata("/");

export default function HomePage() {
  const jsonLd = [
    generateOrganizationSchema(),
    generateWebSiteSchema(),
    generateWebApplicationSchema("Prepare structured exporter evidence, identify documentation gaps, calculate embedded emissions, and generate auditable CBAM preparation dossiers."),
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
                Stop stressing about complex EU border tax audits. Compile your data, resolve compliance gaps, and generate a verifier-approved CBAM dossier in minutes. Download verified PDF, JSON, and direct-import EU Registry XML formats immediately.
              </p>

              <div className="text-sm text-subtle font-semibold font-mono">
                Only $149 per sealed report. No subscription. No hidden fees.
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
                    $149
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted">PDF Verifier Dossier</span>
                    <span className="text-accent font-semibold">Included</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted">EU Registry Import XML (Draft)</span>
                    <span className="text-accent font-semibold">Included</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted">Mathematical Audit Trace Log</span>
                    <span className="text-accent font-semibold">Included</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted">Cryptographic Dossier Seal Hash</span>
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
            <div className="relative max-w-4xl mx-auto rounded-xl overflow-hidden shadow-2xl border border-border bg-black">
              <div className="aspect-video relative">
                <VideoPlayer
                  src="/media/cbamvalid-product-walkthrough.mp4"
                  poster="/media/cbamvalid-product-walkthrough-poster.webp"
                  startAtSeconds={3}
                />
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
                "Pay only $149",
                "Download PDF, JSON, and EU Registry XML"
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
