import React from "react";
import { requireSuperAdmin } from "@/lib/auth/admin-gate";

export default async function ReportsPage() {
  await requireSuperAdmin();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold font-serif text-foreground">Reports Management</h1>
      <div className="p-6 bg-surface border border-border rounded-lg shadow-sm">
        <p className="text-muted">This module is part of the Universal Admin Panel.</p>
      </div>
    </div>
  );
}
