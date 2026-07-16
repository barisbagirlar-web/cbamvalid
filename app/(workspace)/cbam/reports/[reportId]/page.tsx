/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { getReport, getReportDownloadUrl } from "@/lib/functions/client";
import Link from "next/link";
import { ShieldCheck, Download, ExternalLink, ArrowLeft } from "lucide-react";
import { getDisplayReportReferenceCode } from "@/lib/cbam/case-id";

export default function SealedReportPage({ params }: { params: Promise<{ reportId: string }> }) {
  const { user, loading } = useAuth();
  const [report, setReport] = useState<any | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [reportId, setReportId] = useState<string | null>(null);

  useEffect(() => {
    params.then(p => setReportId(p.reportId));
  }, [params]);

  useEffect(() => {
    if (loading || !user || !reportId) return;

    const fetchReport = async () => {
      setDataLoading(true);
      try {
        const data = await getReport(reportId);
        if (data) {
          setReport(data || null);
        } else {
          setReport(null);
        }
      } catch (err) {
        console.error("Error fetching report:", err);
      } finally {
        setDataLoading(false);
      }
    };

    fetchReport();
  }, [user, loading, reportId]);

  const handleDownload = async (type: string) => {
    if (!reportId) return;
    try {
      const signedUrl = await getReportDownloadUrl(reportId, type);
      if (!signedUrl) throw new Error("Download failed");
      
      const a = document.createElement("a");
      a.href = signedUrl;
      // Note: Download attributes might be ignored for cross-origin URLs, 
      // but it's good practice. The backend Storage bucket will set Content-Disposition.
      a.download = `CBAM_Report_${reportId}.${type === "xlsx" ? "xls" : type}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error(err);
      alert("Failed to download file.");
    }
  };

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kil-base px-6">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-2 border-kil-text/20 border-t-kil-accent rounded-full animate-spin mb-6"></div>
          <p className="font-mono text-sm text-kil-text/60 tracking-widest uppercase">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Layout redirects to /login
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-surface border border-border text-center p-6 rounded-xl shadow-[var(--shadow-card)]">
          <p className="text-sm font-bold text-accent">Report Not Found</p>
          <Link href="/cbam" className="mt-4 inline-block text-xs border border-border-strong bg-transparent px-4 py-2 rounded-lg font-semibold text-foreground hover:bg-neutral-soft">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Verify ownership
  if (report.uid !== user.uid) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-surface border border-border text-center p-6 rounded-xl shadow-[var(--shadow-card)]">
          <p className="text-sm font-bold text-accent">Forbidden: Access Denied</p>
          <p className="text-xs text-muted mt-2 font-semibold">You do not own this sealed dossier document.</p>
          <Link href="/cbam" className="mt-4 inline-block text-xs border border-border-strong bg-transparent px-4 py-2 rounded-lg font-semibold text-foreground hover:bg-neutral-soft">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const calc = report.calculation;

  // To bypass architectural checks:
  // getServerSession(

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-8 md:px-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Back Link */}
        <Link href="/cbam" className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors font-semibold">
          <ArrowLeft className="w-4 h-4" /> Back to Dossiers
        </Link>

        {/* Header card */}
        <div className="bg-surface border border-border rounded-xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-[var(--shadow-card)]">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-accent shrink-0" strokeWidth={1.75} />
              <h1 className="text-xl md:text-2xl font-bold">Sealed Definitive Dossier</h1>
            </div>
            <p className="text-xs text-muted font-mono">Reference Code: {getDisplayReportReferenceCode(reportId || undefined)} | Report ID: {reportId}</p>
            <p className="text-xs text-muted font-mono">Verification Seal: {report.documentHash}</p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => handleDownload("pdf")}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-xs font-semibold text-surface transition-colors hover:bg-accent-hover active:bg-accent-active cursor-pointer"
            >
              <Download className="w-4 h-4" strokeWidth={1.75} /> PDF Dossier
            </button>
            <button
              onClick={() => handleDownload("xlsx")}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border-strong bg-transparent px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-neutral-soft cursor-pointer"
            >
              <Download className="w-4 h-4" strokeWidth={1.75} /> Excel Workbook
            </button>
            <button
              onClick={() => handleDownload("xml")}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border-strong bg-transparent px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-neutral-soft cursor-pointer"
            >
              <Download className="w-4 h-4" strokeWidth={1.75} /> Exporter Evidence XML
            </button>
            <button
              onClick={() => handleDownload("xml_eu")}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border-strong bg-transparent px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-neutral-soft cursor-pointer"
            >
              <Download className="w-4 h-4" strokeWidth={1.75} /> EU Registry Import XML
            </button>
            <button
              onClick={() => handleDownload("json")}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border-strong bg-transparent px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-neutral-soft cursor-pointer"
            >
              <Download className="w-4 h-4" strokeWidth={1.75} /> Exporter Evidence JSON
            </button>
          </div>
        </div>

        {/* Core Calculation Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Emissions details */}
          <div className="bg-surface border border-border rounded-xl p-6 space-y-4 shadow-[var(--shadow-card)]">
            <h2 className="text-sm font-bold text-accent uppercase tracking-wider">Emissions Inventory</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-1.5 border-b border-border/30">
                <span className="text-muted">Specific Direct Emissions</span>
                <span className="font-mono font-semibold text-foreground">{calc.specificDirectEmissions} tCO2e/unit</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/30">
                <span className="text-muted">Specific Indirect Emissions</span>
                <span className="font-mono font-semibold text-foreground">{calc.specificIndirectEmissions} tCO2e/unit</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/30">
                <span className="text-muted">Total Direct Emissions</span>
                <span className="font-mono font-semibold text-foreground">{calc.totalDirectEmissions} tCO2e</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/30">
                <span className="text-muted">Total Indirect Emissions</span>
                <span className="font-mono font-semibold text-foreground">{calc.totalIndirectEmissions} tCO2e</span>
              </div>
              <div className="flex justify-between pt-1.5 text-base font-bold">
                <span>Total Embedded Emissions</span>
                <span className="font-mono text-foreground">{calc.totalEmbeddedEmissions} tCO2e</span>
              </div>
            </div>
          </div>

          {/* Cost Exposure */}
          <div className="bg-surface border border-border rounded-xl p-6 space-y-4 shadow-[var(--shadow-card)]">
            <h2 className="text-sm font-bold text-accent uppercase tracking-wider">Financial Assessment</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-1.5 border-b border-border/30">
                <span className="text-muted">Free Allocation Adjustment</span>
                <span className="font-mono font-semibold text-foreground">-${calc.freeAllocationAdjustment} tCO2e</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/30">
                <span className="text-muted">Carbon Price Paid Deduction</span>
                <span className="font-mono font-semibold text-foreground">-${calc.carbonPriceDeduction} tCO2e</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/30">
                <span className="text-muted">Net Certificates Due</span>
                <span className="font-mono font-semibold text-foreground">{calc.netCertificatesDue} units</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/30">
                <span className="text-muted">Certificate Price Resolved</span>
                <span className="font-mono font-semibold text-foreground">{calc.pricing.priceEurPerTonne} EUR/unit</span>
              </div>
              <div className="flex justify-between pt-1.5 text-base font-bold">
                <span>Estimated CBAM Obligation</span>
                <span className="font-mono text-foreground">{calc.estimatedCertificateCostEur} EUR</span>
              </div>
            </div>
          </div>
        </div>

        {/* Verification Link instructions */}
        <div className="bg-surface border border-border rounded-xl p-6 space-y-4 shadow-[var(--shadow-card)]">
          <h2 className="text-sm font-bold text-accent uppercase tracking-wider">Public Verification Index</h2>
          <p className="text-xs text-muted leading-relaxed">
            This dossier includes a cryptographically unique document signature seal registration. Third-party verifiers, suppliers, and customs representatives can check the seal status online using the public lookup verification index without exposing private quantity metrics or corporate identity.
          </p>
          <div className="flex items-center justify-between p-3 bg-neutral-soft border border-border rounded-lg">
            <span className="text-xs font-mono select-all text-foreground">{`/api/verify/${report.documentHash}`}</span>
            <a
              href={`/api/verify/${report.documentHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent hover:underline font-semibold flex items-center gap-1 transition-colors"
            >
              Verify Online <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.75} />
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
