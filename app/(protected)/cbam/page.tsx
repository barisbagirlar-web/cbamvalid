/* eslint-disable @typescript-eslint/no-explicit-any */
import { getServerSession } from "@/lib/auth/get-server-session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminDb } from "@/lib/firebase/admin";
import { FileText, ArrowRight } from "lucide-react";

import SignOutButton from "./SignOutButton";

export const dynamic = "force-dynamic";

export default async function CbamLandingPage() {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }

  // Load cases, reports and entitlements in parallel (independent queries, no shared dependency)
  const [casesSnapshot, reportsSnapshot, entitlementsSnapshot] = await Promise.all([
    getAdminDb().collection("cbam_cases").where("uid", "==", session.uid).get(),
    getAdminDb().collection("cbam_reports").where("uid", "==", session.uid).get(),
    getAdminDb().collection("entitlements").where("uid", "==", session.uid).where("status", "==", "AVAILABLE").get(),
  ]);

  const cases = casesSnapshot.docs
    .map((doc: any) => doc.data())
    .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const reports = reportsSnapshot.docs
    .map((doc: any) => doc.data())
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const availableEntitlementsCount = entitlementsSnapshot.size;

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-8 md:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">CBAM Definitive Dossiers</h1>
            <p className="text-sm text-muted mt-1">Create calculation cases, purchase entitlements, and seal verified compliance reports.</p>
            <p className="text-xs text-muted mt-1 font-semibold">{session.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs bg-neutral-soft text-foreground px-3 py-1.5 rounded-full font-semibold border border-border">
              {availableEntitlementsCount} Entitlements Available
            </span>
            <Link
              href="/cbam/new"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-xs font-semibold text-surface transition-colors hover:bg-accent-hover active:bg-accent-active"
            >
              Create New Case
            </Link>
            <SignOutButton />
          </div>
        </header>

        {/* First-time onboarding banner: unmissable start point for brand-new accounts */}
        {cases.length === 0 && reports.length === 0 && (
          <section className="mb-8 rounded-xl border border-accent/40 bg-accent-soft px-6 py-8 md:px-10 md:py-10 text-center">
            <FileText className="w-10 h-10 text-accent mx-auto mb-4" strokeWidth={1.5} aria-hidden="true" />
            <h2 className="text-lg md:text-xl font-bold text-foreground">Start your first CBAM report here</h2>
            <p className="text-sm text-muted mt-2 max-w-xl mx-auto">
              You have {availableEntitlementsCount} entitlement{availableEntitlementsCount === 1 ? "" : "s"} available. Create a case to begin entering exporter, product, and emissions data.
            </p>
            <Link
              href="/cbam/new"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-6 py-3 text-sm font-semibold text-surface transition-colors hover:bg-accent-hover active:bg-accent-active mt-5"
            >
              Start New CBAM Case <ArrowRight className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
            </Link>
          </section>
        )}

        {/* Dashboard grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Active cases */}
          <section className="bg-surface border border-border rounded-xl p-6 shadow-[var(--shadow-card)]">
            <h2 className="text-lg font-bold mb-4">Draft Cases</h2>
            {cases.length === 0 ? (
              <div className="text-center py-8 space-y-3">
                <p className="text-sm text-subtle">No draft cases found.</p>
                <Link
                  href="/cbam/new"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-xs font-semibold text-surface transition-colors hover:bg-accent-hover active:bg-accent-active"
                >
                  Create New Case
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {cases.map((c: any) => (
                  <div key={c.caseId} className="flex items-center justify-between p-4 bg-background border border-border/50 rounded-lg hover:border-border transition-colors">
                    <div>
                      <p className="font-semibold text-sm">{c.data?.installationName || "Unnamed Installation"}</p>
                      <p className="text-xs text-muted mt-1 font-mono">CN Code: {c.data?.cnCode} | Updated: {new Date(c.updatedAt).toLocaleDateString()}</p>
                    </div>
                    <Link
                      href={`/cbam/new?caseId=${c.caseId}`}
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
