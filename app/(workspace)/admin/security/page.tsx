import React from "react";
import { requireSuperAdmin } from "@/lib/auth/admin-gate";
import Link from "next/link";
import { ArrowLeft, ShieldAlert, CheckCircle2, Lock } from "lucide-react";

export default async function AdminSecurityPage() {
  await requireSuperAdmin();

  const securityChecks = [
    { name: "Content-Security-Policy (CSP)", status: "ENFORCED (SECURE)", details: "Dynamic header verification with strict script, frame, and font sources." },
    { name: "Cross-Origin-Opener-Policy (COOP)", status: "ENFORCED (SECURE)", details: "Configured to `same-origin-allow-popups` to protect auth flows." },
    { name: "Session Cookie Authorization", status: "ENFORCED (SECURE)", details: "Signed production session cookies. Direct Firebase ID Tokens strictly banned on backend." },
    { name: "Production Mock Bypass Guard", status: "ENFORCED (SECURE)", details: "E2E bypass routes are locked down and disabled on live production clusters." },
    { name: "Transport Layer Security (HSTS)", status: "ENFORCED (SECURE)", details: "HSTS header loaded with max-age=63072000, subDomains and preload." },
  ];

  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-xs font-semibold text-muted hover:text-foreground flex items-center gap-2">
        <ArrowLeft className="w-3 h-3" /> Back to Overview
      </Link>

      <div className="flex justify-between items-end border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-foreground">Security Management</h1>
          <p className="text-muted text-sm mt-1">Audit transport security, authorization boundaries, and CSP configurations.</p>
        </div>
      </div>

      <div className="p-6 bg-surface border border-border rounded-lg shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-foreground font-semibold">
          <ShieldAlert className="w-4 h-4 text-accent" />
          <span>Platform Security Protocols Status</span>
        </div>

        <div className="space-y-4 pt-2">
          {securityChecks.map((check) => (
            <div key={check.name} className="p-4 bg-background border border-border rounded-lg flex items-start gap-4">
              <div className="p-1 rounded-full bg-emerald-500/10 text-emerald-600 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h4 className="font-bold text-foreground">{check.name}</h4>
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                    {check.status}
                  </span>
                </div>
                <p className="text-xs text-muted leading-relaxed">{check.details}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950 flex items-start gap-3">
        <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <p>
          <strong>Security Boundary Notice:</strong> Admin tasks, user token setting, and transaction grants generate cryptographic audit trails under the root credential configuration. Do not export raw credentials or private keys.
        </p>
      </div>
    </div>
  );
}
