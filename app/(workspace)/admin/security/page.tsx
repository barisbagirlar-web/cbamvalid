import React from "react";
import { requireSuperAdmin } from "@/lib/auth/admin-gate";
import { fetchSecurityOverview } from "../actions";
import { ShieldCheck, Lock, Mail } from "lucide-react";

export default async function AdminSecurityPage() {
  await requireSuperAdmin();
  const overview = await fetchSecurityOverview();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-foreground">Security Management</h1>
          <p className="text-muted text-sm mt-1">
            Privileged identities and platform security configuration.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 bg-surface border border-border rounded-lg shadow-sm">
          <div className="flex items-center gap-3 mb-2 text-muted">
            <Mail className="w-4 h-4" />
            <h3 className="text-xs font-semibold uppercase tracking-wider">Email Verification</h3>
          </div>
          <p className="text-xl font-bold font-mono text-foreground">
            {overview.requireEmailVerification ? "REQUIRED" : "NOT REQUIRED"}
          </p>
          <p className="text-xs text-muted mt-2">
            Admin console access requires verified email plus super_admin owner claims.
          </p>
        </div>

        <div className="p-6 bg-surface border border-border rounded-lg shadow-sm">
          <div className="flex items-center gap-3 mb-2 text-muted">
            <Lock className="w-4 h-4" />
            <h3 className="text-xs font-semibold uppercase tracking-wider">Public Paid Launch</h3>
          </div>
          <p className="text-xl font-bold font-mono text-foreground">
            {overview.publicPaidLaunchEnabled ? "ENABLED" : "DISABLED"}
          </p>
          <p className="text-xs text-muted mt-2">
            When disabled, only privileged test identities can reach Paddle checkout.
          </p>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Admin Identities</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-foreground">
            <thead className="bg-surface border-b border-border font-medium">
              <tr>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Owner</th>
                <th className="py-3 px-4">UID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {overview.adminIdentities.map((identity) => (
                <tr key={identity.uid} className="hover:bg-border/30 transition-colors align-top">
                  <td className="py-3 px-4 font-medium text-foreground">{identity.email}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-accent/10 text-accent border border-accent/20">
                      {identity.role}
                    </span>
                  </td>
                  <td className="py-3 px-4">{identity.owner ? "Yes" : "No"}</td>
                  <td className="py-3 px-4 font-mono text-xs text-muted break-all">{identity.uid}</td>
                </tr>
              ))}
              {overview.adminIdentities.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted">No admin identities found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
