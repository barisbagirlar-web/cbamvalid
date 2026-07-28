import type { Metadata } from "next";
import Link from "next/link";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { JsonLdForRoute } from "@/components/seo/JsonLdForRoute";
import { AeoPageChrome } from "@/components/seo/AnswerEvidenceSection";
import { EnterpriseInquiryForm } from "@/components/enterprise/EnterpriseInquiryForm";
import { PARTNER_PROGRAM } from "@/lib/enterprise/enterprise-contract";

export const metadata: Metadata = generateSeoMetadata("/partners");

export default function PartnersPage() {
  return (
    <>
      <JsonLdForRoute path="/partners" />
      <main id="main">
        <section className="hero" style={{ paddingBottom: "40px" }}>
          <div className="wrap" style={{ maxWidth: "820px" }}>
            <span className="eyebrow">Channel · {PARTNER_PROGRAM.status}</span>
            <h1>
              Partner program
              <br />
              <span className="serif-i">intake live — logos only after contract</span>
            </h1>
            <p className="lede">{PARTNER_PROGRAM.summary}</p>
            <div className="hero-ctas">
              <a className="btn btn-primary" href="#partner-inquiry">
                Request partner track
              </a>
              <Link className="btn btn-ghost" href="/enterprise">
                Enterprise Exclusive
              </Link>
              <Link className="btn btn-ghost" href="/sample-dossier">
                Sample dossier
              </Link>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="wrap">
            <div className="deliv-grid">
              <div className="deliv-card">
                <span className="fmt">WHO</span>
                <h3>Verifier firms &amp; consultancies</h3>
                <p>Structure-fit package referrals — never sold as accredited opinions.</p>
              </div>
              <div className="deliv-card">
                <span className="fmt">WHO</span>
                <h3>Trade associations</h3>
                <p>Exporter onboarding cohorts under a referral agreement.</p>
              </div>
              <div className="deliv-card">
                <span className="fmt">H2</span>
                <h3>No invented partner wall</h3>
                <p>Public logos appear only after a signed agreement and written permission.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="partner-inquiry" style={{ background: "var(--paper-2)" }}>
          <div className="wrap" style={{ maxWidth: "720px" }}>
            <h2>Partner inquiry</h2>
            <EnterpriseInquiryForm source="partners" />
          </div>
        </section>

        <AeoPageChrome path="/partners" answerHeading="Partner answers" answerLimit={6} />
      </main>
    </>
  );
}
