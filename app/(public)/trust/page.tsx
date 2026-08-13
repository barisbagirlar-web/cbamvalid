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
import {
  EDGE_CASE_PLAYBOOK,
  edgeCaseStatusCounts,
  type EdgeCaseStatus,
} from "@/lib/trust/edge-case-playbook";

export const metadata: Metadata = generateSeoMetadata("/trust");

const STATUS_LABEL: Record<EvidenceStatus, string> = {
  VERIFIED: "VERIFIED",
  SAMPLE: "SAMPLE",
  EMPTY_BY_DESIGN: "EMPTY BY DESIGN",
  OWNER_ACTION: "OWNER ACTION",
  CODE_PROVEN: "CODE PROVEN",
  EXTERNAL_BLOCKER: "EXTERNAL BLOCKER",
};

const EDGE_STATUS_LABEL: Record<EdgeCaseStatus, string> = {
  CODE_PROVEN: "CODE PROVEN",
  PARTIAL: "PARTIAL",
  OWNER_ACTION: "OWNER ACTION",
  EMPTY_BY_DESIGN: "EMPTY BY DESIGN",
  EXTERNAL_BLOCKER: "EXTERNAL BLOCKER",
};

export default function TrustPage() {
  const summary = trustEvidenceSummary();
  const edgeCounts = edgeCaseStatusCounts();

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
              <Link className="btn btn-primary" href="/legal-notice">
                Legal notice
              </Link>
              <Link className="btn btn-ghost" href="/security">
                Security &amp; DPA
              </Link>
              <Link className="btn btn-ghost" href="/case-studies">
                Case studies policy
              </Link>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="wrap" style={{ maxWidth: "920px" }}>
            <div className="deliv-grid" style={{ marginBottom: "28px" }}>
              <div className="deliv-card">
                <span className="fmt">REGISTRY</span>
                <h3>{summary.total} claim slots</h3>
                <p>
                  VERIFIED {summary.counts.VERIFIED} · CODE {summary.counts.CODE_PROVEN} · SAMPLE{" "}
                  {summary.counts.SAMPLE} · EMPTY {summary.counts.EMPTY_BY_DESIGN}
                </p>
              </div>
              <div className="deliv-card">
                <span className="fmt">OPEN GAPS</span>
                <h3>{summary.blocking.length} blocking</h3>
                <p>
                  OWNER_ACTION {summary.counts.OWNER_ACTION} · EXTERNAL_BLOCKER{" "}
                  {summary.counts.EXTERNAL_BLOCKER} — visible, not invented.
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
                  {item.ownerAction ? (
                    <div className="notice" style={{ marginTop: "10px" }}>
                      <b>Required:</b> {item.ownerAction}
                    </div>
                  ) : null}
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
          <div className="wrap" style={{ maxWidth: "920px" }}>
            <div className="section-head">
              <span className="eyebrow">Extreme scenarios · money &amp; integrity</span>
              <h2>Edge cases buyers ask before they pay</h2>
              <p>
                Deadline surges, double checkout, chargebacks, ruleset drift, verify tokens, regional
                outages, GDPR vs verify, and price-feed pins — scored honestly so support and
                disputes do not invent SLAs.
              </p>
            </div>
            <div className="deliv-grid" style={{ marginBottom: "28px" }}>
              <div className="deliv-card">
                <span className="fmt">PLAYBOOK</span>
                <h3>{EDGE_CASE_PLAYBOOK.length} scenarios</h3>
                <p>
                  CODE {edgeCounts.CODE_PROVEN} · PARTIAL {edgeCounts.PARTIAL} · EMPTY{" "}
                  {edgeCounts.EMPTY_BY_DESIGN} · OWNER {edgeCounts.OWNER_ACTION}
                </p>
              </div>
              <div className="deliv-card">
                <span className="fmt">RULE</span>
                <h3>No invented warranties</h3>
                <p>
                  Capacity %, multi-region DR, pen-tests, and unlimited free remakes stay unpublished
                  unless proven.
                </p>
              </div>
            </div>
            <div style={{ display: "grid", gap: "14px" }}>
              {EDGE_CASE_PLAYBOOK.map((item) => (
                <article key={item.id} className="deliv-card">
                  <span className="fmt">{EDGE_STATUS_LABEL[item.status]}</span>
                  <h3 style={{ marginBottom: "8px" }}>{item.title}</h3>
                  <p style={{ marginBottom: "8px" }}>
                    <b>Scenario:</b> {item.scenario}
                  </p>
                  <p style={{ marginBottom: "8px" }}>
                    <b>Commercial:</b> {item.commercialPosition}
                  </p>
                  <p style={{ marginBottom: "8px" }}>
                    <b>Technical:</b> {item.technicalPosition}
                  </p>
                  <p style={{ marginBottom: "8px" }}>
                    <b>Money rule:</b> {item.moneyRule}
                  </p>
                  {item.publicHref ? (
                    <p style={{ marginTop: "12px" }}>
                      <Link href={item.publicHref}>Open related surface →</Link>
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="wrap" style={{ maxWidth: "820px" }}>
            <span className="eyebrow">Why this page exists</span>
            <h2>Buyers audit claims before they pay</h2>
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
