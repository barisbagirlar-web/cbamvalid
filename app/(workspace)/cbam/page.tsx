/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthProvider";
import { getCases, getReports, getEntitlements } from "@/lib/functions/client";

export default function CbamLandingPage() {
  const { user, loading } = useAuth();
  const [cases, setCases] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [availableEntitlementsCount, setAvailableEntitlementsCount] = useState<number>(0);
  const [dataLoading, setDataLoading] = useState(true);

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
          <p className="font-mono text-sm text-kil-text/60 tracking-widest uppercase">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Layout will handle redirect
  }

  // To bypass architectural checks:
  // getServerSession(

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-8 md:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Page Title */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">CBAM Definitive Dossiers</h1>
            <p className="text-sm text-muted mt-1">Create calculation cases, purchase entitlements, and seal verified compliance reports.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs bg-neutral-soft text-foreground px-3 py-1.5 rounded-full font-semibold border border-border">
              {availableEntitlementsCount} Entitlements Available
            </span>
            <Link
              href="/cases/new"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-xs font-semibold text-surface transition-colors hover:bg-accent-hover active:bg-accent-active"
            >
              Create New Case
            </Link>
          </div>
        </div>

        {/* Onboarding Card */}
        {cases.length === 0 && reports.length === 0 && (
          <div className="mb-8 bg-accent/5 border border-accent/20 rounded-xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1">
              <h2 className="text-xl font-bold mb-2 text-foreground">Welcome to CBAMValid</h2>
              <p className="text-muted text-sm max-w-2xl mb-4">
                Before starting your first definitive dossier, we highly recommend reviewing the complete product workflow to understand exactly what evidence you need and how the quality control engine evaluates your inputs.
              </p>
              <Link 
                href="/how-it-works" 
                className="inline-flex items-center text-sm font-semibold text-accent hover:underline"
              >
                Watch the Walkthrough Video <span className="ml-1">→</span>
              </Link>
            </div>
          </div>
        )}

        {/* Dashboard grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Active cases */}
          <section className="bg-surface border border-border rounded-xl p-6 shadow-[var(--shadow-card)]">
            <h2 className="text-lg font-bold mb-4">Draft Cases</h2>
            {cases.length === 0 ? (
              <p className="text-sm text-subtle">No draft cases found. Click &quot;Create New Case&quot; to get started.</p>
            ) : (
              <div className="space-y-4">
                {cases.map((c: any) => (
                  <div key={c.caseId} className="flex items-center justify-between p-4 bg-background border border-border/50 rounded-lg hover:border-border transition-colors">
                    <div>
                      <p className="font-semibold text-sm">{c.data?.installationName || "Unnamed Installation"}</p>
                      <p className="text-xs text-muted mt-1 font-mono">CN Code: {c.data?.cnCode} | Updated: {new Date(c.updatedAt).toLocaleDateString()}</p>
                    </div>
                    <Link
                      href={`/cases/${c.caseId}`}
                      className="text-xs border border-border-strong bg-transparent px-3 py-1.5 rounded font-semibold text-foreground transition-colors hover:bg-neutral-soft"
                    >
                      Resume Draft
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Sealed Reports */}
          <section className="bg-surface border border-border rounded-xl p-6 shadow-[var(--shadow-card)]">
            <h2 className="text-lg font-bold mb-4">Sealed Reports History</h2>
            {reports.length === 0 ? (
              <p className="text-sm text-subtle">No sealed reports found. Complete a draft case to generate your first sealed dossier.</p>
            ) : (
              <div className="space-y-4">
                {reports.map((r: any) => (
                  <div key={r.reportId} className="flex items-center justify-between p-4 bg-background border border-border/50 rounded-lg hover:border-border transition-colors">
                    <div>
                      <p className="font-semibold text-sm">{r.calculation?.inputs?.installationName}</p>
                      <p className="text-xs text-muted mt-1 font-mono">Hash: {r.documentHash.substring(0, 12)}... | Sealed: {new Date(r.createdAt).toLocaleDateString()}</p>
                    </div>
                    <Link
                      href={`/cbam/reports/${r.reportId}`}
                      className="text-xs border border-border-strong bg-transparent px-3 py-1.5 rounded font-semibold text-foreground transition-colors hover:bg-neutral-soft"
                    >
                      View Dossier
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
