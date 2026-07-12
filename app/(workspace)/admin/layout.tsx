import React from "react";
import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth/admin-gate";
import { 
  Users, 
  CreditCard, 
  Receipt, 
  FileBox, 
  FileText, 
  Key, 
  Globe,
  Settings,
  Activity,
  ShieldAlert,
  Server,
  TerminalSquare
} from "lucide-react";

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

  // Navigation structure for the universal shell
  const adminNav = [
    { label: "Overview", href: "/admin", icon: <Activity className="w-4 h-4" /> },
    { label: "Users", href: "/admin/users", icon: <Users className="w-4 h-4" /> },
    { label: "Credits", href: "/admin/credits", icon: <CreditCard className="w-4 h-4" /> },
    { label: "Billing & Purchases", href: "/admin/billing", icon: <Receipt className="w-4 h-4" /> },
    { label: "Cases", href: "/admin/cases", icon: <FileBox className="w-4 h-4" /> },
    { label: "Reports", href: "/admin/reports", icon: <FileText className="w-4 h-4" /> },
    { label: "Entitlements", href: "/admin/entitlements", icon: <Key className="w-4 h-4" /> },
    { label: "Webhooks", href: "/admin/webhooks", icon: <Globe className="w-4 h-4" /> },
    { label: "System Health", href: "/admin/system", icon: <Server className="w-4 h-4" /> },
    { label: "Audit Log", href: "/admin/audit", icon: <TerminalSquare className="w-4 h-4" /> },
    { label: "Security", href: "/admin/security", icon: <ShieldAlert className="w-4 h-4" /> },
    { label: "Settings", href: "/admin/settings", icon: <Settings className="w-4 h-4" /> }
  ];

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Left Sidebar */}
      <aside className="w-64 border-r border-border bg-surface/50 hidden md:flex flex-col">
        <div className="h-[76px] flex items-center px-6 border-b border-border">
          <span className="font-serif font-bold tracking-tight text-[19px]">Admin Console</span>
        </div>
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {adminNav.map((item) => (
              <li key={item.href}>
                <Link 
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-foreground rounded-md hover:bg-border/30 transition-colors"
                >
                  {item.icon}
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen max-w-full overflow-hidden">
        {/* Admin Top Bar */}
        <header className="h-[76px] border-b border-border bg-surface flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-accent"></div>
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">Production</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-muted">{adminClaims.email}</span>
            <div className="h-6 w-px bg-border"></div>
            <Link 
              href="/dashboard"
              className="text-sm font-medium text-accent hover:text-accent-hover transition-colors"
            >
              Customer Workspace
            </Link>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-auto bg-surface/30 p-6 md:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
