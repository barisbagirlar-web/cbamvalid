import Link from "next/link";
import { AeoPageChrome } from "@/components/seo/AnswerEvidenceSection";
import { SealSignatureMark } from "@/components/marketing/SealSignatureMark";

export default function BuyerLinkPage() {
  return (
    <main id="main">
      <section className="hero" style={{ paddingBottom: "40px" }}>
        <div className="wrap" style={{ maxWidth: "820px" }}>
          <span className="eyebrow">Buyer share link</span>
          <h1>
            One link for the buyer.
            <br />
            <span className="serif-i">Integrity, not assurance.</span>
          </h1>
          <p className="lede">
            After lock, CBAMValid issues a public token URL. Short form:{" "}
            <span className="mono">/d/&lt;token&gt;</span>. Canonical form:{" "}
            <span className="mono">/verify/&lt;token&gt;</span>. Both open the same sealed release
            summary. Every view and download is logged for the exporter (append-only).
          </p>
          <div className="hero-ctas">
            <Link className="btn btn-primary" href="/verify">
              Open public verify
            </Link>
            <Link className="btn btn-ghost" href="/sample-dossier">
              Inspect sample dossier
            </Link>
            <Link className="btn btn-ghost" href="/demo">
              Book a demo
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="deliv-grid">
            <div className="deliv-card">
              <span className="fmt">STEP 1</span>
              <h3>Operator seals a working file</h3>
              <p>Pay-at-lock creates an immutable release with integrity hashes and package files.</p>
            </div>
            <div className="deliv-card">
              <span className="fmt">STEP 2</span>
              <h3>Share the token URL</h3>
              <p>
                Send <span className="mono">https://cbamvalid.com/d/&lt;token&gt;</span> to the EU
                buyer. Opaque 64-hex token — not enumerable.
              </p>
            </div>
            <div className="deliv-card">
              <span className="fmt">STEP 3</span>
              <h3>Buyer checks integrity</h3>
              <p>
                Scope, emissions summary, ruleset pin, SHA-256, and ZIP download. CBAMValid branding
                remains visible — the unpaid viral loop.
              </p>
            </div>
            <div className="deliv-card">
              <span className="fmt">AUDIT</span>
              <h3>Every open is logged</h3>
              <p>
                Append-only <span className="mono">buyer_share_events</span> with truncated UA and
                hashed IP. No buyer login required for the public token view.
              </p>
            </div>
          </div>
          <div style={{ marginTop: "32px", display: "flex", justifyContent: "center" }}>
            <SealSignatureMark />
          </div>
          <div className="notice" style={{ marginTop: "28px" }}>
            <b>Boundary:</b> A successful token open proves package integrity and operator
            preparation status only. Independent accredited verification remains a separate legal
            act where required. New seals supersede prior public tokens; revoke-on-demand follows
            the same ACTIVE → SUPERSEDED state machine.
          </div>
        </div>
      </section>

      <AeoPageChrome path="/buyer-link" answerHeading="Buyer link answers" answerLimit={2} />
    </main>
  );
}
