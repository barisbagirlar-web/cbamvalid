"use client";

import React, { useState } from "react";
import { grantCredits } from "../../actions";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle } from "lucide-react";

export default function GrantCreditsForm({ initialUid }: { initialUid: string }) {
  const [uid, setUid] = useState(initialUid);
  const [amount, setAmount] = useState<number>(0);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await grantCredits(uid, amount, reason);
      if (res.success) {
        setSuccess(`Successfully granted ${amount} credits. Transaction ID: ${res.transactionId}`);
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || "Failed to grant credits.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleGrant} className="space-y-4">
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
        <label className="block text-sm font-medium text-muted mb-1">Credit Amount</label>
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
        <label className="block text-sm font-medium text-muted mb-1">Reason for Grant</label>
        <textarea 
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          minLength={5}
          placeholder="e.g. Compensation for failed generation attempt on 2024-05-10"
          className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent min-h-[100px]"
        />
      </div>
      <div className="pt-4">
        <button 
          type="submit" 
          disabled={loading || amount <= 0 || reason.length < 5}
          className="w-full bg-accent text-surface font-medium py-2 rounded hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Processing..." : "Grant Credits"}
        </button>
      </div>
    </form>
  );
}
