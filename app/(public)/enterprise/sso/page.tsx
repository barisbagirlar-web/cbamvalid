import type { Metadata } from "next";
import Link from "next/link";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { JsonLdForRoute } from "@/components/seo/JsonLdForRoute";
import { AeoPageChrome } from "@/components/seo/AnswerEvidenceSection";
import { EnterpriseInquiryForm } from "@/components/enterprise/EnterpriseInquiryForm";
import { SSO_CONTRACT } from "@/lib/enterprise/enterprise-contract";

export const metadata: Metadata = generateSeoMetadata("/enterprise/sso");

const CUTOVER_STEPS = [
  {
    n: "01",
    title: "IdP login",
    body: "Employee signs in at Entra, Google, or Okta — your company login, not a new CBAMValid password.",
  },
  {
    n: "02",
    title: "Assertion",
    body: "IdP sends a signed OIDC/SAML assertion proving who they are and which email domain they belong to.",
  },
  {
    n: "03",
    title: "Identity Platform",
    body: "Firebase Identity Platform accepts the assertion for that Enterprise tenant only.",
  },
  {
    n: "04",
    title: "Server session",
    body: "CBAMValid creates an HttpOnly __session cookie. Browser tokens are never trusted alone.",
  },
  {
    n: "05",
    title: "Tenant checks",
    body: "Every case, evidence object, and download still checks ownership — SSO does not widen seal scope.",
  },
] as const;

export default function EnterpriseSsoPage() {
  return (
    <>
      <JsonLdForRoute path="/enterprise/sso" />
      <main id="main">
        <section className="hero" style={{ paddingBottom: "40px" }}>
          <div className="wrap" style={{ maxWidth: "860px" }}>
            <span className="eyebrow">Enterprise Exclusive · SSO</span>
            <h1>
              SSO / IdP federation
              <br />
              <span className="serif-i">plain English, then the cutover</span>
            </h1>
            <p className="lede">
              Enterprise buyers log in with their company identity provider. We simulate the cutover
              path here so procurement can see the flow before the first tenant is wired.
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

        <section className="section" style={{ background: "var(--paper-2)" }}>
          <div className="wrap">
            <div className="section-head center">
              <span className="eyebrow">Glossary · 30 seconds</span>
              <h2>What IdP and MSA mean</h2>
            </div>
            <div className="sso-plain">
              <div className="sso-plain-card">
                <strong>IdP = Identity Provider</strong>
                <p>
                  Your company login system — Microsoft Entra ID (Azure AD), Google Workspace, or
                  Okta. Staff already use it for email and apps. Enterprise SSO connects CBAMValid to
                  that IdP so preparers do not invent another password.
                </p>
              </div>
              <div className="sso-plain-card">
                <strong>MSA = Master Service Agreement</strong>
                <p>
                  The signed Enterprise contract that covers pricing, SLA, DPA, and which domains /
                  entities are in scope. SSO is enabled after the MSA/SOW — not on self-serve Single
                  Pack.
                </p>
              </div>
            </div>
            <div className="notice" style={{ maxWidth: "820px", marginInline: "auto" }}>
              <b>Simulation vs live tenant:</b> The flow below is the contracted cutover model. A real
              Entra/Okta/Google binding is provisioned when the first Enterprise customer closes —
              same pattern competitors show before a named IdP is connected.
            </div>
          </div>
        </section>

        <section className="section">
          <div className="wrap">
            <div className="section-head center">
              <span className="eyebrow">Cutover simulation</span>
              <h2>How login works after SSO is enabled</h2>
            </div>
            <div className="sso-flow">
              {CUTOVER_STEPS.map((step) => (
                <div key={step.n} className="sso-flow-step">
                  <div className="n">{step.n}</div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section" style={{ background: "var(--paper-2)" }}>
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

        <section className="section">
          <div className="wrap" style={{ maxWidth: "820px" }}>
            <span className="eyebrow">Provisioning checklist</span>
            <h2>How SSO goes live for a real tenant</h2>
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

        <section className="section" id="sso-inquiry" style={{ background: "var(--paper-2)" }}>
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
