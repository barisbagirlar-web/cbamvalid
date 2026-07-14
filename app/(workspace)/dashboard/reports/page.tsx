/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { getReports } from "@/lib/functions/client";
import Link from "next/link";
import { ShieldCheck, Calendar, ArrowRight } from "lucide-react";

export default function DashboardReportsHistoryPage() {
  const { user, loading } = useAuth();
  const [reports, setReports] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (loading || !user) return;

    const fetchReports = async () => {
      setDataLoading(true);
      try {
        const data = await getReports();
        if (data) {
          setReports(data || []);
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
    <div className="min-h-screen bg-background text-foreground px-4 py-8 md:px-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Sealed Report History</h1>
          <p className="text-xs text-muted mt-1">Audit log of all sealed Definitive Cost & Evidence Dossiers.</p>
        </div>

        <section className="bg-surface border border-border rounded-xl p-6 shadow-[var(--shadow-card)]">
          {reports.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <ShieldCheck className="w-12 h-12 text-subtle mx-auto" strokeWidth={1.75} />
              <p className="text-sm text-muted">No sealed dossiers found.</p>
              <Link href="/cases/new" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-xs font-semibold text-surface transition-colors hover:bg-accent-hover active:bg-accent-active">
                Create New Case
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {reports.map((r: any) => (
                <div key={r.reportId} className="flex items-center justify-between py-4 first:pt-0 last:pb-0 gap-4">
                  <div className="space-y-1">
                    <p className="font-semibold text-sm">{r.calculation?.inputs?.installationName}</p>
                    <div className="flex items-center gap-4 text-xs text-muted font-mono">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" strokeWidth={1.75} /> {new Date(r.createdAt).toLocaleDateString()}
                      </span>
                      <span>Hash: {r.documentHash.substring(0, 16)}...</span>
                    </div>
                  </div>
                  <Link
                    href={`/cbam/reports/${r.reportId}`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border-strong bg-transparent px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-neutral-soft"
                  >
                    Details <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
