"use client";

import React, { useState } from "react";
import { updateSettings } from "../actions";
import { CheckCircle2, AlertTriangle, Save } from "lucide-react";

interface SettingsInitial {
  publicPaidLaunchEnabled: boolean;
  version: string;
  updatedAt: string | null;
}

export default function SettingsClient({ initial }: { initial: SettingsInitial }) {
  const [enabled, setEnabled] = useState(initial.publicPaidLaunchEnabled);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await updateSettings({ publicPaidLaunchEnabled: enabled, reason });
      if (res.success) {
        setSuccess(`Settings updated. Public paid launch is now ${enabled ? "ENABLED" : "DISABLED"}.`);
        setReason("");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update settings.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex justify-between items-end border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-foreground">Settings Management</h1>
          <p className="text-muted text-sm mt-1">Platform configuration and launch gates.</p>
        </div>
        <div className="text-xs font-mono text-muted">version: {initial.version}</div>
      </div>

      {error && (
        <div className="p-3 bg-status-blocked/10 border border-status-blocked/20 text-status-blocked text-sm rounded flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-accent/10 border border-accent/20 text-accent text-sm rounded flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {success}
        </div>
      )}

      <form onSubmit={handleSave} className="p-6 bg-surface border border-border rounded-lg shadow-sm space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-medium text-foreground">Public paid launch</h2>
            <p className="text-sm text-muted mt-1">
              When enabled, all customers can reach Paddle checkout. When disabled, only privileged
              test identities can purchase.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled((v) => !v)}
            className={`relative w-12 h-7 shrink-0 rounded-full transition-colors ${enabled ? "bg-accent" : "bg-border"}`}
          >
            <span
              className={`absolute top-1 w-5 h-5 rounded-full bg-surface shadow transition-all ${enabled ? "left-6" : "left-1"}`}
            />
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-muted mb-1">Reason for change</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            minLength={5}
            placeholder="e.g. Final launch checks complete — enabling public paid checkout"
            className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent min-h-[80px]"
          />
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading || reason.length < 5}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {loading ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </form>

      <div className="p-4 bg-surface border border-border rounded-lg shadow-sm text-sm text-muted flex items-start gap-3">
        <span className="text-xs font-mono">
          Last updated: {initial.updatedAt ? new Date(initial.updatedAt).toLocaleString() : "never"}
        </span>
      </div>
    </div>
  );
}
