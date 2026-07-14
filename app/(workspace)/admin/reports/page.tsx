import React from "react";
import { requireSuperAdmin } from "@/lib/auth/admin-gate";
import { adminDb } from "@/lib/firebase/admin";
import Link from "next/link";
import { ArrowLeft, FileText, Calendar, Lock } from "lucide-react";

export default async function AdminReportsPage() {
  await requireSuperAdmin();

  // Fetch all reports in the platform
  const snapshot = await adminDb
    .collection("cbam_reports")
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();

  const reports = snapshot.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      caseId: d.caseId || "N/A",
      uid: d.uid || "N/A",
      releaseVersion: d.releaseVersion || 1,
      manifestHash: d.manifestHash || "",
      createdAt: d.createdAt || "",
    };
  });

  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-xs font-semibold text-muted hover:text-foreground flex items-center gap-2">
        <ArrowLeft className="w-3 h-3" /> Back to Overview
      </Link>

      <div className="flex justify-between items-end border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-foreground">Reports Management</h1>
          <p className="text-muted text-sm mt-1">Audit sealed installer packages, digital signatures, and manifest records.</p>
        </div>
      </div>

      <div className="p-6 bg-surface border border-border rounded-lg shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-foreground font-semibold">
          <Lock className="w-4 h-4 text-accent" />
          <span>Sealed Immutable Dossiers (Annex VI verifier packages)</span>
        </div>

        {reports.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-lg">
            <FileText className="w-12 h-12 text-muted mx-auto mb-3 opacity-50" />
            <p className="text-muted text-sm">No verification readiness reports have been sealed yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-2">Report ID</th>
                  <th className="py-2">Case ID</th>
                  <th className="py-2">Owner UID</th>
                  <th className="py-2">Dossier Version</th>
                  <th className="py-2">Manifest SHA-256</th>
                  <th className="py-2">Sealed Date</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-border/10">
                    <td className="py-3 font-mono text-xs text-accent">{r.id}</td>
                    <td className="py-3 font-mono text-xs text-muted">{r.caseId}</td>
                    <td className="py-3 font-mono text-xs max-w-[120px] truncate" title={r.uid}>
                      {r.uid}
                    </td>
                    <td className="py-3 font-mono text-xs">v{r.releaseVersion}</td>
                    <td className="py-3 font-mono text-xs max-w-[200px] truncate" title={r.manifestHash}>
                      {r.manifestHash}
                    </td>
                    <td className="py-3 text-xs text-muted flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {r.createdAt ? new Date(r.createdAt).toLocaleString() : "Unknown"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
