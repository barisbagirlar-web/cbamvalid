import React from "react";
import { requireSuperAdmin } from "@/lib/auth/admin-gate";
import { fetchUserDetails } from "../../actions";
import Link from "next/link";
import { ArrowLeft, Key, Plus, RotateCcw, UserX } from "lucide-react";

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
      <div className="space-y-6 max-w-4xl">
        <Link href="/admin/users" className="text-xs font-semibold text-muted hover:text-foreground flex items-center gap-2">
          <ArrowLeft className="w-3 h-3" /> Back to Users
        </Link>
        <div className="p-8 bg-surface border border-border rounded-lg shadow-sm text-center space-y-3">
          <UserX className="w-8 h-8 text-muted mx-auto" />
          <h1 className="text-lg font-bold font-serif text-foreground">User not found</h1>
          <p className="text-muted text-sm">
            No Firebase Auth account exists for UID <span className="font-mono">{uid}</span>. It may have been deleted, or the link is stale.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Link href="/admin/users" className="text-xs font-semibold text-muted hover:text-foreground flex items-center gap-2">
        <ArrowLeft className="w-3 h-3" /> Back to Users
      </Link>

      <div className="flex justify-between items-end border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-foreground">User Details</h1>
          <p className="text-muted text-sm mt-1">{user.auth.email}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/credits/grant?uid=${uid}`} className="inline-flex items-center gap-2 px-3 py-1.5 bg-accent text-surface text-sm font-medium rounded hover:bg-accent-hover transition-colors">
            <Plus className="w-4 h-4" /> Grant Credits
          </Link>
          <Link href={`/admin/credits/reverse?uid=${uid}`} className="inline-flex items-center gap-2 px-3 py-1.5 bg-surface text-foreground border border-border text-sm font-medium rounded hover:bg-border/30 transition-colors">
            <RotateCcw className="w-4 h-4" /> Reverse Grant
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 bg-surface border border-border rounded-lg shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-4">Authentication Data</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">UID</span>
              <span className="font-mono text-foreground">{user.auth.uid}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Created At</span>
              <span className="text-foreground">{user.auth.creationTime}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Last Sign In</span>
              <span className="text-foreground">{user.auth.lastSignInTime}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted">Custom Claims</span>
              <div className="text-right flex flex-wrap gap-1 justify-end max-w-[200px]">
                {Object.keys(user.auth.customClaims).length > 0 ? (
                  Object.keys(user.auth.customClaims).map(k => (
                    <span key={k} className="px-1.5 py-0.5 bg-border text-xs rounded font-mono">{k}</span>
                  ))
                ) : (
                  <span className="text-muted italic">None</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-surface border border-border rounded-lg shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-4">Credit Ledger</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Available Credits</span>
              <span className="font-mono text-2xl font-bold text-accent">{user.credits}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Available Reports (Uses)</span>
              <span className="font-mono text-foreground">{Math.floor(user.credits / 20)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
