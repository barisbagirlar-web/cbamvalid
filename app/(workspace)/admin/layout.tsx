import React from "react";
import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth/admin-gate";
import { AdminNavigation } from "./AdminNavigation";

export const metadata = {
  title: "Admin Console | CBAMValid",
  robots: {
    index: false,
    follow: false,
  }
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // 1. Server-side authorization gate
  const adminClaims = await requireSuperAdmin();

  return (
    <div className="flex min-h-screen flex-col bg-surface md:flex-row">
      <AdminNavigation />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen max-w-full overflow-hidden">
        {/* Admin Top Bar */}
        <header className="min-h-[64px] border-b border-border bg-surface flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:min-h-[76px] md:px-6 shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-accent"></div>
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">Production</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden max-w-52 truncate text-sm font-medium text-muted sm:inline">{adminClaims.email}</span>
            <div className="hidden h-6 w-px bg-border sm:block"></div>
            <Link 
              href="/cbam"
              className="text-sm font-medium text-accent hover:text-accent-hover transition-colors"
            >
              Customer Workspace
            </Link>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-auto bg-surface/30 p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
