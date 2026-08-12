import type { Metadata } from "next";
import Link from "next/link";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { JsonLdForRoute } from "@/components/seo/JsonLdForRoute";
import { AeoPageChrome } from "@/components/seo/AnswerEvidenceSection";
import { legalConfig } from "@/lib/legal-config";
import { STATUS_PUBLIC } from "@/lib/trust/operational-commitments";

export const metadata: Metadata = generateSeoMetadata("/status");

export default function StatusPage() {
  return (
    <main id="main">
      <JsonLdForRoute path="/status" />
      <section className="hero" style={{ paddingBottom: "40px" }}>
        <div className="wrap" style={{ maxWidth: "820px" }}>
          <span className="eyebrow">Operations · Status</span>
          <h1>
            Service status
            <br />
            <span className="serif-i">dependency facts</span>
          </h1>
          <p className="lede">{STATUS_PUBLIC.lede}</p>
          <div className="hero-ctas">
            <a className="btn btn-primary" href={STATUS_PUBLIC.googleCloudStatusUrl} rel="noopener noreferrer">
              Google Cloud status
            </a>
            <a className="btn btn-ghost" href={STATUS_PUBLIC.firebaseStatusUrl} rel="noopener noreferrer">
              Firebase status
            </a>
            <Link className="btn btn-ghost" href="/security">
              Security &amp; DPA
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="deliv-grid">
            <div className="deliv-card">
              <span className="fmt">RUNTIME</span>
              <h3>Primary dependency</h3>
              <p>
                Production application and data plane: Google Cloud / Firebase, configured for{" "}
                <span className="mono">europe-west1</span>.
              </p>
            </div>
            <div className="deliv-card">
              <span className="fmt">PAYMENTS</span>
              <h3>Checkout dependency</h3>
              <p>
                Paid lock checkout depends on Paddle as Merchant of Record. Billing outages follow
                Paddle’s own status and support channels.
              </p>
            </div>
            <div className="deliv-card">
              <span className="fmt">UPTIME</span>
              <h3>No invented percentage</h3>
              <p>{STATUS_PUBLIC.noUptimeSla}</p>
            </div>
            <div className="deliv-card">
              <span className="fmt">MONITOR</span>
              <h3>Status tooling</h3>
              <p>{STATUS_PUBLIC.noExternalStatusVendor}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ background: "var(--paper-2)" }}>
        <div className="wrap" style={{ maxWidth: "820px" }}>
          <div className="section-head">
            <span className="eyebrow">Incidents</span>
            <h2>How to report a service impact</h2>
            <p>
              If the application is unavailable or a paid workflow is blocked, email{" "}
              <a href={`mailto:${legalConfig.supportEmail}`}>{legalConfig.supportEmail}</a> with
              the approximate time (UTC), URL, and whether checkout or dossier generation is
              affected. Support response targets are published on{" "}
              <Link href="/security">Security</Link>.
            </p>
          </div>
          <div className="notice">
            <b>Honesty rule:</b> This page will not display a green “all systems operational”
            badge without an independent monitoring product. Provider dashboards remain the
            upstream source for platform-wide incidents.
          </div>
        </div>
      </section>

      <AeoPageChrome path="/status" answerHeading="Status answers" answerLimit={2} />
    </main>
  );
}
