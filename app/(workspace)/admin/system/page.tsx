import React from "react";
import { requireSuperAdmin } from "@/lib/auth/admin-gate";
import { adminDb } from "@/lib/firebase/admin";
import Link from "next/link";
import { ArrowLeft, Server, Activity, Database, Cpu, ShieldCheck } from "lucide-react";

export default async function AdminSystemHealthPage() {
  await requireSuperAdmin();

  // Query database statistics
  const usersCount = (await adminDb.collection("users").count().get()).data().count;
  const casesCount = (await adminDb.collection("cases").count().get()).data().count;
  const reportsCount = (await adminDb.collection("cbam_reports").count().get()).data().count;
  const transactionsCount = (await adminDb.collection("paddle_events").count().get()).data().count;

  // Check config keys
  const configKeys = [
    { name: "PADDLE_API_KEY", status: process.env.PADDLE_API_KEY ? "CONFIGURED" : "MISSING", type: "env" },
    { name: "PADDLE_WEBHOOK_SECRET", status: process.env.PADDLE_WEBHOOK_SECRET ? "CONFIGURED" : "MISSING", type: "env" },
    { name: "NEXT_PUBLIC_PADDLE_PRICE_ID", status: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID || process.env.NEXT_PUBLIC_PADDLE_PRODUCT_ID ? "CONFIGURED" : "MISSING", type: "env" },
    { name: "ADMIN_SERVICE_ACCOUNT_B64", status: process.env.ADMIN_SERVICE_ACCOUNT_B64 ? "CONFIGURED (BASE64)" : "MISSING (ADC ACTIVE)", type: "env" },
  ];

  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-xs font-semibold text-muted hover:text-foreground flex items-center gap-2">
        <ArrowLeft className="w-3 h-3" /> Back to Overview
      </Link>

      <div className="flex justify-between items-end border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-foreground">System Health</h1>
          <p className="text-muted text-sm mt-1">Audit active microservices, environment configurations, and database nodes.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Database Stats Card */}
        <div className="p-6 bg-surface border border-border rounded-lg shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-foreground font-semibold">
            <Database className="w-4 h-4 text-accent" />
            <span>Database Storage Metrics (Firestore)</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-background border border-border rounded">
              <span className="text-xs text-muted font-semibold uppercase tracking-wider block">Users</span>
              <span className="text-2xl font-bold font-mono text-foreground">{usersCount}</span>
            </div>
            <div className="p-4 bg-background border border-border rounded">
              <span className="text-xs text-muted font-semibold uppercase tracking-wider block">Cases</span>
              <span className="text-2xl font-bold font-mono text-foreground">{casesCount}</span>
            </div>
            <div className="p-4 bg-background border border-border rounded">
              <span className="text-xs text-muted font-semibold uppercase tracking-wider block">Sealed Reports</span>
              <span className="text-2xl font-bold font-mono text-foreground">{reportsCount}</span>
            </div>
            <div className="p-4 bg-background border border-border rounded">
              <span className="text-xs text-muted font-semibold uppercase tracking-wider block">Paddle Logs</span>
              <span className="text-2xl font-bold font-mono text-foreground">{transactionsCount}</span>
            </div>
          </div>
        </div>

        {/* Runtime Environment Card */}
        <div className="p-6 bg-surface border border-border rounded-lg shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-foreground font-semibold">
            <Cpu className="w-4 h-4 text-accent" />
            <span>Serverless Infrastructure</span>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted">Cloud Provider</span>
              <span className="font-semibold text-foreground">Google Cloud Platform</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted">Runtime Environment</span>
              <span className="font-semibold text-foreground">Firebase Framework-Aware Hosting</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted">Deployment Region</span>
              <span className="font-semibold text-foreground">europe-west1 (Belgium)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted">Node.js Version</span>
              <span className="font-mono font-semibold text-foreground">v22 (SSR) & v20 (Functions)</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted">System Time</span>
              <span className="font-mono text-xs text-foreground">{new Date().toISOString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Env Vars status */}
      <div className="p-6 bg-surface border border-border rounded-lg shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-foreground font-semibold">
          <Server className="w-4 h-4 text-accent" />
          <span>Core Dependencies Key Status</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2">Variable / Config Name</th>
                <th className="py-2">Type</th>
                <th className="py-2">Lock Status</th>
              </tr>
            </thead>
            <tbody>
              {configKeys.map((key) => (
                <tr key={key.name} className="border-b border-border/50 hover:bg-border/10">
                  <td className="py-3 font-mono text-xs text-foreground">{key.name}</td>
                  <td className="py-3 text-muted">{key.type === "env" ? "Server Env Variable" : "Runtime Key"}</td>
                  <td className="py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                      key.status.includes("CONFIGURED")
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                        : "bg-amber-500/15 text-amber-700"
                    }`}>
                      {key.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
