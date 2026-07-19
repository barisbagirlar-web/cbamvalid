import Link from "next/link";
import { ArrowLeft, Plus, RotateCcw, ShieldAlert, UserX } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth/admin-gate";
import { COMMERCIAL_CONTRACT } from "@/lib/billing/commercial-contract";
import { fetchUserDetails } from "../../actions";

export default async function AdminUserDetailPage({ params }: { params: Promise<{ uid: string }> }) {
  await requireSuperAdmin();
  const { uid } = await params;

  let user: Awaited<ReturnType<typeof fetchUserDetails>> | null = null;
  try {
    user = await fetchUserDetails(uid);
  } catch {
    user = null;
  }

  if (!user) {
    return (
      <div className="max-w-4xl space-y-6">
        <Link href="/admin/users" className="flex items-center gap-2 text-xs font-semibold text-muted hover:text-foreground"><ArrowLeft className="h-3 w-3" /> Back to Users</Link>
        <div className="space-y-3 rounded-lg border border-border bg-surface p-8 text-center shadow-sm"><UserX className="mx-auto h-8 w-8 text-muted" /><h1 className="font-serif text-lg font-bold">User not found</h1><p className="text-sm text-muted">No Firebase Auth account exists for UID <span className="font-mono">{uid}</span>.</p></div>
      </div>
    );
  }

  const packUnlocks = Math.floor(user.credits.availableCredits / COMMERCIAL_CONTRACT.creditsRequiredToUnlock);
  const hold = user.commerceHold && typeof user.commerceHold === "object"
    ? user.commerceHold as Record<string, unknown>
    : {};

  return (
    <div className="max-w-4xl space-y-6">
      <Link href="/admin/users" className="flex items-center gap-2 text-xs font-semibold text-muted hover:text-foreground"><ArrowLeft className="h-3 w-3" /> Back to Users</Link>

      <header className="flex flex-col justify-between gap-4 border-b border-border pb-4 sm:flex-row sm:items-end">
        <div><h1 className="font-serif text-2xl font-bold">User Details</h1><p className="mt-1 text-sm text-muted">{user.auth.email}</p></div>
        <div className="flex gap-2">
          <Link href={`/admin/credits/grant?uid=${encodeURIComponent(uid)}`} className="inline-flex items-center gap-2 rounded bg-accent px-3 py-1.5 text-sm font-medium text-surface hover:bg-accent-hover"><Plus className="h-4 w-4" /> Grant Credits</Link>
          <Link href={`/admin/credits/reverse?uid=${encodeURIComponent(uid)}`} className="inline-flex items-center gap-2 rounded border border-border bg-surface px-3 py-1.5 text-sm font-medium hover:bg-border/30"><RotateCcw className="h-4 w-4" /> Reverse Grant</Link>
        </div>
      </header>

      {hold.active === true && <div role="alert" className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" /><span>Commerce hold active. Reason: {String(hold.reason || "UNSPECIFIED")}. Deficit: {String(hold.deficitCredits || 0)} credits.</span></div>}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="rounded-lg border border-border bg-surface p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">Authentication</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-muted">UID</dt><dd className="break-all font-mono text-right">{user.auth.uid}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">Email verified</dt><dd>{user.auth.emailVerified ? "Yes" : "No"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">Disabled</dt><dd>{user.auth.disabled ? "Yes" : "No"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">Created</dt><dd className="text-right">{user.auth.creationTime}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">Last sign-in</dt><dd className="text-right">{user.auth.lastSignInTime || "—"}</dd></div>
            <div className="flex items-center justify-between gap-4"><dt className="text-muted">Claims</dt><dd className="flex max-w-[220px] flex-wrap justify-end gap-1">{Object.keys(user.auth.customClaims).length ? Object.keys(user.auth.customClaims).map((key) => <span key={key} className="rounded bg-border px-1.5 py-0.5 font-mono text-xs">{key}</span>) : <span className="italic text-muted">None</span>}</dd></div>
          </dl>
        </section>

        <section className="rounded-lg border border-border bg-surface p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">Commercial capacity</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Available credits</dt><dd className="font-mono text-2xl font-bold text-accent">{user.credits.availableCredits}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Pack unlocks available</dt><dd className="font-mono">{packUnlocks}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Lifetime purchased</dt><dd className="font-mono">{user.credits.lifetimePurchased}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Lifetime consumed</dt><dd className="font-mono">{user.credits.lifetimeConsumed}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Lifetime adjusted</dt><dd className="font-mono">{user.credits.lifetimeAdjusted}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Entitlement records</dt><dd className="font-mono">{user.entitlementCount}</dd></div>
          </dl>
        </section>
      </div>
    </div>
  );
}
