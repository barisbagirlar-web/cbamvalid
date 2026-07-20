import React from "react";
import Link from "next/link";
import { PlayCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";

import VideoPlayer from "@/components/ui/VideoPlayer";

export const metadata: Metadata = {
  title: "How CBAMValid Works | CBAM Dossier Workflow",
  description: "See how CBAMValid guides users from case creation and evidence collection to quality review, secure credit purchase and sealed dossier delivery.",
};

export default function HowItWorksPage() {
  const workflowStages = [
    { title: "Case & Reporting Scope", desc: "Define the boundaries of your CBAM declaration." },
    { title: "Goods & Customs Data", desc: "Import CN codes and customs evidence." },
    { title: "Installation & Production Route", desc: "Map the manufacturing origins of your goods." },
    { title: "Embedded Emissions", desc: "Calculate direct and indirect carbon footprints." },
    { title: "Precursors & Adjustments", desc: "Account for complex supply chains." },
    { title: "Evidence Register", desc: "Link primary documents to calculation nodes." },
    { title: "Quality Review", desc: "Automated integrity checks against EU guidelines." },
    { title: "Seal & Deliverables", desc: "Generate the final locked dossier and structured data export." }
  ];

  return (
    <main className="min-h-screen bg-background pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold font-serif text-foreground tracking-tight mb-6">
            How CBAMValid Works
          </h1>
          <p className="text-muted text-lg max-w-2xl mx-auto">
            Build a structured dossier for one installation and one reporting year. Enter production and emissions data, link supporting evidence, resolve quality findings, and generate a sealed verifier-preparation package.
          </p>
        </div>

        {/* Premium Video Section */}
        <div className="max-w-5xl mx-auto mb-20">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold font-serif text-foreground mb-4">See the Complete Workflow</h2>
            <p className="text-muted text-lg max-w-2xl mx-auto">
              This walkthrough explains each stage of the CBAMValid dossier process and the purpose of the key data inputs.
            </p>
          </div>

          <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-border bg-black aspect-video group">
            <VideoPlayer
              src="/media/cbamvalid-product-walkthrough.mp4"
              poster="/media/cbamvalid-product-walkthrough-poster.webp"
              ariaLabel="CBAMValid product workflow walkthrough"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Workflow Stages */}
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {workflowStages.map((stage, index) => (
              <div key={index} className="bg-surface border border-border rounded-xl p-6 hover:border-accent/50 transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-accent/10 text-accent flex items-center justify-center font-bold text-sm">
                    {index + 1}
                  </div>
                  <h3 className="font-bold text-foreground">{stage.title}</h3>
                </div>
                <p className="text-sm text-muted mb-4">{stage.desc}</p>
                <Link href="/methodology" className="text-xs font-semibold text-accent hover:underline flex items-center">
                  Learn more <ArrowRight className="w-3 h-3 ml-1" />
                </Link>
              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}
