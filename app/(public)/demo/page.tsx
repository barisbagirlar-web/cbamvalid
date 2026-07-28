import type { Metadata } from "next";
import Link from "next/link";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { JsonLdForRoute } from "@/components/seo/JsonLdForRoute";
import { AeoPageChrome } from "@/components/seo/AnswerEvidenceSection";
import { CANONICAL_PRICING } from "@/lib/billing/pricing-config";

export const metadata: Metadata = generateSeoMetadata("/demo");

export default function DemoPage() {
  return (
    <>
      <JsonLdForRoute path="/demo" />
      <main id="main">
        <section className="hero" style={{ paddingBottom: "40px" }}>
          <div className="wrap" style={{ maxWidth: "820px" }}>
            <span className="eyebrow">Enterprise &amp; Annual · Human path</span>
            <h1>
              Book a demo
              <br />
              <span className="serif-i">self-serve is not the only door</span>
            </h1>
            <p className="lede">
              Single Pack remains self-serve at {CANONICAL_PRICING.priceFormatted} pay-at-lock. Annual and
              Enterprise buyers speak with a human — scope, DPA, SSO, and verifier coordination are
              not checkbox purchases.
            </p>
            <div className="hero-ctas">
              <a
                className="btn btn-primary"
                href="mailto:info@cbamvalid.com?subject=CBAMValid%20demo%20request"
              >
                Email info@cbamvalid.com
              </a>
              <Link className="btn btn-ghost" href="/pricing">
                See public pricing
              </Link>
              <Link className="btn btn-ghost" href="/sample-dossier">
                Inspect sample dossier
              </Link>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="wrap">
            <div className="deliv-grid">
              <div className="deliv-card">
                <span className="fmt">COME WITH</span>
                <h3>What to prepare</h3>
                <p>Installation count, reporting year, CN family, and whether you need Annual or Enterprise.</p>
              </div>
              <div className="deliv-card">
                <span className="fmt">WE SHOW</span>
                <h3>What you will see</h3>
                <p>Working-file flow, QC blockers, seal integrity, buyer share link, and independence boundary.</p>
              </div>
              <div className="deliv-card">
                <span className="fmt">BOUNDARY</span>
                <h3>What we will not claim</h3>
                <p>No accredited verification opinion, EU approval, or customs acceptance during the demo.</p>
              </div>
            </div>
          </div>
        </section>

        <AeoPageChrome path="/demo" answerHeading="Demo answers" answerLimit={2} />
      </main>
    </>
  );
}
