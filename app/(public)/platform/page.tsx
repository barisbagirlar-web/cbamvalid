import Link from "next/link";
import { AeoPageChrome } from "@/components/seo/AnswerEvidenceSection";

export default function PlatformPage() {
  return (
    <main id="main">
      <section className="hero" style={{ paddingBottom: "40px" }}>
        <div className="wrap" style={{ maxWidth: "820px" }}>
          <span className="eyebrow">R9 · Category architecture</span>
          <h1>
            Door = CBAM.
            <br />
            <span className="serif-i">Room is larger.</span>
          </h1>
          <p className="lede">
            CBAMValid is not only a calculator. It is a sealed, evidence-linked, version-pinned
            compliance package architecture. The first live ruleset family is EU CBAM. Additional
            regimes reuse the same package contract — they are not opened until CBAM leadership and
            recurring revenue justify them.
          </p>
          <div className="hero-ctas">
            <Link className="btn btn-primary" href="/rulesets">
              Open published CBAM rulesets
            </Link>
            <Link className="btn btn-ghost" href="/product">
              Product
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="deliv-grid">
            <div className="deliv-card">
              <span className="fmt">LIVE</span>
              <h3>EU CBAM definitive package</h3>
              <p>
                Operator dossier, evidence lineage, QC gates, ruleset pin, integrity hashes, buyer
                verify link.
              </p>
            </div>
            <div className="deliv-card">
              <span className="fmt">ARCHITECTURE</span>
              <h3>Reusable package contract</h3>
              <p>
                Same seal model can accept another ruleset family without forking the core product —
                only when opening conditions are met.
              </p>
            </div>
            <div className="deliv-card">
              <span className="fmt">NOT OPEN</span>
              <h3>Second-category product</h3>
              <p>
                No second regulated category is sold here yet. Launching another half-product before
                CBAM leadership is explicitly out of scope.
              </p>
            </div>
          </div>
          <div className="notice" style={{ marginTop: "28px" }}>
            <b>Honest status:</b> R9 is an architecture statement and dependency rule — not a claim
            that EUDR, CSRD, or Digital Product Passport products are live.
          </div>
        </div>
      </section>

      <AeoPageChrome path="/platform" answerHeading="Platform answers" answerLimit={2} />
    </main>
  );
}
