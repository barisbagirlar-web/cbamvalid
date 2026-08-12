"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthProvider";

type ShareLink = {
  tokenId: string;
  label: string;
  opens: number;
  revokedAt: unknown | null;
  lastOpenedAt: unknown | null;
};

export function ShareLinksPanel({ reportId }: { reportId: string }) {
  const { user } = useAuth();
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [label, setLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function authHeaders(): Promise<Record<string, string>> {
    if (!user) throw new Error("AUTH_REQUIRED");
    return { Authorization: `Bearer ${await user.getIdToken()}`, "Content-Type": "application/json" };
  }

  async function load() {
    if (!user) return;
    try {
      const response = await fetch(`/api/reports/${encodeURIComponent(reportId)}/share-links`, {
        headers: await authHeaders(),
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Share links could not be loaded");
      setLinks(body.data || []);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Share links could not be loaded");
    }
  }

  useEffect(() => {
    void load();
    // report/user identity changes are the only load triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId, user]);

  async function create() {
    if (!label.trim()) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/reports/${encodeURIComponent(reportId)}/share-links`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ label }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Share link could not be created");
      setNewUrl(`${window.location.origin}${body.data.url}`);
      setLabel("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Share link could not be created");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(tokenId: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/reports/${encodeURIComponent(reportId)}/share-links/${encodeURIComponent(tokenId)}`,
        { method: "DELETE", headers: await authHeaders() },
      );
      if (!response.ok && response.status !== 204) {
        const body = await response.json();
        throw new Error(body.error || "Share link could not be revoked");
      }
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Share link could not be revoked");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto mt-6 max-w-4xl rounded-2xl border border-border bg-surface p-6 shadow-sm md:p-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Recipient access</p>
          <h2 className="mt-1 font-serif text-2xl font-bold">Share links</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Create a separate revocable link for each buyer or verifier. Tokens are shown only at creation; CBAMValid stores only their SHA-256 digest.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          maxLength={120}
          placeholder="Buyer: Example GmbH"
          className="min-h-11 flex-1 rounded-md border border-border bg-background px-3 text-sm"
        />
        <button
          type="button"
          disabled={busy || !label.trim()}
          onClick={() => void create()}
          className="min-h-11 rounded-md bg-accent px-5 text-sm font-semibold text-surface disabled:opacity-50"
        >
          Create share link
        </button>
      </div>

      {newUrl ? (
        <div className="mt-4 rounded-md border border-accent/30 bg-accent-soft p-4 text-sm">
          <p className="font-semibold">Copy this link now. The token cannot be recovered later.</p>
          <div className="mt-2 flex gap-2">
            <input readOnly value={newUrl} className="min-h-10 flex-1 rounded border border-border bg-background px-2 font-mono text-xs" />
            <button type="button" onClick={() => void navigator.clipboard.writeText(newUrl)} className="rounded border border-border px-3 font-semibold">Copy</button>
          </div>
        </div>
      ) : null}

      {error ? <p role="alert" className="mt-4 text-sm text-status-blocked">{error}</p> : null}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
            <tr><th className="py-2 pr-4">Label</th><th className="py-2 pr-4">Opens</th><th className="py-2 pr-4">Status</th><th className="py-2 text-right">Action</th></tr>
          </thead>
          <tbody>
            {links.map((link) => (
              <tr key={link.tokenId} className="border-b border-border/60">
                <td className="py-3 pr-4 font-medium">{link.label}</td>
                <td className="py-3 pr-4">{link.opens}</td>
                <td className="py-3 pr-4">{link.revokedAt ? "Revoked" : "Active"}</td>
                <td className="py-3 text-right">
                  {!link.revokedAt ? (
                    <button type="button" disabled={busy} onClick={() => void revoke(link.tokenId)} className="font-semibold text-status-blocked underline disabled:opacity-50">Revoke</button>
                  ) : <span className="text-muted">—</span>}
                </td>
              </tr>
            ))}
            {links.length === 0 ? <tr><td colSpan={4} className="py-5 text-center text-muted">No recipient links yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
