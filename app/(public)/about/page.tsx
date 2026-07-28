import Link from "next/link";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { JsonLdForRoute } from "@/components/seo/JsonLdForRoute";
import { AuthorityChainSection, AuthorityLead } from "@/components/seo/AuthorityChain";
import { AeoPageChrome } from "@/components/seo/AnswerEvidenceSection";

export const metadata = generateSeoMetadata("/about");

export default function AboutPage() {
  return (
    <main id="main">
      <JsonLdForRoute path="/about" />

      <section className="hero" style={{ paddingBottom: "48px" }}>
        <div className="wrap">
          <div style={{ maxWidth: "720px" }}>
            <span className="eyebrow">About</span>
            <h1>
              Independent CBAM preparation — <span className="serif-i">with clear limits</span>
            </h1>
            <p className="lede">
              When buyers ask who stands behind your emissions package, they need independence language
              you can defend — not a fake official seal.
            </p>
            <AuthorityLead path="/about" />
          </div>
        </div>
      </section>

      <AuthorityChainSection path="/about" />

      <section className="section" style={{ background: "var(--paper-2)" }}>
        <div className="wrap" style={{ maxWidth: "760px" }}>
          <div className="section-head reveal">
            <span className="eyebrow">Mission</span>
            <h2>Help exporters hand over evidence they can explain</h2>
            <p>
              CBAMValid assists exporters and importers in compiling embedded-emissions data into an
              operator-prepared dossier aligned to published EU CBAM methodological expectations —
              without claiming accredited verification or Registry acceptance.
            </p>
          </div>
          <div className="authority-empathy reveal" role="note">
            <p className="authority-empathy-label">Independence notice</p>
            <p>
              CBAMValid is an independent software service and is not an official European Commission or
              CBAM Registry service.
            </p>
          </div>
          <div className="academic-card reveal" style={{ marginTop: "28px" }}>
            <div className="academic-badge" aria-hidden="true">
              IIT
            </div>
            <div>
              <h3>Academic mathematical review</h3>
              <p>
                Calculation engines and allocation logic are reviewed against EU CBAM mathematical rules.
                That review supports mathematical integrity — it is not an accredited CBAM verification
                opinion.
              </p>
              <div className="who">
                <b>Prof. Dr. Neela Nataraj</b>
                <span>Department of Mathematics · Indian Institute of Technology Bombay (IIT Bombay)</span>
              </div>
            </div>
          </div>
          <p style={{ marginTop: "28px" }}>
            <Link className="btn btn-ghost" href="/contact">
              Contact support <span className="arr">→</span>
            </Link>
          </p>
        </div>
      </section>

      <AeoPageChrome
        path="/about"
        showAuthorityChain={false}
        answerHeading="About answers buyers and AI systems can cite"
        answerLimit={2}
      />
    </main>
  );
}
