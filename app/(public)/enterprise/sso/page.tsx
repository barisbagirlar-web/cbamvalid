import type { Metadata } from "next";
import Link from "next/link";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { JsonLdForRoute } from "@/components/seo/JsonLdForRoute";
import { AeoPageChrome } from "@/components/seo/AnswerEvidenceSection";
import { EnterpriseInquiryForm } from "@/components/enterprise/EnterpriseInquiryForm";
import { SSO_CONTRACT } from "@/lib/enterprise/enterprise-contract";

export const metadata: Metadata = generateSeoMetadata("/enterprise/sso");

export default function EnterpriseSsoPage() {
  return (
    <>
      <JsonLdForRoute path="/enterprise/sso" />
      <main id="main">
        <section className="hero" style={{ paddingBottom: "40px" }}>
          <div className="wrap" style={{ maxWidth: "820px" }}>
            <span className="eyebrow">Enterprise Exclusive · SSO</span>
            <h1>
              SSO / IdP federation
              <br />
              <span className="serif-i">contracted per tenant</span>
            </h1>
            <p className="lede">
              Enterprise tenants federate Microsoft Entra ID, Google Workspace, or Okta. Session
              remains server-verified — SSO never replaces case ownership checks.
            </p>
            <div className="hero-ctas">
              <a className="btn btn-primary" href="#sso-inquiry">
                Request SSO enablement
              </a>
              <Link className="btn btn-ghost" href="/enterprise">
                Enterprise overview
              </Link>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="wrap">
            <div className="deliv-grid">
              <div className="deliv-card">
                <span className="fmt">PROTOCOLS</span>
                <h3>{SSO_CONTRACT.protocols.join(" · ")}</h3>
                <p>Supported under Firebase Identity Platform for Enterprise tenants.</p>
              </div>
              <div className="deliv-card">
                <span className="fmt">IdP EXAMPLES</span>
                <h3>{SSO_CONTRACT.idpExamples.join(" · ")}</h3>
                <p>Metadata and domain allow-list collected in the SOW.</p>
              </div>
              <div className="deliv-card">
                <span className="fmt">SESSION</span>
                <h3>Server cookie remains authoritative</h3>
                <p>{SSO_CONTRACT.sessionModel}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="section" style={{ background: "var(--paper-2)" }}>
          <div className="wrap" style={{ maxWidth: "820px" }}>
            <span className="eyebrow">Provisioning</span>
            <h2>How SSO goes live</h2>
            <ol className="feat-list" style={{ listStyle: "decimal", paddingLeft: "1.2rem" }}>
              {SSO_CONTRACT.provisioningSteps.map((step) => (
                <li key={step} style={{ marginBottom: "10px" }}>
                  {step}
                </li>
              ))}
            </ol>
            <div className="notice" style={{ marginTop: "18px" }}>
              <b>Not included on Single Pack:</b> {SSO_CONTRACT.notIncluded.join(" · ")}
            </div>
          </div>
        </section>

        <section className="section" id="sso-inquiry">
          <div className="wrap" style={{ maxWidth: "720px" }}>
            <h2>Request SSO scoping</h2>
            <EnterpriseInquiryForm source="enterprise" defaultSso defaultSla />
          </div>
        </section>

        <AeoPageChrome path="/enterprise/sso" answerHeading="SSO answers" answerLimit={6} />
      </main>
    </>
  );
}
