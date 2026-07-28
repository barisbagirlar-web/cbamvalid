"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type VerifyPayload = {
  packageId: string;
  signatureValid: boolean;
  signingKeyFingerprint: string | null;
  sealTimestamp: string | null;
  tsaTokenStatus: string;
  revocationState: string;
  publicVerificationState: string;
  publicVerificationUrl: string;
  disclaimer: string;
};

export default function VerifyPackageClientPage() {
  const params = useParams<{ packageId: string }>();
  const packageId = params?.packageId;
  const [data, setData] = useState<VerifyPayload | null>(null);
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

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Package verification</h1>
      <p className="mt-2 text-sm text-muted mono">{packageId}</p>
      {error ? <p className="mt-6 text-status-blocked">{error}</p> : null}
      {data ? (
        <dl className="mt-8 grid gap-3 text-sm">
          <div>
            <dt className="text-muted">Signature valid</dt>
            <dd>{String(data.signatureValid)}</dd>
          </div>
          <div>
            <dt className="text-muted">Signing key</dt>
            <dd className="mono">{data.signingKeyFingerprint || "NOT_AVAILABLE"}</dd>
          </div>
          <div>
            <dt className="text-muted">Seal timestamp</dt>
            <dd>{data.sealTimestamp || "NOT_AVAILABLE"}</dd>
          </div>
          <div>
            <dt className="text-muted">TSA token</dt>
            <dd>{data.tsaTokenStatus}</dd>
          </div>
          <div>
            <dt className="text-muted">Revocation</dt>
            <dd>{data.revocationState}</dd>
          </div>
          <div>
            <dt className="text-muted">Public state</dt>
            <dd>{data.publicVerificationState}</dd>
          </div>
          <p className="mt-4 text-xs text-muted">{data.disclaimer}</p>
        </dl>
      ) : !error ? (
        <p className="mt-6 text-muted">Loading…</p>
      ) : null}
    </main>
  );
}
