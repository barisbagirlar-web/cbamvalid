"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import type { PublicVerificationPayload } from "@/lib/verify/public-verification";

export default function VerifyPackageClientPage() {
  const params = useParams<{ packageId: string }>();
  const packageId = params?.packageId;
  const [data, setData] = useState<PublicVerificationPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!packageId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/verify/package/${encodeURIComponent(packageId)}`);
        const json = await res.json();
        if (!res.ok) {
          if (!cancelled) setError(json?.error?.message || json?.message || "Not found");
          return;
        }
        if (!cancelled) setData(json.data || json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [packageId]);

  const rows: Array<[string, string]> = data
    ? [
        ["Package ID", data.packageId],
        ["Report ID", data.reportId || "—"],
        ["Status", data.status],
        ["Release version", data.releaseVersion ? `v${data.releaseVersion}` : "—"],
        ["Generated at", data.generatedAt || "—"],
        ["Manifest SHA-256", data.manifestHash || "—"],
        ["Package SHA-256", data.packageHash || "—"],
        ["Signature key version", data.kmsKeyVersion || "—"],
        ["Signature algorithm", data.kmsAlgorithm || "—"],
        ["Signature verification", data.signatureVerificationState],
        ["Component count", data.componentCount ? String(data.componentCount) : "—"],
        ["Current release", data.isCurrentRelease ? "Yes" : "No"],
        ["Public verification state", data.publicVerificationState],
      ]
    : [];

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Package verification</h1>
      <p className="mt-2 text-sm text-muted mono">{packageId}</p>
      {error ? <p className="mt-6 text-status-blocked">{error}</p> : null}
      {data ? (
        <dl className="mt-8 grid gap-3 text-sm">
          {rows.map(([term, value]) => (
            <div key={term} className="flex flex-col gap-0.5 border-b border-muted/30 pb-2">
              <dt className="text-muted">{term}</dt>
              <dd className="font-mono text-[13px] text-ink">{value}</dd>
            </div>
          ))}
          <p className="mt-4 text-xs text-muted">{data.disclaimer}</p>
        </dl>
      ) : !error ? (
        <p className="mt-6 text-muted">Loading…</p>
      ) : null}
    </main>
  );
}
