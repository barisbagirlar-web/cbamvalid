import React from "react";
import { requireSuperAdmin } from "@/lib/auth/admin-gate";
import { fetchSystemMetrics } from "./actions";
import Link from "next/link";
import { ArrowRight, CreditCard, FileText, Users } from "lucide-react";

export default async function AdminDashboardPage() {
  const adminClaims = await requireSuperAdmin();
  
  const metrics = await fetchSystemMetrics();

  return (
    <div className="space-y-8">
      <div className="border-b border-border pb-4">
        <div>
          <h1 className="text-3xl font-bold font-serif text-foreground">What do you need to do?</h1>
          <p className="text-muted text-sm mt-1">
            Signed in as <span className="font-medium text-foreground">{adminClaims.email}</span>
          </p>
        </div>
      </div>

      <section aria-labelledby="admin-actions-heading">
        <h2 id="admin-actions-heading" className="mb-4 font-serif text-xl font-bold">Common tasks</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            { href: "/admin/users", title: "Find a user", detail: "Review account details and current credits.", icon: Users },
            { href: "/admin/credits", title: "Adjust credits", detail: "Grant credits or reverse an incorrect grant.", icon: CreditCard },
            { href: "/admin/sample-dossier", title: "Update sample dossier", detail: "Run the canonical public sample generation pipeline.", icon: FileText },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.href} href={action.href} className="group rounded-lg border border-border bg-surface p-5 shadow-sm transition-colors hover:border-accent/50 hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                <Icon className="mb-4 h-5 w-5 text-accent" aria-hidden="true" />
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-foreground">{action.title}</h3>
                  <ArrowRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </div>
                <p className="mt-2 text-sm text-muted">{action.detail}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="system-summary-heading">
        <h2 id="system-summary-heading" className="mb-4 font-serif text-xl font-bold">System summary</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
            <p className="text-sm font-medium text-muted">Total users</p>
            <p className="mt-2 font-mono text-3xl font-bold text-foreground">{metrics.totalUsers}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
            <p className="text-sm font-medium text-muted">Sealed reports</p>
            <p className="mt-2 font-mono text-3xl font-bold text-foreground">{metrics.sealedReports}</p>
          </div>
        </div>
      </section>
      </div>
  );
}
