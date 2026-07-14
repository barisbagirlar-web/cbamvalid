"use client";

import React, { useState, useEffect } from "react";
import { generateSampleDossierAction } from "./actions";
import { RefreshCw, FileText, CheckCircle, AlertTriangle } from "lucide-react";

export default function AdminSampleDossierPage() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; error?: string; pageCount?: number } | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setResult(null);
    try {
      const res = await generateSampleDossierAction("v1");
      setResult(res);
    } catch (err: any) {
      setResult({ success: false, error: err.message });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-serif font-bold">Sample Dossier Management</h1>
      </div>

      <div className="bg-surface p-6 rounded-lg border border-border">
        <h2 className="text-lg font-bold mb-2">Canonical Generation Pipeline</h2>
        <p className="text-muted text-sm mb-6">
          Generates the sample dossier using the production engine, rasterizes all pages, and uploads the flat PNGs to public storage.
        </p>

        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          {isGenerating ? "Generating pipeline..." : "Generate Sample Dossier (v1)"}
        </button>

        {result && (
          <div className={`mt-6 p-4 rounded-md border ${result.success ? "border-accent/20 bg-accent/5 text-accent" : "border-red-500/20 bg-red-500/5 text-red-700"}`}>
            {result.success ? (
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle className="w-5 h-5 text-accent" />
                Successfully generated and rasterized {result.pageCount} pages.
              </div>
            ) : (
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Error: {result.error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
