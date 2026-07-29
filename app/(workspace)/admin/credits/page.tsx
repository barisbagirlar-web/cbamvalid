import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth/admin-gate";

const creditActions = [
  {
    href: "/admin/credits/grant",
    title: "Grant account credits",
    description: "Add a documented manual adjustment to a user's credit ledger.",
    icon: ArrowUpRight,
  },
  {
    href: "/admin/credits/reverse",
    title: "Reverse a credit grant",
    description: "Correct an existing grant while preserving its audit trail.",
    icon: ArrowDownLeft,
  },
] as const;

export default async function AdminCreditsPage() {
  await requireSuperAdmin();

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="font-serif text-2xl font-bold text-foreground">Credit adjustments</h1>
        <p className="mt-1 text-sm text-muted">
          Choose the adjustment you need to make. Every change requires a reason and is audited.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {creditActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="rounded-lg border border-border bg-surface p-5 shadow-sm transition-colors hover:border-accent/50 hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Icon className="mb-4 h-5 w-5 text-accent" aria-hidden="true" />
              <h2 className="font-semibold text-foreground">{action.title}</h2>
              <p className="mt-2 text-sm text-muted">{action.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
