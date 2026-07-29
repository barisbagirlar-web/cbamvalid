import type { Metadata } from "next";
import Link from "next/link";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { JsonLdForRoute } from "@/components/seo/JsonLdForRoute";
import { AeoPageChrome } from "@/components/seo/AnswerEvidenceSection";
import { AuthorityRail } from "@/components/marketing/AuthorityRail";
import {
  TRUST_EVIDENCE_ITEMS,
  TRUST_PUBLIC,
  trustEvidenceSummary,
  type EvidenceStatus,
} from "@/lib/trust/evidence-registry";

export const metadata: Metadata = generateSeoMetadata("/trust");

const STATUS_LABEL: Record<EvidenceStatus, string> = {
  VERIFIED: "VERIFIED",
  SAMPLE: "SAMPLE",
  EMPTY_BY_DESIGN: "EMPTY BY DESIGN",
  CODE_PROVEN: "CODE PROVEN",
};

export default function TrustPage() {
  const summary = trustEvidenceSummary();

  return (
    <>
      <JsonLdForRoute path="/trust" />
      <main id="main">
        <section className="hero" style={{ paddingBottom: "40px" }}>
          <div className="wrap" style={{ maxWidth: "820px" }}>
            <AuthorityRail mode="compact" eyebrow="Authority · Claim court of truth" />
            <span className="eyebrow">{TRUST_PUBLIC.eyebrow}</span>
            <h1>
              Trust evidence registry
              <br />
              <span className="serif-i">pinned claims only</span>
            </h1>
            <p className="lede">{TRUST_PUBLIC.lede}</p>
            <div className="hero-ctas">
              <Link className="btn btn-primary" href="/verifier-review">
                Inspect the structure review
              </Link>
            </div>
            <p className="hero-secondary-link">
              Supporting records: <Link href="/legal-notice">legal notice</Link>
              {" · "}
              <Link href="/security">security and data protection</Link>
            </p>
          </div>
        </section>

        <section className="section">
          <div className="wrap" style={{ maxWidth: "920px" }}>
            <div style={{ marginBottom: "28px" }}>
              <div className="deliv-card">
                <span className="fmt">REGISTRY</span>
                <h3>{summary.total} published evidence records</h3>
                <p>
                  VERIFIED {summary.counts.VERIFIED} · CODE {summary.counts.CODE_PROVEN} · SAMPLE{" "}
                  {summary.counts.SAMPLE} · EMPTY {summary.counts.EMPTY_BY_DESIGN}
                </p>
              </div>
            </div>

            <div style={{ display: "grid", gap: "14px" }}>
              {TRUST_EVIDENCE_ITEMS.map((item) => (
                <article key={item.id} className="deliv-card">
                  <span className="fmt">
                    {item.layer.toUpperCase()} · {STATUS_LABEL[item.status]}
                  </span>
                  <h3 style={{ marginBottom: "8px" }}>{item.title}</h3>
                  <p style={{ marginBottom: "8px" }}>{item.proof}</p>
                  {item.publicHref ? (
                    <p style={{ marginTop: "12px" }}>
                      <Link href={item.publicHref}>Open surface →</Link>
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section" style={{ background: "var(--paper-2)" }}>
          <div className="wrap" style={{ maxWidth: "820px" }}>
            <span className="eyebrow">Why this page exists</span>
            <h2>Enterprise buyers audit claims before they pay</h2>
            <p className="lede">
              Invented CRO numbers, forged verifier letters, and fake logos destroy procurement
              trust permanently. CBAMValid scores itself with the same fail-closed discipline as
              the seal engine: missing evidence stays visible.
            </p>
            <div className="hero-ctas">
              <Link className="btn btn-primary" href="/sample-dossier">
                Inspect sample dossier
              </Link>
              <Link className="btn btn-ghost" href="/case-studies">
                Case studies policy
              </Link>
              <a className="btn btn-ghost" href="mailto:info@cbamvalid.com?subject=Trust%20evidence%20inquiry">
                Ask about evidence
              </a>
            </div>
          </div>
        </section>

        <AeoPageChrome path="/trust" answerHeading="Trust answers" answerLimit={2} />
      </main>
    </>
  );
}
