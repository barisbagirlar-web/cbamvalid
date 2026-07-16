"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, ArrowRight, Clock, Plus, RefreshCw } from "lucide-react";
import { useAuth } from "@/context/AuthProvider";
import {
  formatCaseUpdatedDate,
  getCaseDisplayName,
  getPrimaryCnCode,
} from "@/lib/cbam/case-summary";
import { getDisplayReferenceCode } from "@/lib/cbam/case-id";
import { getCases, deleteCase, type CbamCaseRecord } from "@/lib/functions/client";

function describeError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Cases could not be loaded.";
}

export default function CasesPage() {
  const { user, loading } = useAuth();
  const [cases, setCases] = useState<CbamCaseRecord[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (loading || !user) return;

    let cancelled = false;

    void getCases()
      .then((result) => {
        if (cancelled) return;
        setCases(result);
        setError("");
        setDataLoading(false);
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        console.error("Error fetching cases", loadError);
        setCases([]);
        setError(describeError(loadError));
        setDataLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [attempt, loading, user]);

  const retryLoading = () => {
    setDataLoading(true);
    setError("");
    setAttempt((current) => current + 1);
  };

  const handleDeleteCase = async (caseId: string) => {
    if (!confirm("Are you sure you want to delete this CBAM draft case? This action is permanent and cannot be undone.")) return;
    try {
      await deleteCase(caseId);
      setCases((prev) => prev.filter((c) => c.caseId !== caseId));
    } catch (err) {
      alert("Failed to delete case: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  if (!loading && !user) return null;

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

  if (error) {
    return (
      <main className="min-h-screen bg-background px-6 py-16 text-foreground">
        <section className="mx-auto max-w-xl rounded-2xl border border-red-300 bg-surface p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-700" aria-hidden="true" />
            <div>
              <h1 className="font-serif text-2xl font-bold">Cases could not be loaded</h1>
              <p className="mt-3 text-sm leading-relaxed text-muted">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={retryLoading}
            className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-surface hover:bg-accent-hover"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Retry Loading
          </button>
        </section>
      </main>
    );
  }

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
              {cases.map((cbamCase) => (
                <div
                  key={cbamCase.caseId}
                  className="p-4 bg-background border border-border/60 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:border-border transition-colors"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-sm">{getCaseDisplayName(cbamCase.data)}</p>
                      <span className="bg-accent/10 border border-accent/20 text-accent text-[10px] px-2 py-0.5 rounded font-mono font-bold tracking-wider">
                        {getDisplayReferenceCode(cbamCase.caseId)}
                      </span>
                    </div>
                    <p className="text-xs text-muted mt-1 font-mono">
                      CN Code: {getPrimaryCnCode(cbamCase.data)} | Updated: {formatCaseUpdatedDate(cbamCase.updatedAt)}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded bg-neutral-soft text-foreground border border-border">
                        Draft mode
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <Link
                      href={`/cases/${cbamCase.caseId}`}
                      className="bg-accent hover:bg-accent-hover text-surface text-xs font-semibold px-4 py-2 rounded-md transition-colors flex items-center gap-1"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDeleteCase(cbamCase.caseId)}
                      className="border border-red-200 hover:border-red-300 text-red-700 hover:bg-red-50 text-xs font-semibold px-4 py-2 rounded-md transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
