import React from "react";
import { requireSuperAdmin } from "@/lib/auth/admin-gate";
import { adminDb } from "@/lib/firebase/admin";
import Link from "next/link";
import { ArrowLeft, Key, Calendar } from "lucide-react";

export default async function AdminEntitlementsPage() {
  await requireSuperAdmin();

  // Fetch all entitlements
  const snapshot = await adminDb
    .collection("preparation_pack_entitlements")
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();

  const entitlements = snapshot.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      uid: d.uid || "N/A",
      caseId: d.caseId || "N/A",
      orderId: d.orderId || "N/A",
      productCode: d.productCode || "N/A",
      status: d.status || "ACTIVE",
      versionSequence: d.versionSequence || 1,
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
          <h1 className="text-2xl font-bold font-serif text-foreground">Entitlements Management</h1>
          <p className="text-muted text-sm mt-1">Audit active sealing permissions, preparation packs, and download keys.</p>
        </div>
      </div>

      <div className="p-6 bg-surface border border-border rounded-lg shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-foreground font-semibold">
          <Key className="w-4 h-4 text-accent" />
          <span>Preparation Pack Entitlements Registry</span>
        </div>

        {entitlements.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-lg">
            <Key className="w-12 h-12 text-muted mx-auto mb-3 opacity-50" />
            <p className="text-muted text-sm">No entitlements are registered in the platform yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-2">Entitlement ID</th>
                  <th className="py-2">User UID</th>
                  <th className="py-2">Case ID</th>
                  <th className="py-2">Order ID</th>
                  <th className="py-2">Product Code</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Seq</th>
                  <th className="py-2">Granted Date</th>
                </tr>
              </thead>
              <tbody>
                {entitlements.map((e) => (
                  <tr key={e.id} className="border-b border-border/50 hover:bg-border/10">
                    <td className="py-3 font-mono text-xs text-accent">{e.id}</td>
                    <td className="py-3 font-mono text-xs max-w-[120px] truncate" title={e.uid}>
                      {e.uid}
                    </td>
                    <td className="py-3 font-mono text-xs text-muted max-w-[120px] truncate" title={e.caseId}>
                      {e.caseId}
                    </td>
                    <td className="py-3 font-mono text-xs max-w-[120px] truncate" title={e.orderId}>
                      {e.orderId}
                    </td>
                    <td className="py-3 font-mono text-xs">{e.productCode}</td>
                    <td className="py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                        e.status === "ACTIVE"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          : "bg-muted/30 text-muted-foreground"
                      }`}>
                        {e.status}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-xs">{e.versionSequence}</td>
                    <td className="py-3 text-xs text-muted flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {e.createdAt ? new Date(e.createdAt).toLocaleString() : "Unknown"}
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
