import React from "react";
import { requireSuperAdmin } from "@/lib/auth/admin-gate";
import Link from "next/link";
import { ArrowRight, Plus, RotateCcw, Info } from "lucide-react";

export default async function AdminCreditsPage() {
  await requireSuperAdmin();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-foreground">Credits Management</h1>
          <p className="text-muted text-sm mt-1">
            Admin-issued ledger credits for support, compensation, or testing. Customer purchases are
            handled by the Paddle pay-at-lock flow, not by manual grants.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href="/admin/credits/grant"
          className="group p-6 bg-surface border border-border rounded-lg shadow-sm hover:border-accent/40 hover:bg-accent/5 transition-colors"
        >
          <div className="flex items-center gap-3 mb-2 text-accent">
            <Plus className="w-5 h-5" />
            <h2 className="font-serif text-lg font-bold text-foreground">Grant Manual Credits</h2>
          </div>
          <p className="text-sm text-muted">
            Issue synthetic ledger credits to a user for support or testing.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent group-hover:gap-2 transition-all">
            Open grant form <ArrowRight className="w-4 h-4" />
          </span>
        </Link>

        <Link
          href="/admin/credits/reverse"
          className="group p-6 bg-surface border border-border rounded-lg shadow-sm hover:border-status-blocked/40 hover:bg-status-blocked/5 transition-colors"
        >
          <div className="flex items-center gap-3 mb-2 text-status-blocked">
            <RotateCcw className="w-5 h-5" />
            <h2 className="font-serif text-lg font-bold text-foreground">Reverse a Grant</h2>
          </div>
          <p className="text-sm text-muted">
            Safely roll back an incorrect credit grant in the ledger.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-status-blocked group-hover:gap-2 transition-all">
            Open reversal form <ArrowRight className="w-4 h-4" />
          </span>
        </Link>
      </div>

      <div className="p-4 bg-surface border border-border rounded-lg shadow-sm text-sm text-muted flex items-start gap-3">
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-accent" />
        <p>
          Manual grants are the legacy internal ledger used by admins and grandfather paths only.
          Regular customers never see or need a separate “activate pack” step — their Single Pack is
          unlocked directly by the Paddle checkout webhook.
        </p>
      </div>
    </div>
  );
}
