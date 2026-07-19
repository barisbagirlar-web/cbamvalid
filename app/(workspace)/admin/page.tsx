import Link from "next/link";
import { Activity, Banknote, FileText, ShieldAlert, Users } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth/admin-gate";
import { fetchSystemMetrics } from "./actions";

function usd(amountMinor: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amountMinor / 100);
}

export default async function AdminDashboardPage() {
  const adminClaims = await requireSuperAdmin();
  const metrics = await fetchSystemMetrics();

  const cards = [
    { label: "Total Users", value: String(metrics.totalUsers), icon: Users },
    { label: "Sealed Reports", value: String(metrics.sealedReports), icon: FileText },
    { label: "Collected Revenue", value: usd(metrics.collectedRevenueMinor), icon: Banknote },
    { label: "Active Commerce Holds", value: String(metrics.activeCommerceHolds), icon: ShieldAlert },
  ];

  return (
    <div className="space-y-8">
      <header className="border-b border-border pb-4">
        <h1 className="font-serif text-3xl font-bold text-foreground">Owner Admin Console</h1>
        <p className="mt-1 text-sm text-muted">Authenticated as <span className="font-mono text-accent">{adminClaims.email}</span></p>
      </header>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <article key={label} className="rounded-lg border border-border bg-surface p-6 shadow-sm">
            <div className="mb-2 flex items-center gap-3 text-muted"><Icon className="h-4 w-4" /><h2 className="text-xs font-semibold uppercase tracking-wider">{label}</h2></div>
            <p className="font-mono text-3xl font-bold text-foreground">{value}</p>
          </article>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <article className="rounded-lg border border-border bg-surface p-6 shadow-sm">
          <h2 className="mb-4 font-serif text-xl font-bold">Controlled actions</h2>
          <div className="flex flex-col items-start space-y-3">
            <Link href="/admin/users" className="text-sm font-medium text-accent underline underline-offset-2">Review users, balances and claims</Link>
            <Link href="/admin/credits/grant" className="text-sm font-medium text-foreground underline underline-offset-2 hover:text-accent">Record manual credit grant</Link>
            <Link href="/admin/credits/reverse" className="text-sm font-medium text-foreground underline underline-offset-2 hover:text-accent">Reverse a controlled grant</Link>
            <Link href="/admin/audit" className="text-sm font-medium text-foreground underline underline-offset-2 hover:text-accent">Review immutable admin audit events</Link>
          </div>
        </article>
        <article className="flex flex-col items-center justify-center rounded-lg border border-border bg-surface p-6 text-center shadow-sm">
          <Activity className="mb-4 h-12 w-12 text-muted opacity-50" />
          <p className="text-sm leading-relaxed text-muted">Revenue is calculated from non-refunded fulfilled commerce orders. Refund holds are surfaced separately and never converted into negative user balances.</p>
        </article>
      </section>
    </div>
  );
}
