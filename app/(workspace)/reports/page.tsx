/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthProvider";
import { getReports } from "@/lib/functions/client";
import { Lock, FileText } from "lucide-react";

export default function ReportsPage() {
  const { user, loading } = useAuth();
  const [reports, setReports] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (loading || !user) return;

    const fetchReports = async () => {
      setDataLoading(true);
      try {
        const res = await getReports();
        if (res) {
          setReports(res || []);
        }
      } catch (err) {
        console.error("Error fetching reports:", err);
      } finally {
        setDataLoading(false);
      }
    };

    fetchReports();
  }, [user, loading]);

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kil-base px-6">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-2 border-kil-text/20 border-t-kil-accent rounded-full animate-spin mb-6"></div>
          <p className="font-mono text-sm text-kil-text/60 tracking-widest uppercase">Loading Reports...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-8 md:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="pb-6 border-b border-border mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight font-serif text-foreground">Sealed Reports History</h1>
          <p className="text-sm text-muted mt-1">Review, re-verify and download your immutable verifier-preparation packages.</p>
        </div>

        {reports.length === 0 ? (
          <div className="bg-surface border border-border border-dashed rounded-2xl p-12 text-center max-w-xl mx-auto shadow-sm">
            <Lock className="w-10 h-10 text-muted/65 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">No Sealed Reports Found</h2>
            <p className="text-muted text-sm mb-6 leading-relaxed">
              Once you complete a draft case, verify all compliance rules, and apply a Preparation Pack seal, your immutable verifier ZIP downloads will appear here.
            </p>
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
            <div className="space-y-4">
              {reports.map((r: any) => {
                const cnCode = r.calculation?.inputs?.cnCode || r.cnCode || null;
                const refCode = r.reportId
                  ? `CBAM-R-${r.reportId.replace(/-/g, "").slice(0, 8).toUpperCase()}`
                  : null;
                return (
                  <div
                    key={r.reportId}
                    className="p-4 bg-background border border-border/60 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:border-border transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="font-semibold text-sm">{r.calculation?.inputs?.installationName || "Unnamed Installation"}</p>
                        {refCode && (
                          <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] px-2 py-0.5 rounded font-mono font-bold tracking-wider">
                            {refCode}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted font-mono">
                        {cnCode && <><strong>CN:</strong> {cnCode} · </>}
                        Release ID: {r.reportId.substring(0, 8)}... · Sealed: {new Date(r.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                      </p>
                      <p className="text-[11px] text-muted truncate mt-1 max-w-md font-mono" title={r.documentHash}>
                        Seal: {r.documentHash}
                      </p>
                    </div>
                    <Link
                      href={`/cbam/reports/${r.reportId}`}
                      className="shrink-0 bg-foreground hover:bg-foreground/90 text-background text-xs font-semibold px-4 py-2 rounded-md transition-colors flex items-center justify-center gap-1.5 self-end sm:self-auto"
                    >
                      <FileText className="w-3.5 h-3.5" /> View Dossier
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
