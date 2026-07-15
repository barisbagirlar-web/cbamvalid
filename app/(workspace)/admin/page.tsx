import React from "react";
import { requireSuperAdmin } from "@/lib/auth/admin-gate";
import { fetchSystemMetrics } from "./actions";
import Link from "next/link";
import { Activity, Users, FileText, Banknote, ShoppingBag } from "lucide-react";

export default async function AdminDashboardPage() {
  const adminClaims = await requireSuperAdmin();
  const metrics = await fetchSystemMetrics();

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between border-b border-border pb-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Owner Super Admin Console</h1>
          <p className="mt-1 text-sm text-muted">Authenticated as <span className="font-mono text-accent">{adminClaims.email}</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5">
        <Metric icon={Users} label="Total Users" value={String(metrics.totalUsers)} />
        <Metric icon={FileText} label="Sealed Reports" value={String(metrics.sealedReports)} />
        <Metric icon={ShoppingBag} label="Paid Packs" value={String(metrics.paidOrders)} />
        <Metric icon={Banknote} label="Gross Paid Revenue" value={`$${metrics.grossRevenueUsd.toFixed(2)}`} accent />
        <div className="flex flex-col justify-center rounded-lg border border-border bg-surface p-6 shadow-sm">
          <Link href="/admin/users" className="text-center text-sm font-medium text-accent underline underline-offset-2">Manage Users & Credits →</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
          <h2 className="mb-4 font-serif text-xl font-bold">Controlled Actions</h2>
          <div className="flex flex-col items-start space-y-3">
            <Link href="/admin/credits/grant" className="text-sm font-medium underline underline-offset-2 hover:text-accent">Grant idempotent account credits</Link>
            <Link href="/admin/credits/reverse" className="text-sm font-medium underline underline-offset-2 hover:text-accent">Reverse one complete admin grant</Link>
            <Link href="/admin/sample-dossier" className="text-sm font-medium underline underline-offset-2 hover:text-accent">Regenerate public Sample Dossier</Link>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-surface p-6 text-center shadow-sm">
          <Activity className="mb-4 h-12 w-12 text-muted opacity-50" />
          <p className="text-sm text-muted">Revenue is calculated from paid non-refunded commerce orders. Sealed report count is not used as a revenue proxy.</p>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, accent = false }: { icon: typeof Users; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-6 shadow-sm ${accent ? "border-accent/20 bg-accent/5" : "border-border bg-surface"}`}>
      <div className={`mb-2 flex items-center gap-3 ${accent ? "text-accent" : "text-muted"}`}><Icon className="h-4 w-4" /><h3 className="text-xs font-semibold uppercase tracking-wider">{label}</h3></div>
      <p className={`font-mono text-3xl font-bold ${accent ? "text-accent" : "text-foreground"}`}>{value}</p>
    </div>
  );
}
