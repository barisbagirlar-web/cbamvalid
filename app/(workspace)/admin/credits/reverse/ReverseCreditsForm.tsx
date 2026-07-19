"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { reverseCreditGrant } from "../../actions";

function message(error: unknown): string {
  return error instanceof Error && error.message.trim() ? error.message : "Failed to reverse credits.";
}

export default function ReverseCreditsForm({ initialUid }: { initialUid: string }) {
  const requestId = useRef(crypto.randomUUID());
  const [uid, setUid] = useState(initialUid);
  const [amount, setAmount] = useState(0);
  const [originalTransactionId, setOriginalTransactionId] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleReverse = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await reverseCreditGrant(
        uid,
        amount,
        originalTransactionId,
        reason,
        requestId.current
      );
      setSuccess(`${result.idempotentReplay ? "Existing" : "New"} reversal recorded. Ledger ID: ${result.reversalId}. Balance: ${result.balanceAfter}.`);
      requestId.current = crypto.randomUUID();
      router.refresh();
    } catch (reversalError: unknown) {
      setError(message(reversalError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleReverse} className="space-y-4">
      {error && <div role="alert" className="flex items-center gap-2 rounded border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700"><AlertTriangle className="h-4 w-4" /> {error}</div>}
      {success && <div role="status" className="flex items-center gap-2 rounded border border-accent/20 bg-accent/10 p-3 text-sm text-accent"><CheckCircle2 className="h-4 w-4" /> {success}</div>}
      <div><label htmlFor="reverse-uid" className="mb-1 block text-sm font-medium text-muted">Target User ID</label><input id="reverse-uid" type="text" value={uid} onChange={(event) => setUid(event.target.value)} required maxLength={256} className="w-full rounded border border-border bg-background px-3 py-2 font-mono text-sm" /></div>
      <div><label htmlFor="original-transaction" className="mb-1 block text-sm font-medium text-muted">Original grant ledger ID</label><input id="original-transaction" type="text" value={originalTransactionId} onChange={(event) => setOriginalTransactionId(event.target.value)} required pattern="admin_grant_[0-9a-fA-F-]{36}" placeholder="admin_grant_00000000-0000-0000-0000-000000000000" className="w-full rounded border border-border bg-background px-3 py-2 font-mono text-sm" /></div>
      <div><label htmlFor="reverse-amount" className="mb-1 block text-sm font-medium text-muted">Credit amount to reverse</label><input id="reverse-amount" type="number" min="1" max="1000000" step="1" value={amount || ""} onChange={(event) => setAmount(Number.parseInt(event.target.value, 10) || 0)} required className="w-full rounded border border-border bg-background px-3 py-2 font-mono text-sm" /></div>
      <div><label htmlFor="reverse-reason" className="mb-1 block text-sm font-medium text-muted">Auditable reversal reason</label><textarea id="reverse-reason" value={reason} onChange={(event) => setReason(event.target.value)} required minLength={10} maxLength={500} placeholder="State why the original controlled grant must be partially or fully reversed." className="min-h-28 w-full rounded border border-border bg-background px-3 py-2 text-sm" /></div>
      <button type="submit" disabled={loading || !uid.trim() || amount <= 0 || reason.trim().length < 10 || !originalTransactionId} className="w-full rounded bg-red-700 py-2 font-medium text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Recording…" : "Record Credit Reversal"}</button>
    </form>
  );
}
