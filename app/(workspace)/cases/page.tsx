"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthProvider";
import { getCases, type CbamCaseRecord } from "@/lib/functions/client";
import { ArrowRight, Clock, Plus } from "lucide-react";

function formatDate(value?: string): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleDateString();
}

function installationName(record: CbamCaseRecord): string {
  const value = record.data.installation.name.value;
  return typeof value === "string" && value.trim() ? value : "Unnamed Installation";
}

function primaryCnCode(record: CbamCaseRecord): string {
  const value = record.data.goods[0]?.cnCode.value;
  return typeof value === "string" && value.trim() ? value : "Pending";
}

export default function CasesPage() {
  const { user, loading } = useAuth();
  const [cases, setCases] = useState<CbamCaseRecord[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (loading || !user) return;

    const fetchCases = async () => {
      setDataLoading(true);
      try {
        setCases(await getCases());
      } catch (error) {
        console.error("Error fetching cases:", error);
      } finally {
        setDataLoading(false);
      }
    };

    void fetchCases();
  }, [user, loading]);

  if (loading || dataLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-kil-base px-6">
        <div className="flex flex-col items-center">
          <div className="mb-6 h-8 w-8 animate-spin rounded-full border-2 border-kil-text/20 border-t-kil-accent" />
          <p className="font-mono text-sm uppercase tracking-widest text-kil-text/60">Loading Cases...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background px-4 py-8 text-foreground md:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-3xl font-extrabold tracking-tight">My CBAM Cases</h1>
            <p className="mt-1 text-sm text-muted">Manage every draft, review-required and verification-ready dossier.</p>
          </div>
          <Link href="/cases/new" className="inline-flex items-center justify-center gap-1.5 rounded-md bg-accent px-4 py-2 text-xs font-semibold text-surface shadow-sm hover:bg-accent-hover">
            <Plus className="h-3.5 w-3.5" /> Start New Case
          </Link>
        </header>

        {cases.length === 0 ? (
          <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-border bg-surface p-12 text-center shadow-sm">
            <Clock className="mx-auto mb-4 h-10 w-10 text-muted/65" />
            <h2 className="mb-2 text-xl font-bold">No Active Cases Found</h2>
            <p className="mb-6 text-sm leading-relaxed text-muted">
              Create your first dossier to begin installation scoping, embedded-emissions calculation and evidence mapping.
            </p>
            <Link href="/cases/new" className="inline-flex items-center gap-1.5 rounded-md bg-accent px-6 py-2.5 text-sm font-semibold text-surface shadow-sm hover:bg-accent-hover">
              Create Your First Dossier <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm font-semibold">{cases.length} case{cases.length === 1 ? "" : "s"}</p>
              <p className="text-xs text-muted">Complete case history</p>
            </div>
            <div className="space-y-4">
              {cases.map((record) => (
                <article key={record.caseId} className="flex flex-col gap-4 rounded-lg border border-border/60 bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">{installationName(record)}</p>
                    <p className="mt-1 text-xs font-mono text-muted">
                      CN {primaryCnCode(record)} · {record.status} · Updated {formatDate(record.updatedAt)}
                    </p>
                    <span className="mt-2 inline-flex rounded border border-border bg-neutral-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                      {record.data.status}
                    </span>
                  </div>
                  <Link href={`/cases/${record.caseId}`} className="inline-flex items-center gap-1 self-end rounded-md bg-accent px-4 py-2 text-xs font-semibold text-surface hover:bg-accent-hover sm:self-auto">
                    Open Case <ArrowRight className="h-3 w-3" />
                  </Link>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
