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
              About CBAMValid — <span className="serif-i">Self-Service CBAM Software</span>
            </h1>
            <p className="lede">
              CBAMValid is a self-service software platform operated by SectorCalc Corporation.
              Customers enter and control their own data. The software runs deterministic calculations,
              automated quality checks, evidence-linking controls and digital export generation.
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
            <h2>Self-service software for customer-controlled CBAM evidence</h2>
            <p>
              CBAMValid is a software platform for entering CBAM production data, running deterministic
              calculations and automated quality controls, linking customer-controlled evidence and
              generating downloadable digital files. No CBAMValid employee prepares, reviews or approves
              customer work as part of the product.
            </p>
          </div>
          <div className="authority-empathy reveal" role="note">
            <p className="authority-empathy-label">Boundary</p>
            <p>
              CBAMValid does not sell consulting, advisory services, manual preparation, evidence
              approval, managed compliance, legal advice, customs advice, tax advice, expert access or
              accredited verification.
            </p>
          </div>
          <div className="academic-card reveal" style={{ marginTop: "28px" }}>
            <div className="academic-badge" aria-hidden="true">
              IIT
            </div>
            <div>
              <h3>Prior academic assessment</h3>
              <p>
                A prior independent academic assessment evaluated selected software calculation logic
                during product development. It is not included in the purchase, does not review customer
                files, and does not provide customers with consulting, advice, verification or expert
                access. It is not an accredited CBAM verification opinion.
              </p>
              <div className="who">
                <b>Prof. Dr. Neela Nataraj</b>
                <span>Department of Mathematics · Indian Institute of Technology Bombay (IIT Bombay)</span>
              </div>
            </div>
          </div>
          <p style={{ marginTop: "28px" }}>
            <Link className="btn btn-ghost" href="/contact">
              Contact software support <span className="arr">→</span>
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
