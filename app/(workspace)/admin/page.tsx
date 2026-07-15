import React from "react";
import { requireSuperAdmin } from "@/lib/auth/admin-gate";
import { fetchSystemMetrics } from "./actions";
import Link from "next/link";
import { Activity, Users, FileText, Banknote } from "lucide-react";

export default async function AdminDashboardPage() {
  const adminClaims = await requireSuperAdmin();
  
  const metrics = await fetchSystemMetrics();

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end border-b border-border pb-4">
        <div>
          <h1 className="text-3xl font-bold font-serif text-foreground">Super Admin Console</h1>
          <p className="text-muted text-sm mt-1">
            Authenticated as <span className="font-mono text-accent">{adminClaims.email}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 bg-surface border border-border rounded-lg shadow-sm">
          <div className="flex items-center gap-3 mb-2 text-muted">
            <Users className="w-4 h-4" />
            <h3 className="text-xs font-semibold uppercase tracking-wider">Total Users</h3>
          </div>
          <p className="text-3xl font-bold font-mono text-foreground">{metrics.totalUsers}</p>
        </div>
        
        <div className="p-6 bg-surface border border-border rounded-lg shadow-sm">
          <div className="flex items-center gap-3 mb-2 text-muted">
            <FileText className="w-4 h-4" />
            <h3 className="text-xs font-semibold uppercase tracking-wider">Sealed Reports</h3>
          </div>
          <p className="text-3xl font-bold font-mono text-foreground">{metrics.sealedReports}</p>
        </div>

        <div className="p-6 bg-accent/5 border border-accent/20 rounded-lg shadow-sm">
          <div className="flex items-center gap-3 mb-2 text-accent">
            <Banknote className="w-4 h-4" />
            <h3 className="text-xs font-semibold uppercase tracking-wider">Est. Gross Revenue</h3>
          </div>
          <p className="text-3xl font-bold font-mono text-accent">\${metrics.monthlyRevenue.toFixed(2)}</p>
        </div>

        <div className="p-6 bg-surface border border-border rounded-lg shadow-sm flex flex-col justify-center">
          <Link href="/admin/users" className="text-sm font-medium text-accent hover:text-accent-hover text-center underline underline-offset-2">
            Manage Users & Credits &rarr;
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface border border-border rounded-lg shadow-sm p-6">
          <h2 className="font-serif text-xl font-bold mb-4">Quick Actions</h2>
          <div className="space-y-3 flex flex-col items-start">
            <Link href="/admin/credits/grant" className="text-sm font-medium text-foreground hover:text-accent underline underline-offset-2">
              Grant manual account credits
            </Link>
            <Link href="/admin/credits/reverse" className="text-sm font-medium text-foreground hover:text-accent underline underline-offset-2">
              Reverse an incorrect credit grant
            </Link>
            <Link href="/admin/sample-dossier" className="text-sm font-medium text-foreground hover:text-accent underline underline-offset-2">
              Regenerate public Sample Dossier
            </Link>
          </div>
        </div>
        <div className="bg-surface border border-border rounded-lg shadow-sm p-6 flex flex-col justify-center items-center text-center">
          <Activity className="w-12 h-12 text-muted mb-4 opacity-50" />
          <p className="text-muted text-sm">More detailed system metrics and audit logs are available in the sidebar navigation.</p>
        </div>
      </div>
    </div>
  );
}
