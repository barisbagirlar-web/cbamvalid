import { legalConfig } from "@/lib/legal-config";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { JsonLdForRoute } from "@/components/seo/JsonLdForRoute";
import { AuthorityChainSection, AuthorityLead } from "@/components/seo/AuthorityChain";
import { AeoPageChrome } from "@/components/seo/AnswerEvidenceSection";

export const metadata = generateSeoMetadata("/contact");

export default function ContactPage() {
  return (
    <main id="main">
      <JsonLdForRoute path="/contact" />

      <section className="hero" style={{ paddingBottom: "48px" }}>
        <div className="wrap">
          <div style={{ maxWidth: "720px" }}>
            <span className="eyebrow">Contact</span>
            <h1>
              Need help before a buyer deadline?{" "}
              <span className="serif-i">Write the real inbox.</span>
            </h1>
            <p className="lede">
              Technical, billing, and dossier questions go to the published support address. Legal and
              privacy requests use the dedicated legal contacts below.
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
              <h3>Support &amp; billing</h3>
              <p>
                For technical assistance, report generation issues, or Paddle payment inquiries — include
                your case ID and blocker text when possible.
              </p>
              <p>
                <a className="text-accent" href={`mailto:${legalConfig.supportEmail}`}>
                  {legalConfig.supportEmail}
                </a>
              </p>
              <span className="ref">TYPICAL RESPONSE · 24–48 BUSINESS HOURS</span>
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
