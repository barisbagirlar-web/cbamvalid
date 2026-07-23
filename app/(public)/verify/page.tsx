"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

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

  useEffect(() => {
    const revealEls = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window && revealEls.length) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      }, { threshold: 0.12 });
      revealEls.forEach((el) => io.observe(el));
    } else {
      revealEls.forEach((el) => el.classList.add('in'));
    }
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hash.trim()) return;

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

  const renderStatus = () => {
    switch (state) {
      case "VALIDATING":
        return (
          <div className="verify-result show validating" style={{ padding: "20px", background: "var(--paper-2)", borderRadius: "8px", border: "1px solid var(--line)" }}>
            <p style={{ fontWeight: "bold" }}>Verifying cryptographic signature integrity...</p>
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
          <div className="verify-result show success" style={{ padding: "24px", background: "var(--ok-soft)", color: "var(--ok)", borderRadius: "12px", border: "1.5px solid var(--ok)", marginTop: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--ok)", paddingBottom: "12px", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <span className="eyebrow" style={{ display: "inline-block", background: "var(--ok)", color: "#fff", borderColor: "transparent", fontSize: "0.65rem", padding: "0.2em 0.8em", marginBottom: "8px" }}>
                  {state === "VALID" ? "AUTHENTIC SEAL" : state === "SUPERSEDED" ? "SUPERSEDED" : "REVOKED"}
                </span>
                <h3 style={{ margin: 0, fontFamily: "var(--sans)", fontWeight: "bold" }}>Cryptographic Seal Verified</h3>
              </div>
              <span style={{ fontFamily: "var(--mono)", fontSize: "0.75rem", alignSelf: "center", color: "var(--faint)" }}>
                Request: {requestId || "N/A"}
              </span>
            </div>

            <div className="mono" style={{ display: "grid", gridTemplateColumns: "1fr", gap: "14px", fontSize: "0.8rem", color: "var(--ink)" }}>
              <div>
                <span style={{ fontWeight: "bold", fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", display: "block" }}>Document Hash (SHA-256)</span>
                <span style={{ background: "rgba(255,255,255,0.6)", padding: "4px 8px", borderRadius: "4px", wordBreak: "break-all", display: "block", marginTop: "4px" }}>{result.documentHash}</span>
              </div>
              <div>
                <span style={{ fontWeight: "bold", fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", display: "block" }}>Report ID</span>
                <span style={{ background: "rgba(255,255,255,0.6)", padding: "4px 8px", borderRadius: "4px", wordBreak: "break-all", display: "block", marginTop: "4px" }}>{result.reportId}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "14px" }}>
                <div>
                  <span style={{ fontWeight: "bold", fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", display: "block" }}>Issued Timestamp</span>
                  <span>{formattedDate}</span>
                </div>
                <div>
                  <span style={{ fontWeight: "bold", fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", display: "block" }}>Version</span>
                  <span>v{result.version}</span>
                </div>
                <div>
                  <span style={{ fontWeight: "bold", fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", display: "block" }}>Regulatory Scope</span>
                  <span>{result.regulatorySnapshotId}</span>
                </div>
                <div>
                  <span style={{ fontWeight: "bold", fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", display: "block" }}>Ruleset / Engine</span>
                  <span>{result.methodologyVersion}</span>
                </div>
              </div>
            </div>

            {state === "SUPERSEDED" && (
              <div style={{ padding: "12px", background: "var(--warn-soft)", color: "var(--warn)", border: "1px solid var(--warn)", borderRadius: "8px", fontSize: "0.78rem", lineHeight: "1.4" }}>
                <strong>Attention:</strong> This report has been replaced by a newer version. Importers are recommended to request the latest active revision of the sealed dossier.
              </div>
            )}

            {state === "REVOKED" && (
              <div style={{ padding: "12px", background: "var(--err-soft)", color: "var(--err)", border: "1px solid var(--err)", borderRadius: "8px", fontSize: "0.78rem", lineHeight: "1.4" }}>
                <strong>Warning:</strong> The exporter or CBAMValid authority has explicitly revoked this document seal. It should not be used for compliance submissions.
              </div>
            )}
          </div>
        );
      case "INVALID":
      case "NOT_FOUND":
      case "SERVICE_UNAVAILABLE":
        return (
          <div className="verify-result show error" style={{ padding: "20px", background: "var(--err-soft)", color: "var(--err)", borderRadius: "12px", border: "1.5px solid var(--err)", marginTop: "24px" }}>
            <h3 style={{ margin: "0 0 6px 0", fontFamily: "var(--sans)", fontWeight: "bold" }}>Verification Failed</h3>
            <p style={{ fontSize: "0.86rem", margin: 0 }}>{errorMsg}</p>
            <span style={{ display: "block", fontFamily: "var(--mono)", fontSize: "0.7rem", marginTop: "12px", color: "var(--faint)" }}>
              Request ID: {requestId || "N/A"}
            </span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <main id="main">
      <section className="section">
        <div className="wrap">
          <div className="section-head center reveal" style={{ marginBottom: "40px" }}>
            <span className="eyebrow">Public Integrity Check</span>
            <h1>Verify a dossier</h1>
            <p>Received a CBAMValid dossier from an exporter? Enter its document hash signature below to confirm the cryptographic seal — proof it hasn&apos;t been tampered with.</p>
          </div>

          <div className="verify-box reveal">
            <form onSubmit={handleVerify}>
              <label htmlFor="dossier-id">Dossier Document Hash / Seal Signature</label>
              <input
                className="verify-input"
                id="dossier-id"
                name="dossier-id"
                type="text"
                value={hash}
                onChange={(e) => setHash(e.target.value)}
                placeholder="Enter 64-character SHA-256 document seal signature..."
                autoComplete="off"
                required
              />
              <p id="verify-help" style={{ fontSize: "0.78rem", color: "var(--faint)", margin: "-8px 0 18px" }}>
                You&apos;ll find the signature in the integrity manifest and on the dossier cover page.
              </p>
              <div style={{ display: "flex", gap: "10px" }}>
                <button className="btn btn-primary" type="submit" style={{ flex: 1 }} disabled={state === "VALIDATING"}>
                  Check Integrity Manifest <span className="arr">→</span>
                </button>
                {hash && (
                  <button className="btn btn-ghost" type="button" onClick={handleClear}>
                    Clear
                  </button>
                )}
              </div>
            </form>
            {renderStatus()}
          </div>

          <div className="method-grid" style={{ marginTop: "64px" }}>
            <div className="method-card reveal">
              <h3>What verification confirms</h3>
              <p>The SHA-256 hashes of the sealed PDF and JSON, the UTC seal timestamp, and the exact ruleset version the dossier was calculated against.</p>
              <span className="ref">SHA-256 · UTC · RULESET</span>
            </div>
            <div className="method-card reveal">
              <h3>What it does not confirm</h3>
              <p>Verification proves integrity, not regulatory approval. CBAMValid is not an accredited verifier; legal verification of emissions remains a separate step where required.</p>
              <span className="ref">LIMITATION NOTICE</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
