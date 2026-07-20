"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { 
  ShieldCheck, 
  ShieldAlert, 
  Download, 
  Clock, 
  Globe, 
  CheckCircle, 
  AlertTriangle,
  Loader2, 
  Building,
  MapPin,
  Calendar,
  Layers
} from "lucide-react";

interface VerificationData {
  reportId: string;
  releaseVersion: number;
  createdAt: string;
  updatedAt: string;
  dossierSchemaVersion: string;
  operatorReadinessStatus: string;
  readinessScore: string;
  criticalBlockerCount: number;
  materialFindingCount: number;
  openFindingCount: number;
  evidenceCoverage: string;
  crosswalkCoverage: string;
  installationName: string;
  country: string;
  productionRoute: string;
  reportingPeriod: string;
  totalEmbeddedEmissions: string;
  specificEmbeddedEmissions: string;
  goodsCount: number;
}

export default function TokenVerificationPage() {
  const params = useParams();
  const publicToken = params?.publicToken as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<VerificationData | null>(null);

  useEffect(() => {
    if (!publicToken) return;

    const fetchVerification = async () => {
      try {
        const res = await fetch(`/api/verify/token/${publicToken}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError("The requested CBAM verification dossier is not active or could not be found.");
          } else {
            setError("Failed to retrieve verification details. Please try again later.");
          }
          return;
        }
        const body = await res.json();
        setData(body.data);
      } catch (err) {
        console.error(err);
        setError("A network error occurred while verifying the token.");
      } finally {
        setLoading(false);
      }
    };

    fetchVerification();
  }, [publicToken]);

  const handleDownload = () => {
    if (!publicToken) return;
    window.location.href = `/api/verify/token/${publicToken}/download`;
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6">
        <Loader2 className="w-12 h-12 text-accent animate-spin mb-4" />
        <p className="text-muted font-medium animate-pulse">
          Retrieving secure CBAMValid verification records...
        </p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-surface border border-border rounded-3xl p-8 text-center shadow-md">
          <ShieldAlert className="w-16 h-16 text-accent mx-auto mb-6 opacity-80" />
          <h1 className="text-2xl font-bold text-foreground mb-3">Verification Failed</h1>
          <p className="text-muted mb-8 text-sm leading-relaxed">{error || "Invalid verification record."}</p>
          <a 
            href="/verify" 
            className="inline-flex items-center justify-center px-6 py-3 border border-border hover:border-border-strong text-foreground font-medium rounded-xl transition-all"
          >
            Go back to Manual Search
          </a>
        </div>
      </main>
    );
  }

  const isReady = data.operatorReadinessStatus === "READY_FOR_VERIFIER_REVIEW";
  const readinessScoreVal = parseFloat(data.readinessScore || "0");

  return (
    <main className="min-h-screen bg-background text-foreground py-16 px-4 md:px-8 font-sans selection:bg-accent/30">
      <div className="max-w-5xl mx-auto">
        
        {/* Top Header Section */}
        <header className="mb-12 text-center md:text-left flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <span className="text-[11px] uppercase tracking-[0.2em] font-semibold text-accent bg-accent-soft px-3 py-1 rounded-full">
              Secured Release Dossier
            </span>
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground tracking-tight mt-3">
              CBAMValid Verification Registry
            </h1>
            <p className="text-muted text-sm mt-2">
              Cryptographically signed evidence package prepared for independent verification review.
            </p>
          </div>
          
          <button
            onClick={handleDownload}
            className="flex items-center justify-center gap-2.5 px-6 py-3.5 bg-accent hover:bg-accent-hover text-surface font-semibold rounded-xl transition-all shadow-sm"
          >
            <Download className="w-5 h-5" />
            <span>Download Verifier Pack (ZIP)</span>
          </button>
        </header>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Status Badge & Dynamic Scores */}
          <section className="lg:col-span-1 flex flex-col gap-6">
            
            {/* Status Card */}
            <div className="bg-surface border border-border rounded-3xl p-6 shadow-sm">
              <h2 className="text-xs uppercase tracking-wider text-muted font-semibold mb-4">
                Dossier Status
              </h2>
              
              <div className="flex items-start gap-4 mb-6">
                {isReady ? (
                  <div className="p-3 bg-accent-soft border border-accent/20 text-accent rounded-2xl">
                    <ShieldCheck className="w-8 h-8" />
                  </div>
                ) : (
                  <div className="p-3 bg-accent/5 border border-accent/10 text-accent rounded-2xl">
                    <AlertTriangle className="w-8 h-8" />
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-bold text-foreground leading-tight">
                    {isReady ? "Ready for Review" : "Readiness Blocked"}
                  </h3>
                  <span className="text-xs text-muted font-mono">
                    {data.operatorReadinessStatus}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-2 mb-6">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-muted">Readiness Score</span>
                  <span className="text-accent">
                    {data.readinessScore}%
                  </span>
                </div>
                <div className="h-2 w-full bg-border rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-accent transition-all duration-1000"
                    style={{ width: `${readinessScoreVal}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border text-center">
                <div>
                  <span className="block text-xl font-bold text-foreground">{data.criticalBlockerCount}</span>
                  <span className="text-[10px] uppercase text-muted font-semibold">Blockers</span>
                </div>
                <div>
                  <span className="block text-xl font-bold text-foreground">{data.openFindingCount}</span>
                  <span className="text-[10px] uppercase text-muted font-semibold">Findings</span>
                </div>
              </div>
            </div>

            {/* Coverage Card */}
            <div className="bg-surface border border-border rounded-3xl p-6 shadow-sm">
              <h2 className="text-xs uppercase tracking-wider text-muted font-semibold mb-4">
                Assurance Metrics
              </h2>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted">Evidence Coverage</span>
                  <span className="font-semibold text-foreground">{data.evidenceCoverage}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted">Crosswalk Coverage</span>
                  <span className="font-semibold text-accent">{data.crosswalkCoverage}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted">Release Version</span>
                  <span className="font-mono text-foreground text-xs bg-background px-2.5 py-0.5 rounded-full">
                    v{data.releaseVersion}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Right Column: Case Scope & Details */}
          <section className="lg:col-span-2 flex flex-col gap-6">
            
            {/* Metadata Card */}
            <div className="bg-surface border border-border rounded-3xl p-8 shadow-sm">
              <h2 className="text-sm font-bold text-foreground mb-6 flex items-center gap-2">
                <Building className="w-5 h-5 text-accent" />
                <span>Scope of Installation</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div className="flex items-start gap-3">
                  <Building className="w-5 h-5 text-muted mt-1" />
                  <div>
                    <span className="block text-xs text-muted font-semibold uppercase">Installation</span>
                    <span className="text-sm font-semibold text-foreground">{data.installationName}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-muted mt-1" />
                  <div>
                    <span className="block text-xs text-muted font-semibold uppercase">Installation Country</span>
                    <span className="text-sm font-semibold text-foreground">{data.country}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Layers className="w-5 h-5 text-muted mt-1" />
                  <div>
                    <span className="block text-xs text-muted font-semibold uppercase">Production Route</span>
                    <span className="text-sm font-semibold text-foreground">{data.productionRoute}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-muted mt-1" />
                  <div>
                    <span className="block text-xs text-muted font-semibold uppercase">Reporting Period</span>
                    <span className="text-sm font-semibold text-foreground">{data.reportingPeriod}</span>
                  </div>
                </div>

              </div>
            </div>

            {/* Calculations Card */}
            <div className="bg-surface border border-border rounded-3xl p-8 shadow-sm">
              <h2 className="text-sm font-bold text-foreground mb-6 flex items-center gap-2">
                <Globe className="w-5 h-5 text-accent" />
                <span>Emissions Summary</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="bg-background rounded-2xl p-4 border border-border">
                  <span className="block text-xs text-muted font-semibold uppercase">Total Embedded</span>
                  <span className="text-xl font-extrabold text-foreground mt-1 block">
                    {data.totalEmbeddedEmissions} <span className="text-xs font-normal text-muted">tCO2e</span>
                  </span>
                </div>
                <div className="bg-background rounded-2xl p-4 border border-border">
                  <span className="block text-xs text-muted font-semibold uppercase">Specific Intensity</span>
                  <span className="text-xl font-extrabold text-foreground mt-1 block">
                    {data.specificEmbeddedEmissions} <span className="text-xs font-normal text-muted">t/t</span>
                  </span>
                </div>
                <div className="bg-background rounded-2xl p-4 border border-border">
                  <span className="block text-xs text-muted font-semibold uppercase">CN Goods Groups</span>
                  <span className="text-xl font-extrabold text-foreground mt-1 block">
                    {data.goodsCount} <span className="text-xs font-normal text-muted">items</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Legal Notice / Disclaimer */}
            <div className="bg-background border border-border rounded-2xl p-5 flex gap-4 text-xs text-muted leading-relaxed">
              <AlertTriangle className="w-6 h-6 text-accent shrink-0 mt-0.5" />
              <p>
                <strong>Regulatory & Legal Boundary:</strong> This dossier is an operator-prepared verifier-readiness pack. It does not constitute an accredited independent verification opinion, customs approval, reasonable assurance conclusion, or guarantee of EU Registry acceptance. It has been prepared to facilitate independent review under Regulation (EU) 2023/956 and Implementing Regulation (EU) 2025/2546.
              </p>
            </div>

          </section>

        </div>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-border flex flex-col sm:flex-row justify-between text-xs text-muted gap-4">
          <div>
            <span>Report ID: <span className="font-mono text-muted">{data.reportId}</span></span>
            <span className="mx-2">|</span>
            <span>Version: {data.dossierSchemaVersion}</span>
          </div>
          <div>
            <span>Sealed: {new Date(data.createdAt).toLocaleDateString()}</span>
            <span className="mx-2">|</span>
            <span>Registry Status: ACTIVE</span>
          </div>
        </footer>

      </div>
    </main>
  );
}
