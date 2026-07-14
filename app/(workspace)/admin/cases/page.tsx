import React from "react";
import { requireSuperAdmin } from "@/lib/auth/admin-gate";
import { adminDb } from "@/lib/firebase/admin";
import Link from "next/link";
import { ArrowLeft, FileText, Calendar, ArrowRight } from "lucide-react";

export default async function AdminCasesPage() {
  await requireSuperAdmin();

  // Fetch all cases in the platform
  const snapshot = await adminDb
    .collection("cases")
    .orderBy("updatedAt", "desc")
    .limit(50)
    .get();

  const cases = snapshot.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      uid: d.ownerId || "N/A",
      status: d.status || "DRAFT",
      version: d.version || 1,
      importerName: d.importerIdentity?.legalName?.value || "Unspecified",
      installationName: d.installation?.name?.value || "Unspecified",
      updatedAt: d.updatedAt || "",
    };
  });

  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-xs font-semibold text-muted hover:text-foreground flex items-center gap-2">
        <ArrowLeft className="w-3 h-3" /> Back to Overview
      </Link>

      <div className="flex justify-between items-end border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-foreground">Cases Management</h1>
          <p className="text-muted text-sm mt-1">Audit active CBAM cases, reports preparation, and operator dossier data.</p>
        </div>
      </div>

      <div className="p-6 bg-surface border border-border rounded-lg shadow-sm space-y-4">
        <h2 className="text-lg font-bold font-serif text-foreground">Global Cases Registry</h2>

        {cases.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-lg">
            <FileText className="w-12 h-12 text-muted mx-auto mb-3 opacity-50" />
            <p className="text-muted text-sm">No active cases are registered in the platform yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-2">Case ID</th>
                  <th className="py-2">Owner (UID)</th>
                  <th className="py-2">Importer Name</th>
                  <th className="py-2">Installation</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Version</th>
                  <th className="py-2">Last Updated</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-border/10">
                    <td className="py-3 font-mono text-xs text-accent">{c.id}</td>
                    <td className="py-3 font-mono text-xs max-w-[120px] truncate" title={c.uid}>
                      {c.uid}
                    </td>
                    <td className="py-3 max-w-[150px] truncate">{c.importerName}</td>
                    <td className="py-3 max-w-[150px] truncate">{c.installationName}</td>
                    <td className="py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                        c.status === "VERIFICATION_READY"
                          ? "bg-accent/15 text-accent"
                          : "bg-muted/30 text-muted-foreground"
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-xs">v{c.version}</td>
                    <td className="py-3 text-xs text-muted flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {c.updatedAt ? new Date(c.updatedAt).toLocaleDateString() : "Unknown"}
                    </td>
                    <td className="py-3">
                      <Link 
                        href={`/admin/users/${c.uid}`}
                        className="text-xs text-accent font-semibold flex items-center gap-1 hover:text-accent-hover transition-colors"
                      >
                        Auditor View <ArrowRight className="w-3 h-3" />
                      </Link>
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
