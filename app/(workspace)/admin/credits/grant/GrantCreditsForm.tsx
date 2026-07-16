"use client";

import React, { useRef, useState } from "react";
import { grantCredits } from "../../actions";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle } from "lucide-react";

function message(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Failed to grant credits.";
}

export default function GrantCreditsForm({ initialUid }: { initialUid: string }) {
  const [uid, setUid] = useState(initialUid);
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(crypto.randomUUID());
  const router = useRouter();

  const handleGrant = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await grantCredits(uid, amount, reason, requestId.current);
      setSuccess(`Granted ${amount} credits. Balance: ${result.balanceAfter}. Entry: ${result.transactionId}`);
      requestId.current = crypto.randomUUID();
      router.refresh();
    } catch (grantError: unknown) {
      setError(message(grantError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleGrant} className="space-y-4">
      {error && <div role="alert" className="flex items-center gap-2 rounded border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600"><AlertTriangle className="h-4 w-4" />{error}</div>}
      {success && <div role="status" className="flex items-center gap-2 rounded border border-accent/20 bg-accent/10 p-3 text-sm text-accent"><CheckCircle2 className="h-4 w-4" />{success}</div>}
      <div><label className="mb-1 block text-sm font-medium text-muted">Target User ID</label><input type="text" value={uid} onChange={(event) => setUid(event.target.value)} required className="w-full rounded border border-border bg-background px-3 py-2 font-mono text-sm" /></div>
      <div><label className="mb-1 block text-sm font-medium text-muted">Credit Amount</label><input type="number" min="1" max="10000" value={amount || ""} onChange={(event) => setAmount(Number.parseInt(event.target.value, 10) || 0)} required className="w-full rounded border border-border bg-background px-3 py-2 font-mono text-sm" /></div>
      <div><label className="mb-1 block text-sm font-medium text-muted">Reason</label><textarea value={reason} onChange={(event) => setReason(event.target.value)} required minLength={10} maxLength={500} className="min-h-[100px] w-full rounded border border-border bg-background px-3 py-2 text-sm" /></div>
      <button type="submit" disabled={loading || amount <= 0 || reason.trim().length < 10} className="w-full rounded bg-accent py-2 font-medium text-surface disabled:opacity-50">{loading ? "Processing…" : "Grant Credits"}</button>
    </form>
  );
}
