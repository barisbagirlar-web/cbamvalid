import type { Metadata } from "next";
import Link from "next/link";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { JsonLdForRoute } from "@/components/seo/JsonLdForRoute";
import { AeoPageChrome } from "@/components/seo/AnswerEvidenceSection";

export const metadata: Metadata = generateSeoMetadata("/case-studies");

/**
 * Honest empty slot — H2: no invented logos or testimonials.
 * When a contracted customer grants permission, publish here with evidence.
 */
export default function CaseStudiesPage() {
  return (
    <>
      <JsonLdForRoute path="/case-studies" />
      <main id="main">
        <section className="hero" style={{ paddingBottom: "40px" }}>
          <div className="wrap" style={{ maxWidth: "820px" }}>
            <span className="eyebrow">Proof chain · Named references</span>
            <h1>
              Case studies
              <br />
              <span className="serif-i">published only with permission</span>
            </h1>
            <p className="lede">
              CBAMValid does not invent customer logos or quotes. This page stays empty until a
              real exporter grants written permission for name, logo, and a measurable outcome.
            </p>
            <div className="hero-ctas">
              <Link className="btn btn-primary" href="/sample-dossier">
                Inspect the public sample dossier
              </Link>
              <Link className="btn btn-ghost" href="/verifier-review">
                Structure review surface
              </Link>
              <Link className="btn btn-ghost" href="/demo">
                Book a demo
              </Link>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="wrap">
            <div className="deliv-card" style={{ maxWidth: "820px" }}>
              <span className="fmt">SLOT · EMPTY BY DESIGN</span>
              <h3>What a published case study will include</h3>
              <ul className="feat-list">
                <li>Company name + logo (written permission)</li>
                <li>Sector / installation count</li>
                <li>Before → after preparation time (measurable)</li>
                <li>Three-sentence quote with name and title</li>
                <li>Explicit independence boundary (not a verification opinion)</li>
              </ul>
              <div className="notice" style={{ marginTop: "18px" }}>
                <b>H2:</b> Unattributed praise strips and invented logos are forbidden until
                pinned to real, permissioned evidence.
              </div>
            </div>
          </div>
        </section>

        <AeoPageChrome path="/case-studies" answerHeading="Case study answers" answerLimit={1} />
      </main>
    </>
  );
}
