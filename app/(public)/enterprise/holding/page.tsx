import type { Metadata } from "next";
import Link from "next/link";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { JsonLdForRoute } from "@/components/seo/JsonLdForRoute";
import { AeoPageChrome } from "@/components/seo/AnswerEvidenceSection";
import { EnterpriseInquiryForm } from "@/components/enterprise/EnterpriseInquiryForm";
import { HOLDING_CONTRACT } from "@/lib/enterprise/enterprise-contract";

export const metadata: Metadata = generateSeoMetadata("/enterprise/holding");

export default function EnterpriseHoldingPage() {
  return (
    <>
      <JsonLdForRoute path="/enterprise/holding" />
      <main id="main">
        <section className="hero" style={{ paddingBottom: "40px" }}>
          <div className="wrap" style={{ maxWidth: "820px" }}>
            <span className="eyebrow">Enterprise Exclusive · Holding</span>
            <h1>
              Holding / multi-entity
              <br />
              <span className="serif-i">explicit scope, no silent widening</span>
            </h1>
            <p className="lede">
              Group exporters contract at holding level. Each sealed dossier still names one
              operator, one installation, and one reporting year — so verifiers never see a blurred
              boundary.
            </p>
            <div className="hero-ctas">
              <a className="btn btn-primary" href="#holding-inquiry">
                Request holding scoping
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
                <span className="fmt">PARENT</span>
                <h3>{HOLDING_CONTRACT.parentRole}</h3>
                <p>Counterparty for Enterprise MSA, billing, and SSO domain.</p>
              </div>
              <div className="deliv-card">
                <span className="fmt">CHILD</span>
                <h3>{HOLDING_CONTRACT.childRole}</h3>
                <p>Operators prepare dossiers under holding entitlement.</p>
              </div>
              <div className="deliv-card">
                <span className="fmt">SEAL UNIT</span>
                <h3>{HOLDING_CONTRACT.installationUnit}</h3>
                <p>Seal scope stays installation-year explicit.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="section" style={{ background: "var(--paper-2)" }}>
          <div className="wrap" style={{ maxWidth: "820px" }}>
            <span className="eyebrow">Rules</span>
            <h2>Holding contract discipline</h2>
            <ul className="feat-list">
              {HOLDING_CONTRACT.rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="section" id="holding-inquiry">
          <div className="wrap" style={{ maxWidth: "720px" }}>
            <h2>Request holding scoping</h2>
            <EnterpriseInquiryForm source="enterprise" defaultHolding defaultSla />
          </div>
        </section>

        <AeoPageChrome path="/enterprise/holding" answerHeading="Holding answers" answerLimit={2} />
      </main>
    </>
  );
}
