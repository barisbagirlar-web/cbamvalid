import React from "react";
import fs from "fs";
import path from "path";
import SampleViewer from "./SampleViewer";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";

export const metadata = generateSeoMetadata("/sample-dossier");

// We load the manifest on the server to pass it down to the client viewer
async function getManifest() {
  const manifestPath = path.join(process.cwd(), "public", "sample-dossier", "v1", "manifest.json");
  const data = await fs.promises.readFile(manifestPath, "utf-8");
  return JSON.parse(data);
}

export default async function SampleDossierPage() {
  const manifest = await getManifest();

  return (
    <main className="min-h-screen bg-background pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <h1 className="text-4xl md:text-5xl font-extrabold font-serif text-foreground tracking-tight mb-6">
            See the Dossier Before You Buy
          </h1>
          <p className="text-xl text-muted mb-6">
            Review a complete fictional demonstration dossier showing how CBAMValid structures calculation results, evidence coverage, quality controls and report deliverables.
          </p>
          
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-4 mb-8 text-rose-700 text-sm max-w-2xl mx-auto">
            <strong>Important Notice:</strong> This sample dossier uses fictional demonstration data. It is not a customs declaration, an official Registry submission or an accredited verifier opinion.
          </div>

          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <Link 
              href="/register?next=/cases/new" 
              className="bg-accent text-surface px-8 py-3 rounded-full font-medium hover:bg-accent-hover transition-colors flex items-center justify-center w-full sm:w-auto"
            >
              Start a Dossier <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
            <Link 
              href="/pricing" 
              className="bg-surface border border-border text-foreground px-8 py-3 rounded-full font-medium hover:bg-muted/10 transition-colors flex items-center justify-center w-full sm:w-auto"
            >
              View Pricing
            </Link>
          </div>
        </div>

        {/* The Viewer */}
        <div className="max-w-6xl mx-auto mb-20 shadow-2xl rounded-xl">
          <SampleViewer manifest={manifest} />
        </div>
      </div>
    </main>
  );
}
