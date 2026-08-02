import React from "react";
import { requireSuperAdmin } from "@/lib/auth/admin-gate";
import { fetchSystemHealth } from "../actions";
import { Database, FileText, Users, Key, Globe, ShieldCheck, Lock } from "lucide-react";

export default async function AdminSystemHealthPage() {
  await requireSuperAdmin();
  const health = await fetchSystemHealth();

  const cards = [
    { label: "Registered Users", value: health.users, icon: <Users className="w-4 h-4" /> },
    { label: "Working Files (Cases)", value: health.cases, icon: <Database className="w-4 h-4" /> },
    { label: "Reports", value: health.reports, icon: <FileText className="w-4 h-4" /> },
    { label: "Sealed Reports", value: health.sealedReports, icon: <ShieldCheck className="w-4 h-4" /> },
    { label: "Entitlements", value: health.entitlements, icon: <Key className="w-4 h-4" /> },
    { label: "Paddle Webhook Events", value: health.webhookEvents, icon: <Globe className="w-4 h-4" /> },
    { label: "Admin Identities", value: health.adminIdentities, icon: <Lock className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-foreground">System Health</h1>
          <p className="text-muted text-sm mt-1">
            Live collection counts and platform configuration.
          </p>
        </div>
        <div className="text-xs font-mono text-muted">config version: {health.version}</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="p-5 bg-surface border border-border rounded-lg shadow-sm">
            <div className="flex items-center gap-3 mb-2 text-muted">
              {card.icon}
              <h3 className="text-xs font-semibold uppercase tracking-wider">{card.label}</h3>
            </div>
            <p className="text-3xl font-bold font-mono text-foreground">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="p-5 bg-surface border border-border rounded-lg shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3">Launch Configuration</h2>
        <div className="flex items-center gap-3">
          <span
            className={`w-2.5 h-2.5 rounded-full ${health.publicPaidLaunchEnabled ? "bg-accent" : "bg-amber-500"}`}
          />
          <span className="text-sm text-foreground">
            Public paid launch: <span className="font-semibold">{health.publicPaidLaunchEnabled ? "ENABLED" : "DISABLED (maintenance gate)"}</span>
          </span>
        </div>
        <p className="text-xs text-muted mt-2">
          When disabled, only privileged test identities can reach Paddle checkout.
        </p>
      </div>
    </div>
  );
}
