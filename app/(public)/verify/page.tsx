"use client";

import React, { useState } from "react";
import { Search, RotateCcw, ShieldCheck, ShieldAlert, Loader2, FileCheck, HelpCircle } from "lucide-react";

type VerificationState = 
  | "IDLE" 
  | "VALIDATING" 
  | "VALID" 
  | "INVALID" 
  | "REVOKED" 
  | "SUPERSEDED" 
  | "NOT_FOUND" 
  | "SERVICE_UNAVAILABLE";

interface SealMetadata {
  valid: boolean;
  documentHash: string;
  reportId: string;
  version: number;
  issuedAt: string | number;
  commercialStatus: string;
  methodologyVersion: string;
  regulatorySnapshotId: string;
}

export default function VerifyPage() {
  const [hash, setHash] = useState("");
  const [state, setState] = useState<VerificationState>("IDLE");
  const [result, setResult] = useState<SealMetadata | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [requestId, setRequestId] = useState("");

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hash.trim()) return;

    // Clean space/newline inputs
    const cleanHash = hash.trim();

    setState("VALIDATING");
    setErrorMsg("");
    setResult(null);

    try {
      const res = await fetch(`/api/verify/${cleanHash}`);
      const body = await res.json();

      setRequestId(body.requestId || "");

      if (!res.ok) {
        if (res.status === 400) {
          setState("INVALID");
          setErrorMsg(body.error?.message || "Invalid document signature format.");
        } else if (res.status === 404) {
          setState("NOT_FOUND");
          setErrorMsg(body.error?.message || "No registered sealed document was found.");
        } else {
          setState("SERVICE_UNAVAILABLE");
          setErrorMsg("The verification service is temporarily unavailable. Please try again later.");
        }
        return;
      }

      const data = body.data as SealMetadata;
      setResult(data);

      if (data.commercialStatus === "REVOKED") {
        setState("REVOKED");
      } else if (data.commercialStatus === "SUPERSEDED") {
        setState("SUPERSEDED");
      } else if (data.valid) {
        setState("VALID");
      } else {
        setState("INVALID");
      }
    } catch (err) {
      console.error(err);
      setState("SERVICE_UNAVAILABLE");
      setErrorMsg("Failed to communicate with verification servers.");
    }
  };

  const handleClear = () => {
    setHash("");
    setState("IDLE");
    setResult(null);
    setErrorMsg("");
    setRequestId("");
  };

  const renderStatusCard = () => {
    switch (state) {
      case "VALIDATING":
        return (
          <div className="flex flex-col items-center justify-center p-12 bg-surface/40 backdrop-blur-md border border-border/60 rounded-2xl shadow-sm animate-pulse">
            <Loader2 className="w-10 h-10 text-accent animate-spin mb-4" />
            <p className="text-muted font-medium text-[15px]">Verifying cryptographic signature integrity...</p>
          </div>
        );
      case "VALID":
      case "SUPERSEDED":
      case "REVOKED":
        if (!result) return null;
        const formattedDate = typeof result.issuedAt === "number" 
          ? new Date(result.issuedAt).toUTCString()
          : result.issuedAt;
          
        return (
          <div className="bg-surface/60 backdrop-blur-md border border-border/80 rounded-2xl p-8 shadow-lg space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-6">
              <div className="flex items-center gap-3">
                {state === "VALID" && (
                  <>
                    <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                      <ShieldCheck className="w-7 h-7" />
                    </div>
                    <div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-accent/10 text-accent uppercase tracking-wide mb-1">Authentic Seal</span>
                      <h3 className="text-lg font-bold text-foreground">Signature Verified</h3>
                    </div>
                  </>
                )}
                {state === "SUPERSEDED" && (
                  <>
                    <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-600">
                      <HelpCircle className="w-7 h-7" />
                    </div>
                    <div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-700 uppercase tracking-wide mb-1">Superseded</span>
                      <h3 className="text-lg font-bold text-foreground">Document Replaced</h3>
                    </div>
                  </>
                )}
                {state === "REVOKED" && (
                  <>
                    <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-600">
                      <ShieldAlert className="w-7 h-7" />
                    </div>
                    <div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-700 uppercase tracking-wide mb-1">Revoked</span>
                      <h3 className="text-lg font-bold text-foreground">Seal Invalidated</h3>
                    </div>
                  </>
                )}
              </div>
              <div className="text-xs text-muted md:text-right font-mono">
                Request ID: {requestId || "N/A"}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 text-sm">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">Document Hash</span>
                <span className="font-mono text-xs text-foreground select-all break-all bg-border/20 px-2 py-1 rounded block">{result.documentHash}</span>
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">Report Reference</span>
                <span className="font-mono text-xs text-foreground select-all break-all bg-border/20 px-2 py-1 rounded block">{result.reportId}</span>
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">Sealing Timestamp</span>
                <span className="text-foreground font-medium block">{formattedDate}</span>
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">Dossier Version</span>
                <span className="text-foreground font-medium block">v{result.version}</span>
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">Regulatory Scope</span>
                <span className="text-foreground font-medium block">{result.regulatorySnapshotId}</span>
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">Ruleset / Engine Version</span>
                <span className="text-foreground font-medium block">{result.methodologyVersion}</span>
              </div>
            </div>

            {state === "SUPERSEDED" && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-700 text-xs leading-relaxed">
                <strong>Attention:</strong> This report has been replaced by a newer version. Importers are recommended to request the latest active revision of the sealed dossier.
              </div>
            )}
            {state === "REVOKED" && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs leading-relaxed">
                <strong>Warning:</strong> The exporter or CBAMValid authority has explicitly revoked this document seal. It should not be used for compliance submissions.
              </div>
            )}
          </div>
        );
      case "INVALID":
      case "NOT_FOUND":
      case "SERVICE_UNAVAILABLE":
        return (
          <div className="bg-rose-500/[0.03] backdrop-blur-md border border-rose-500/20 rounded-2xl p-8 shadow-sm space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-600 shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Verification Failed</h3>
                <p className="text-rose-700 text-sm font-medium">{errorMsg}</p>
              </div>
            </div>
            <div className="text-[11px] text-muted font-mono pt-2 border-t border-rose-500/10">
              Request ID: {requestId || "N/A"}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 bg-surface text-foreground py-16 md:py-24 px-6">
      <div className="max-w-3xl mx-auto space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-serif font-black tracking-tight text-foreground">
            Verify a CBAMValid Dossier
          </h1>
          <p className="text-muted text-base max-w-xl mx-auto leading-relaxed">
            Validate the integrity, ruleset snapshot, and authenticity of a sealed exporter carbon emissions dossier. Enter the cryptographic signature signature below.
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          <div className="relative flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted/80 pointer-events-none" />
              <input
                type="text"
                value={hash}
                onChange={(e) => setHash(e.target.value)}
                placeholder="Enter 64-character SHA-256 document seal signature..."
                className="w-full h-14 pl-12 pr-4 bg-surface border border-border hover:border-border/100 focus:border-accent rounded-xl outline-none transition-colors font-mono text-sm shadow-sm"
                aria-label="Document hash or verification ID"
                required
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={state === "VALIDATING" || !hash.trim()}
                className="h-14 px-8 bg-accent text-surface hover:bg-accent-hover active:bg-accent-active font-medium rounded-xl shadow-sm cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 justify-center flex-1 md:flex-none"
              >
                {state === "VALIDATING" ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <FileCheck className="w-5 h-5" />
                )}
                Verify Dossier
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="w-14 h-14 bg-surface border border-border hover:bg-border/30 text-muted hover:text-foreground rounded-xl flex items-center justify-center cursor-pointer transition-colors shadow-sm"
                title="Clear input"
                aria-label="Clear"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>
          </div>
        </form>

        {renderStatusCard()}
      </div>
    </div>
  );
}
