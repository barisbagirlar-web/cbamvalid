"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface VerificationData {
  reportId: string;
  releaseVersion: number;
  createdAt: string;
  updatedAt: string;
  dossierSchemaVersion: string;
  operatorReadinessStatus: string;
  readinessScore: string;
  criticalBlockerCount: number;
  materialFindingCount: number;
  openFindingCount: number;
  evidenceCoverage: string;
  crosswalkCoverage: string;
  installationName: string;
  country: string;
  productionRoute: string;
  reportingPeriod: string;
  totalEmbeddedEmissions: string;
  specificEmbeddedEmissions: string;
  goodsCount: number;
  rulesetVersion?: string | null;
  sourceHash?: string | null;
  documentHash?: string | null;
  brand?: string;
  independenceBoundary?: string;
}

export default function TokenVerificationPage() {
  const params = useParams();
  const publicToken = params?.publicToken as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<VerificationData | null>(null);

  useEffect(() => {
    if (!publicToken) return;

    const fetchVerification = async () => {
      try {
        const res = await fetch(`/api/verify/token/${publicToken}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError("The requested CBAMValid sealed release is not active or could not be found.");
          } else {
            setError("Failed to retrieve sealed-release details. Please try again later.");
          }
          return;
        }
        const body = await res.json();
        setData(body.data);
      } catch {
        setError("A network error occurred while opening the buyer share link.");
      } finally {
        setLoading(false);
      }
    };

    void fetchVerification();
  }, [publicToken]);

  const handleDownload = () => {
    if (!publicToken) return;
    window.location.href = `/api/verify/token/${publicToken}/download`;
  };

  if (loading) {
    return (
      <main id="main" className="section">
        <div className="wrap" style={{ textAlign: "center", padding: "80px 0" }}>
          <div
            className="w-6 h-6 border-2 border-[color:var(--line)] border-t-[color:var(--terra)] rounded-full animate-spin"
            style={{ margin: "0 auto 16px" }}
            aria-hidden="true"
          />
          <p className="lede" style={{ margin: "0 auto" }}>
            Opening sealed CBAMValid release…
          </p>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main id="main" className="section">
        <div className="wrap" style={{ maxWidth: "640px", textAlign: "center" }}>
          <span className="eyebrow">Buyer share link</span>
          <h1>Link not active</h1>
          <p className="lede">{error || "Invalid verification record."}</p>
          <div className="hero-ctas" style={{ justifyContent: "center" }}>
            <Link className="btn btn-primary" href="/verify">
              Manual hash verify
            </Link>
            <Link className="btn btn-ghost" href="/sample-dossier">
              Inspect public sample
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const isReady =
    data.operatorReadinessStatus === "OPERATOR_PREPARATION_COMPLETE" ||
    data.operatorReadinessStatus === "READY_FOR_VERIFIER_REVIEW";
  const readinessScoreVal = Number.parseFloat(data.readinessScore || "0");

  return (
    <main id="main">
      <section className="hero" style={{ paddingBottom: "28px" }}>
        <div className="wrap">
          <span className="eyebrow">{data.brand || "CBAMValid"} · Sealed release</span>
          <h1>
            Buyer share view
            <br />
            <span className="serif-i">integrity, not assurance</span>
          </h1>
          <p className="lede">
            {data.independenceBoundary ||
              "Operator-prepared verifier-preparation pack — not an accredited verification opinion."}
          </p>
          <div className="hero-ctas">
            <button type="button" className="btn btn-primary" onClick={handleDownload}>
              Download verifier pack (ZIP)
            </button>
            <Link className="btn btn-ghost" href="/pricing">
              Prepare your own pack
            </Link>
            <Link className="btn btn-ghost" href="/demo">
              Product Demo
            </Link>
          </div>
        </div>
      </section>

      <section className="section tight">
        <div className="wrap">
          <div className="deliv-grid">
            <div className="deliv-card">
              <span className="fmt">STATUS</span>
              <h3>{isReady ? "Ready for independent review" : "Readiness blocked"}</h3>
              <p className="mono">{data.operatorReadinessStatus}</p>
              <p style={{ marginTop: "12px" }}>
                Readiness score: <b>{data.readinessScore}%</b>
              </p>
              <div
                style={{
                  height: "8px",
                  background: "var(--line)",
                  borderRadius: "999px",
                  overflow: "hidden",
                  marginTop: "8px",
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, Math.max(0, readinessScoreVal))}%`,
                    height: "100%",
                    background: "var(--terra)",
                  }}
                />
              </div>
              <p style={{ marginTop: "14px" }}>
                Blockers: <b>{data.criticalBlockerCount}</b> · Open findings:{" "}
                <b>{data.openFindingCount}</b>
              </p>
            </div>
            <div className="deliv-card">
              <span className="fmt">SCOPE</span>
              <h3>{data.installationName}</h3>
              <p>Country: {data.country || "—"}</p>
              <p>Route: {data.productionRoute || "—"}</p>
              <p>Period: {data.reportingPeriod || "—"}</p>
              <p>Goods groups: {data.goodsCount}</p>
            </div>
            <div className="deliv-card">
              <span className="fmt">EMISSIONS</span>
              <h3>Embedded summary</h3>
              <p>
                Total: <b>{data.totalEmbeddedEmissions}</b> tCO₂e
              </p>
              <p>
                Specific: <b>{data.specificEmbeddedEmissions}</b> t/t
              </p>
              <p>
                Evidence coverage: <b>{data.evidenceCoverage}%</b>
              </p>
            </div>
            <div className="deliv-card">
              <span className="fmt">INTEGRITY PIN</span>
              <h3>Ruleset &amp; hash</h3>
              <p>
                Ruleset: <span className="mono">{data.rulesetVersion || "pinned in package"}</span>
              </p>
              <p>
                Source hash: <span className="mono">{data.sourceHash || "—"}</span>
              </p>
              <p style={{ wordBreak: "break-all" }}>
                Document SHA-256:{" "}
                <span className="mono">{data.documentHash || "see ZIP manifest"}</span>
              </p>
              <p>
                Release: v{data.releaseVersion} · Report{" "}
                <span className="mono">{data.reportId}</span>
              </p>
            </div>
          </div>
          <div className="notice" style={{ marginTop: "28px" }}>
            <b>Independence boundary:</b> Opening this link proves package integrity and operator
            preparation status only. Where verification is legally required, an independent
            accredited verifier must still perform assurance.
          </div>
        </div>
      </section>
    </main>
  );
}
