"use client";

import React, { useState } from "react";
import { reverseCreditGrant } from "../../actions";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle } from "lucide-react";

export default function ReverseCreditsForm({ initialUid }: { initialUid: string }) {
  const [uid, setUid] = useState(initialUid);
  const [amount, setAmount] = useState<number>(0);
  const [originalTransactionId, setOriginalTransactionId] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleReverse = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await reverseCreditGrant(uid, amount, originalTransactionId, reason);
      if (res.success) {
        setSuccess(`Successfully reversed ${amount} credits. Reversal ID: ${res.reversalId}`);
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || "Failed to reverse credits.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleReverse} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm rounded flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-accent/10 border border-accent/20 text-accent text-sm rounded flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {success}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-muted mb-1">Target User ID (UID)</label>
        <input 
          type="text"
          value={uid}
          onChange={(e) => setUid(e.target.value)}
          required
          className="w-full px-3 py-2 bg-background border border-border rounded text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-muted mb-1">Original Transaction ID</label>
        <input 
          type="text"
          value={originalTransactionId}
          onChange={(e) => setOriginalTransactionId(e.target.value)}
          required
          placeholder="e.g. admin_grant_17154212..."
          className="w-full px-3 py-2 bg-background border border-border rounded text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-muted mb-1">Credit Amount to Deduct</label>
        <input 
          type="number"
          min="1"
          value={amount || ""}
          onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
          required
          className="w-full px-3 py-2 bg-background border border-border rounded text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-muted mb-1">Reason for Reversal</label>
        <textarea 
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          minLength={5}
          placeholder="e.g. Fraudulent transaction, incorrect grant amount"
          className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent min-h-[100px]"
        />
      </div>
      <div className="pt-4">
        <button 
          type="submit" 
          disabled={loading || amount <= 0 || reason.length < 5 || !originalTransactionId}
          className="w-full bg-red-600 text-white font-medium py-2 rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Processing..." : "Reverse Credits"}
        </button>
      </div>
    </form>
  );
}
