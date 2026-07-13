/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthProvider";
import { getCases } from "@/lib/functions/client";
import { Plus, ArrowRight, Clock } from "lucide-react";

export default function CasesPage() {
  const { user, loading } = useAuth();
  const [cases, setCases] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (loading || !user) return;

    const fetchCases = async () => {
      setDataLoading(true);
      try {
        const res = await getCases();
        if (res) {
          setCases(res || []);
        }
      } catch (err) {
        console.error("Error fetching cases:", err);
      } finally {
        setDataLoading(false);
      }
    };

    fetchCases();
  }, [user, loading]);

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kil-base px-6">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-2 border-kil-text/20 border-t-kil-accent rounded-full animate-spin mb-6"></div>
          <p className="font-mono text-sm text-kil-text/60 tracking-widest uppercase">Loading Cases...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-8 md:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between pb-6 border-b border-border mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight font-serif text-foreground">My CBAM Cases</h1>
            <p className="text-sm text-muted mt-1">Manage, update and review your active draft dossiers.</p>
          </div>
          <Link
            href="/cases/new"
            className="bg-accent hover:bg-accent-hover text-surface px-4 py-2 rounded-md font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Start New Case
          </Link>
        </div>

        {cases.length === 0 ? (
          <div className="bg-surface border border-border border-dashed rounded-2xl p-12 text-center max-w-xl mx-auto shadow-sm">
            <Clock className="w-10 h-10 text-muted/65 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">No Active Cases Found</h2>
            <p className="text-muted text-sm mb-6 leading-relaxed">
              Create your initial draft dossier to start calculating embedded emissions and mapping production routes under EU CBAM rules.
            </p>
            <Link
              href="/cases/new"
              className="inline-flex bg-accent hover:bg-accent-hover text-surface text-sm font-semibold px-6 py-2.5 rounded-md transition-colors items-center gap-1.5 shadow-sm"
            >
              Create Your First Dossier <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
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
                  <Link
                    href={`/cases/${c.caseId}`}
                    className="bg-accent hover:bg-accent-hover text-surface text-xs font-semibold px-4 py-2 rounded-md transition-colors flex items-center gap-1 self-end sm:self-auto"
                  >
                    Resume Draft <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
