import React from "react";
import { requireSuperAdmin } from "@/lib/auth/admin-gate";
import ReverseCreditsForm from "./ReverseCreditsForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function AdminReverseCreditsPage({ searchParams }: { searchParams: Promise<{ uid?: string }> }) {
  await requireSuperAdmin();
  const { uid } = await searchParams;

  return (
    <div className="space-y-6 max-w-xl">
      <Link href="/admin/users" className="text-xs font-semibold text-muted hover:text-foreground flex items-center gap-2">
        <ArrowLeft className="w-3 h-3" /> Back to Users
      </Link>
      
      <div className="flex justify-between items-end border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-foreground">Reverse Admin Grant</h1>
          <p className="text-muted text-sm mt-1">Safely rollback an incorrect credit grant in the ledger.</p>
        </div>
      </div>

      <div className="p-6 bg-surface border border-red-500/20 rounded-lg shadow-sm">
        <ReverseCreditsForm initialUid={uid || ""} />
      </div>
    </div>
  );
}
