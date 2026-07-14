/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthProvider";
import { getCases, getReports, getEntitlements } from "@/lib/functions/client";
import { 
  ArrowRight, 
  Plus, 
  FileText, 
  HelpCircle, 
  PlayCircle, 
  CheckCircle2, 
  Lock, 
  ShoppingBag,
  Info,
  Clock
} from "lucide-react";

export default function CbamLandingPage() {
  const { user, loading } = useAuth();
  const [cases, setCases] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [availableEntitlementsCount, setAvailableEntitlementsCount] = useState<number>(0);
  const [dataLoading, setDataLoading] = useState(true);
  const [showChecklist, setShowChecklist] = useState(false);

  useEffect(() => {
    if (loading || !user) return;

    const fetchData = async () => {
      setDataLoading(true);
      try {
        const [casesRes, reportsRes, entitlementsRes] = await Promise.all([
          getCases(),
          getReports(),
          getEntitlements()
        ]);

        if (casesRes) {
          setCases(casesRes || []);
        }
        if (reportsRes) {
          setReports(reportsRes || []);
        }
        if (entitlementsRes) {
          setAvailableEntitlementsCount((entitlementsRes || []).length);
        }
      } catch (err) {
        console.error("Error fetching landing page data:", err);
      } finally {
        setDataLoading(false);
      }
    };

    fetchData();
  }, [user, loading]);

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kil-base px-6">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-2 border-kil-text/20 border-t-kil-accent rounded-full animate-spin mb-6"></div>
          <p className="font-mono text-sm text-kil-text/60 tracking-widest uppercase">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const workflowSteps = [
    { num: 1, title: "Case & Reporting Scope", desc: "Define boundaries and CN codes." },
    { num: 2, title: "Goods & Customs Data", desc: "Import CN code custom declarations." },
    { num: 3, title: "Installation & Production Route", desc: "Establish operator bounds." },
    { num: 4, title: "Embedded Emissions", desc: "Direct & indirect carbon footprints." },
    { num: 5, title: "Precursors & Adjustments", desc: "Complex supply chain factors." },
    { num: 6, title: "Evidence Register", desc: "Link primary verification documents." },
    { num: 7, title: "Quality Review", desc: "Automated QC integrity scans." },
    { num: 8, title: "Seal & Deliverables", desc: "Verify and download verifier ZIP." }
  ];

  const requiredData = [
    "Installation and operator details",
    "Reporting year",
    "Goods and CN codes",
    "Production quantities",
    "Fuel and electricity consumption",
    "Direct and indirect emissions data",
    "Precursor information, where applicable",
    "Meter, invoice and production records",
    "Supporting evidence documents"
  ];

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-8 md:px-8">
      <div className="max-w-6xl mx-auto">
        
        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-6 border-b border-border mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight font-serif">CBAM Definitive Dossiers</h1>
            <p className="text-muted text-sm mt-1">
              Create calculation cases, link evidence, and generate a sealed verifier-preparation package.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {availableEntitlementsCount > 0 ? (
              <div className="flex items-center gap-2 bg-accent/10 border border-accent/20 px-4 py-2 rounded-full">
                <span className="w-2.5 h-2.5 bg-accent rounded-full animate-pulse" />
                <span className="text-xs font-semibold text-accent">
                  1 Active Preparation Pack ({availableEntitlementsCount} Versions Remaining)
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-xs bg-muted/40 text-muted border border-border px-3 py-1.5 rounded-full font-medium">
                  No Active Preparation Pack
                </span>
                <Link
                  href="/credits/buy"
                  className="bg-accent hover:bg-accent-hover text-surface px-4 py-2 rounded-md font-semibold text-xs transition-colors flex items-center gap-1.5"
                >
                  <ShoppingBag className="w-3.5 h-3.5" /> Buy Pack — $150
                </Link>
              </div>
            )}
            
            {cases.length > 0 && (
              <Link
                href="/cases/new"
                className="bg-foreground hover:bg-foreground/90 text-background px-4 py-2 rounded-md font-semibold text-xs transition-colors flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Create New Case
              </Link>
            )}
          </div>
        </div>

        {/* Onboarding Dashboard (New Users with No Cases) */}
        {cases.length === 0 && (
          <div className="space-y-8">
            <div className="bg-surface border border-border rounded-2xl p-6 md:p-10 shadow-sm relative overflow-hidden">
              <div className="max-w-3xl">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-accent/10 text-accent mb-4">
                  <Info className="w-3.5 h-3.5" /> Exporter Verification Preparation Pack
                </span>
                <h2 className="text-2xl md:text-3xl font-extrabold font-serif mb-4">
                  Prepare Your CBAM Verification Package
                </h2>
                <p className="text-muted text-base leading-relaxed mb-6">
                  Build a structured dossier for one installation and one reporting year. Enter production and emissions data, link supporting evidence, resolve quality findings, and generate a sealed verifier-preparation package.
                </p>

                {/* Quick Process Steps */}
                <div className="mb-8">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/80 mb-3">Start here:</h3>
                  <ol className="space-y-2.5 text-sm text-muted">
                    <li className="flex items-start gap-2">
                      <span className="font-mono text-accent font-bold">1.</span>
                      <span>Review the required data and evidence guidelines below.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-mono text-accent font-bold">2.</span>
                      <span>Create your first dossier using the draft workspace (no upfront payment needed).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-mono text-accent font-bold">3.</span>
                      <span>Complete the eight data preparation sections with automatic compliance checks.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-mono text-accent font-bold">4.</span>
                      <span>Purchase the $150 Preparation Pack before sealing and downloading final deliverables.</span>
                    </li>
                  </ol>
                </div>

                {/* Main CTAs */}
                <div className="flex flex-col sm:flex-row gap-4 mb-8">
                  <Link
                    href="/cases/new"
                    className="bg-accent hover:bg-accent-hover text-surface px-8 py-3 rounded-md font-semibold transition-colors flex items-center justify-center gap-2 text-sm shadow-sm"
                  >
                    Create Your First Dossier <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    href="/sample-dossier"
                    className="bg-surface hover:bg-muted/10 border border-border text-foreground px-6 py-3 rounded-md font-semibold transition-colors text-sm flex items-center justify-center gap-1.5"
                  >
                    <FileText className="w-4 h-4" /> View Sample Dossier
                  </Link>
                  <button
                    onClick={() => setShowChecklist(!showChecklist)}
                    className="bg-surface hover:bg-muted/10 border border-border text-foreground px-6 py-3 rounded-md font-semibold transition-colors text-sm flex items-center justify-center gap-1.5"
                  >
                    <HelpCircle className="w-4 h-4" /> Review Required Data
                  </button>
                  <Link
                    href="/how-it-works"
                    className="bg-surface hover:bg-muted/10 border border-border text-foreground px-6 py-3 rounded-md font-semibold transition-colors text-sm flex items-center justify-center gap-1.5"
                  >
                    <PlayCircle className="w-4 h-4" /> Watch Walkthrough
                  </Link>
                </div>

                {/* Legal Limitation Banner */}
                <div className="p-4 bg-muted/20 border border-border rounded-lg text-xs text-muted leading-relaxed">
                  <p className="font-semibold text-foreground mb-1">Important Verification Note & Legal Boundaries</p>
                  No payment is required to create your initial draft and verify data applicability. The Preparation Pack is required to seal and download final deliverables. CBAMValid prepares the case dossier for independent verification and does not issue an accredited opinion, independent verification statement, customs approval, EU approval or acceptance guarantee.
                </div>
              </div>
            </div>

            {/* Checklist Drawer */}
            {showChecklist && (
              <div className="bg-surface border border-border rounded-xl p-6 animate-in slide-in-from-top-4">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-accent" /> Required Data & Evidence Checklist
                </h3>
                <p className="text-sm text-muted mb-4">
                  Make sure you have access to the following information before completing your CBAM declaration:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {requiredData.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-background border border-border/40 rounded-lg">
                      <span className="w-1.5 h-1.5 bg-accent rounded-full" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Workflow steps cards */}
            <div>
              <h3 className="text-lg font-bold mb-6 font-serif">The 8-Step Verification Workflow</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {workflowSteps.map((step) => (
                  <div key={step.num} className="bg-surface border border-border rounded-xl p-5 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="w-7 h-7 bg-accent/10 text-accent font-bold text-xs rounded-full flex items-center justify-center">
                        {step.num}
                      </span>
                      <h4 className="font-bold text-sm text-foreground">{step.title}</h4>
                    </div>
                    <p className="text-xs text-muted">{step.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Draft / History Empty State Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
              <div className="bg-surface/50 border border-border/80 border-dashed rounded-xl p-6 text-center">
                <Clock className="w-6 h-6 text-muted/60 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-foreground/80 mb-1">Draft Cases</h4>
                <p className="text-xs text-muted">You will see your active drafts listed here once you create a dossier.</p>
              </div>
              <div className="bg-surface/50 border border-border/80 border-dashed rounded-xl p-6 text-center">
                <Lock className="w-6 h-6 text-muted/60 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-foreground/80 mb-1">Sealed Reports History</h4>
                <p className="text-xs text-muted">Your final sealed verifier preparation downloads will appear here after sealing.</p>
              </div>
            </div>
          </div>
        )}

        {/* Operational Dashboard (Returning Users with Cases) */}
        {cases.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left/Center: Drafts and sealed packages */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Draft Cases */}
              <section className="bg-surface border border-border rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-bold mb-4 font-serif">Draft Cases</h3>
                <div className="space-y-4">
                  {cases.map((c: any) => (
                    <div 
                      key={c.caseId} 
                      className="p-4 bg-background border border-border/60 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:border-border transition-colors"
                    >
                      <div>
                        <p className="font-semibold text-sm">{c.data?.installationName || "Unnamed Installation"}</p>
                        <p className="text-xs text-muted mt-1 font-mono">
                          CN Code: {c.data?.cnCode || "Pending"} | Updated: {new Date(c.updatedAt).toLocaleDateString()}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded bg-neutral-soft text-foreground border border-border">
                            Draft mode
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 self-end sm:self-auto">
                        <Link
                          href={`/cases/${c.caseId}`}
                          className="bg-accent hover:bg-accent-hover text-surface text-xs font-semibold px-4 py-2 rounded-md transition-colors flex items-center gap-1"
                        >
                          Resume Draft <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Sealed Packages */}
              <section className="bg-surface border border-border rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-bold mb-4 font-serif">Sealed Reports History</h3>
                {reports.length === 0 ? (
                  <div className="p-8 text-center bg-background border border-dashed border-border/80 rounded-lg">
                    <Lock className="w-8 h-8 text-muted/65 mx-auto mb-3" />
                    <p className="text-sm text-subtle">No sealed reports found. Complete the draft case checklist to generate your verifier-preparation deliverables.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {reports.map((r: any) => (
                      <div 
                        key={r.reportId} 
                        className="p-4 bg-background border border-border/60 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:border-border transition-colors"
                      >
                        <div>
                          <p className="font-semibold text-sm">{r.calculation?.inputs?.installationName}</p>
                          <p className="text-xs text-muted mt-1 font-mono">
                            Release ID: {r.reportId.substring(0, 8)}... | Sealed: {new Date(r.createdAt).toLocaleDateString()}
                          </p>
                          <p className="text-[11px] text-muted truncate mt-1">Hash: {r.documentHash}</p>
                        </div>
                        <Link
                          href={`/cbam/reports/${r.reportId}`}
                          className="bg-foreground hover:bg-foreground/90 text-background text-xs font-semibold px-4 py-2 rounded-md transition-colors flex items-center justify-center"
                        >
                          View Dossier
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Right: Info / Purchases sidebar */}
            <div className="space-y-8">
              
              {/* Product State summary */}
              <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
                <h4 className="font-bold text-sm uppercase tracking-wider text-muted mb-4">Pack Status</h4>
                
                {availableEntitlementsCount > 0 ? (
                  <div className="space-y-4">
                    <div className="p-3 bg-accent/5 border border-accent/10 rounded-lg text-xs">
                      <span className="font-bold text-accent block">Active Preparation Pack</span>
                      You have <strong>{availableEntitlementsCount}</strong> remaining sealed release packages available.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-3 bg-muted/20 border border-border rounded-lg text-xs text-muted leading-relaxed">
                      <span className="font-bold text-foreground block mb-1">No Active Pack</span>
                      Unlock final exports verification package sealing and zip archive generation.
                    </div>
                    <Link
                      href="/credits/buy"
                      className="bg-accent hover:bg-accent-hover text-surface text-xs font-semibold py-2.5 px-4 rounded-md transition-colors flex items-center justify-center gap-1.5 w-full shadow-sm"
                    >
                      Buy Pack — $150
                    </Link>
                  </div>
                )}

                <div className="mt-6 border-t border-border pt-4 text-xs text-muted space-y-2">
                  <p><strong>1 pack includes:</strong></p>
                  <ul className="list-disc list-inside space-y-1 pl-1">
                    <li>1 Installation Dossier</li>
                    <li>1 Reporting Year Scope</li>
                    <li>8-Step workflow checklist</li>
                    <li>5 Successful Release Seals</li>
                  </ul>
                </div>
              </div>

              {/* Documentation Help widget */}
              <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
                <h4 className="font-bold text-sm uppercase tracking-wider text-muted mb-3">Resources</h4>
                <div className="space-y-2.5 text-xs text-accent">
                  <Link href="/how-it-works" className="flex items-center gap-2 hover:underline">
                    <PlayCircle className="w-4 h-4 text-muted" /> Walkthrough Video
                  </Link>
                  <Link href="/sample-dossier" className="flex items-center gap-2 hover:underline">
                    <FileText className="w-4 h-4 text-muted" /> Sample Sealed Dossier
                  </Link>
                  <Link href="/methodology" className="flex items-center gap-2 hover:underline">
                    <Info className="w-4 h-4 text-muted" /> Methodology & Sources
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
