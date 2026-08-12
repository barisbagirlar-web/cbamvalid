import { legalConfig } from "@/lib/legal-config";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { JsonLdForRoute } from "@/components/seo/JsonLdForRoute";
import { AuthorityChainSection, AuthorityLead } from "@/components/seo/AuthorityChain";
import { AeoPageChrome } from "@/components/seo/AnswerEvidenceSection";

export const metadata = generateSeoMetadata("/contact");

const SUPPORT_REASONS = [
  "Account access",
  "Billing or Paddle transaction",
  "Reproducible software defect",
  "File-generation failure",
  "Security",
  "Privacy",
];

export default function ContactPage() {
  return (
    <main id="main">
      <JsonLdForRoute path="/contact" />

      <section className="hero" style={{ paddingBottom: "48px" }}>
        <div className="wrap">
          <div style={{ maxWidth: "720px" }}>
            <span className="eyebrow">Contact</span>
            <h1>
              Software Support
            </h1>
            <p className="lede">
              CBAMValid support is limited to account, billing, security, privacy and technical
              operation of the software. Legal and privacy requests use the dedicated contacts below.
            </p>
            <AuthorityLead path="/contact" />
          </div>
        </div>
      </section>

      <AuthorityChainSection path="/contact" />

      <section className="section" style={{ background: "var(--paper-2)" }}>
        <div className="wrap" style={{ maxWidth: "760px" }}>
          <div className="method-grid">
            <div className="method-card reveal">
              <h3>Software Support</h3>
              <p>For account, billing, security, privacy and technical operation of the software:</p>
              <ul className="feat-list" style={{ marginTop: "12px" }}>
                {SUPPORT_REASONS.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
              <p>
                <a className="text-accent" href={`mailto:${legalConfig.supportEmail}`}>
                  {legalConfig.supportEmail}
                </a>
              </p>
              <span className="ref">TYPICAL RESPONSE · 24–48 BUSINESS HOURS</span>
              <p style={{ marginTop: "10px" }}>
                Priority targets (P0–P3) and the honesty boundary vs uptime warranties are published
                on <a href="/security">Security</a>. Dependency status:{" "}
                <a href="/status">/status</a>.
              </p>
            </div>
            <div className="method-card reveal">
              <h3>Legal &amp; privacy</h3>
              <p>For data subject requests, GDPR inquiries, or legal concerns:</p>
              <ul className="feat-list" style={{ marginTop: "12px" }}>
                <li>
                  <strong>Legal:</strong>{" "}
                  <a href={`mailto:${legalConfig.legalEmail}`}>{legalConfig.legalEmail}</a>
                </li>
                <li>
                  <strong>Privacy:</strong>{" "}
                  <a href={`mailto:${legalConfig.privacyEmail}`}>{legalConfig.privacyEmail}</a>
                </li>
              </ul>
            </div>
            <div className="method-card reveal">
              <h3>Company information</h3>
              <div className="font-mono" style={{ fontSize: "0.9rem", lineHeight: 1.55 }}>
                {legalConfig.identityPublication.lines.map((line) => (
                  <p key={line} style={{ margin: "2px 0" }}>
                    {line}
                  </p>
                ))}
              </div>
            </div>
          </div>
          <div className="notice" style={{ marginTop: "24px" }}>
            <b>Support boundary:</b> CBAMValid support is limited to account, billing, security,
            privacy and technical operation of the software. Support does not review customer
            emissions data, approve evidence, prepare dossiers, recommend methodologies, interpret
            regulations for a customer or issue verification opinions.
          </div>
        </div>
      </section>

      <AeoPageChrome
        path="/contact"
        showAuthorityChain={false}
        answerHeading="Contact answers with evidence"
        answerLimit={1}
      />
    </main>
  );
}
