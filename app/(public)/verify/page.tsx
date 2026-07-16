"use client";

import { useState } from "react";
import {
  FileCheck,
  HelpCircle,
  Loader2,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

type VerificationState =
  | "IDLE"
  | "VALIDATING"
  | "ACTIVE"
  | "REFUNDED"
  | "INACTIVE"
  | "INVALID"
  | "NOT_FOUND"
  | "SERVICE_UNAVAILABLE";

type SealMetadata = {
  cryptographicallyRegistered: boolean;
  documentHash: string;
  reportId: string;
  releaseVersion: number;
  issuedAt: string | null;
  commercialStatus: string;
  refunded: boolean;
  rulesetVersion: string | null;
  sourceHash: string | null;
  manifestHash: string | null;
  packageHash: string | null;
  kmsKeyVersion: string | null;
  kmsAlgorithm: string | null;
};

function errorText(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "The verification service could not be reached.";
}

export default function VerifyPage() {
  const [hash, setHash] = useState("");
  const [state, setState] = useState<VerificationState>("IDLE");
  const [result, setResult] = useState<SealMetadata | null>(null);
  const [message, setMessage] = useState("");
  const [requestId, setRequestId] = useState("");

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanHash = hash.trim().toLowerCase();
    if (!cleanHash) return;
    setState("VALIDATING");
    setMessage("");
    setResult(null);

    try {
      const response = await fetch(`/api/verify/${encodeURIComponent(cleanHash)}`, {
        cache: "no-store",
      });
      const body = await response.json() as {
        requestId?: string;
        data?: SealMetadata;
        error?: { message?: string };
      };
      setRequestId(body.requestId || "");

      if (!response.ok) {
        if (response.status === 400) setState("INVALID");
        else if (response.status === 404) setState("NOT_FOUND");
        else setState("SERVICE_UNAVAILABLE");
        setMessage(body.error?.message || "Verification failed.");
        return;
      }

      if (!body.data) throw new Error("Verification response contained no seal metadata.");
      setResult(body.data);
      if (!body.data.cryptographicallyRegistered) {
        setState("INVALID");
        setMessage("The registry record is marked cryptographically invalid.");
      } else if (body.data.refunded || body.data.commercialStatus === "REFUNDED_AFTER_DELIVERY") {
        setState("REFUNDED");
      } else if (body.data.commercialStatus === "ACTIVE") {
        setState("ACTIVE");
      } else {
        setState("INACTIVE");
      }
    } catch (verificationError: unknown) {
      console.error("Public dossier verification failed", verificationError);
      setState("SERVICE_UNAVAILABLE");
      setMessage(errorText(verificationError));
    }
  };

  const clear = () => {
    setHash("");
    setState("IDLE");
    setResult(null);
    setMessage("");
    setRequestId("");
  };

  const statusCard = () => {
    if (state === "IDLE") return null;
    if (state === "VALIDATING") {
      return <section className="flex flex-col items-center rounded-2xl border border-border bg-surface p-12 shadow-sm"><Loader2 className="mb-4 h-10 w-10 animate-spin text-accent" /><p className="text-sm font-medium text-muted">Reconciling seal and report registry records…</p></section>;
    }
    if (state === "INVALID" || state === "NOT_FOUND" || state === "SERVICE_UNAVAILABLE") {
      return (
        <section className="rounded-2xl border border-red-300 bg-red-50 p-8 shadow-sm">
          <div className="flex items-start gap-3"><ShieldAlert className="mt-0.5 h-7 w-7 shrink-0 text-red-700" /><div><h2 className="font-serif text-xl font-bold text-red-900">Verification Failed</h2><p className="mt-2 text-sm text-red-800">{message}</p></div></div>
          <p className="mt-5 border-t border-red-200 pt-3 font-mono text-xs text-red-800/70">Request ID: {requestId || "N/A"}</p>
        </section>
      );
    }
    if (!result) return null;

    const active = state === "ACTIVE";
    const refunded = state === "REFUNDED";
    return (
      <section className={`rounded-2xl border p-8 shadow-lg ${active ? "border-emerald-300 bg-emerald-50" : refunded ? "border-amber-300 bg-amber-50" : "border-slate-300 bg-slate-50"}`}>
        <div className="flex flex-col justify-between gap-4 border-b border-current/15 pb-6 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-full ${active ? "bg-emerald-100 text-emerald-700" : refunded ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-700"}`}>
              {active ? <ShieldCheck className="h-7 w-7" /> : refunded ? <ShieldAlert className="h-7 w-7" /> : <HelpCircle className="h-7 w-7" />}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider">{active ? "Authentic active seal" : refunded ? "Authentic seal · refunded" : "Authentic seal · inactive status"}</p>
              <h2 className="mt-1 font-serif text-xl font-bold">Cryptographic Registration Confirmed</h2>
            </div>
          </div>
          <p className="font-mono text-xs">Request ID: {requestId || "N/A"}</p>
        </div>

        <dl className="mt-6 grid gap-x-8 gap-y-5 text-sm md:grid-cols-2">
          <Metadata label="Document Hash" value={result.documentHash} mono />
          <Metadata label="Report Reference" value={result.reportId} mono />
          <Metadata label="Release Version" value={String(result.releaseVersion)} />
          <Metadata label="Issued At" value={result.issuedAt ? new Date(result.issuedAt).toUTCString() : "Unavailable"} />
          <Metadata label="Commercial Status" value={result.commercialStatus} />
          <Metadata label="Ruleset Version" value={result.rulesetVersion || "Unavailable"} />
          <Metadata label="Regulatory Source Hash" value={result.sourceHash || "Unavailable"} mono />
          <Metadata label="KMS Key Version" value={result.kmsKeyVersion || "Unavailable"} mono />
          <Metadata label="KMS Algorithm" value={result.kmsAlgorithm || "Unavailable"} />
          <Metadata label="Package Hash" value={result.packageHash || "Unavailable"} mono />
        </dl>

        {refunded && <div className="mt-6 rounded-xl border border-amber-400 bg-white/60 p-4 text-sm leading-relaxed text-amber-950"><strong>Commercial status warning:</strong> The dossier remains cryptographically registered as the file originally sealed, but the associated purchase was refunded after delivery. Obtain current commercial and verification confirmation before relying on it.</div>}
        {state === "INACTIVE" && <div className="mt-6 rounded-xl border border-slate-400 bg-white/60 p-4 text-sm text-slate-900">This seal is registered, but its commercial status is not ACTIVE. Treat it as unavailable for current reliance until status is clarified.</div>}
      </section>
    );
  };

  return (
    <main className="bg-background px-6 py-16 text-foreground md:py-24">
      <div className="mx-auto max-w-3xl space-y-10">
        <header className="text-center"><h1 className="font-serif text-4xl font-black tracking-tight md:text-5xl">Verify a CBAMValid Dossier</h1><p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted">Enter the 64-character document hash to reconcile the public seal registry with its immutable sealed report metadata.</p></header>
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1"><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" /><input type="text" value={hash} onChange={(event) => setHash(event.target.value)} minLength={64} maxLength={64} pattern="[a-fA-F0-9]{64}" placeholder="64-character SHA-256 document hash" aria-label="Document hash" required className="h-14 w-full rounded-xl border border-border bg-surface pl-12 pr-4 font-mono text-sm outline-none focus:border-accent" /></div>
            <button type="submit" disabled={state === "VALIDATING" || !hash.trim()} className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-accent px-8 font-medium text-surface disabled:opacity-50">{state === "VALIDATING" ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileCheck className="h-5 w-5" />}Verify</button>
            <button type="button" onClick={clear} className="flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-surface" aria-label="Clear verification input"><RotateCcw className="h-5 w-5" /></button>
          </div>
        </form>
        {statusCard()}
      </div>
    </main>
  );
}

function Metadata({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div><dt className="text-[11px] font-bold uppercase tracking-wider opacity-65">{label}</dt><dd className={`mt-1 break-all font-medium ${mono ? "font-mono text-xs" : ""}`}>{value}</dd></div>;
}
