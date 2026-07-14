import React from "react";
import { requireSuperAdmin } from "@/lib/auth/admin-gate";
import Link from "next/link";
import { ArrowLeft, Settings, ShieldCheck, Mail } from "lucide-react";

export default async function AdminSettingsPage() {
  await requireSuperAdmin();

  const settings = [
    { category: "Merchant & Payment", items: [["Gateway provider", "Paddle Sandbox"], ["Product Catalog Code", "CBAM_CREDIT_PACK_5"], ["Billing Currency", "USD (United States Dollar)"]] },
    { category: "CBAM Ruleset Configuration", items: [["Active Ruleset Version", "CBAMVALID-VGRS-1.0"], ["Regulatory Scope", "Regulation (EU) 2023/956, Annex IV/VI"], ["Traceability Contract", "Deterministic 27-Component Sealed Package"]] },
    { category: "Metadata & Support", items: [["Official Support Email", "support@cbamvalid.com"], ["Production Hostname", "cbamvalid.com"], ["Robots & Indexing", "Follow Sitemap (Disallowed on Admin route)"]] },
  ];

  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-xs font-semibold text-muted hover:text-foreground flex items-center gap-2">
        <ArrowLeft className="w-3 h-3" /> Back to Overview
      </Link>

      <div className="flex justify-between items-end border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-foreground">Settings Management</h1>
          <p className="text-muted text-sm mt-1">Platform general configurations, ruleset defaults, and support metadata.</p>
        </div>
      </div>

      <div className="p-6 bg-surface border border-border rounded-lg shadow-sm space-y-6">
        <div className="flex items-center gap-2 text-foreground font-semibold">
          <Settings className="w-4 h-4 text-accent" />
          <span>General Platform Settings Metadata</span>
        </div>

        <div className="space-y-6">
          {settings.map((group) => (
            <div key={group.category} className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted border-b border-border pb-1">
                {group.category}
              </h3>
              <div className="space-y-2 text-sm">
                {group.items.map(([label, value]) => (
                  <div key={label} className="flex justify-between py-1 border-b border-border/30 last:border-0">
                    <span className="text-muted">{label}</span>
                    <span className="font-semibold text-foreground">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-relaxed text-blue-950 flex items-start gap-3">
        <Mail className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
        <p>
          <strong>Platform Communications:</strong> Transactions and account receipts send notifications via the configured transactional emailing routing. Support remains routed to `support@cbamvalid.com`.
        </p>
      </div>
    </div>
  );
}
