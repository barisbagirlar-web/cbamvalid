"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, CreditCard, FileText, Users } from "lucide-react";

const adminNav = [
  { label: "Overview", href: "/admin", icon: Activity },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Credit adjustments", href: "/admin/credits", icon: CreditCard },
  { label: "Sample dossier", href: "/admin/sample-dossier", icon: FileText },
] as const;

function isActiveAdminPath(pathname: string, href: string): boolean {
  return href === "/admin"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

function NavigationLinks({ pathname, mobile = false }: { pathname: string; mobile?: boolean }) {
  return (
    <ul className={mobile ? "grid gap-1 p-2" : "space-y-1 px-3"}>
      {adminNav.map((item) => {
        const active = isActiveAdminPath(pathname, item.href);
        const Icon = item.icon;

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                active
                  ? "bg-accent/10 text-accent"
                  : "text-foreground hover:bg-border/30"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function AdminNavigation() {
  const pathname = usePathname();
  const currentLabel = adminNav.find((item) => isActiveAdminPath(pathname, item.href))?.label
    ?? "Admin navigation";

  return (
    <>
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface/50 md:flex">
        <div className="flex h-[76px] items-center border-b border-border px-6">
          <span className="font-serif text-[19px] font-bold tracking-tight">Admin Console</span>
        </div>
        <nav aria-label="Admin navigation" className="flex-1 overflow-y-auto py-4">
          <NavigationLinks pathname={pathname} />
        </nav>
      </aside>

      <details className="group border-b border-border bg-surface md:hidden">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-sm font-semibold">
          <span>{currentLabel}</span>
          <span aria-hidden="true" className="text-muted group-open:rotate-180">⌄</span>
        </summary>
        <nav aria-label="Admin navigation">
          <NavigationLinks pathname={pathname} mobile />
        </nav>
      </details>
    </>
  );
}
