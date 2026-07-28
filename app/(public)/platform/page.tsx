import Link from "next/link";
import { AeoPageChrome } from "@/components/seo/AnswerEvidenceSection";
import { AuthorityRail } from "@/components/marketing/AuthorityRail";
import { PLATFORM_MODULES_R6_R9 } from "@/lib/enterprise/enterprise-contract";

export default function PlatformPage() {
  return (
    <main id="main">
      <section className="hero" style={{ paddingBottom: "40px" }}>
        <div className="wrap" style={{ maxWidth: "820px" }}>
          <AuthorityRail mode="compact" eyebrow="R9 · Enterprise platform" />
          <span className="eyebrow">R9 · Category architecture · LIVE</span>
          <h1>
            Door = CBAM.
            <br />
            <span className="serif-i">Enterprise expands the room.</span>
          </h1>
          <p className="lede">
            CBAMValid is a sealed, evidence-linked, version-pinned compliance package architecture.
            EU CBAM is the live door. Additional regimes are available only under an Enterprise
            expansion SOW — we do not sell half-products.
          </p>
          <div className="hero-ctas">
            <Link className="btn btn-primary" href="/enterprise">
              Enterprise Exclusive
            </Link>
            <Link className="btn btn-ghost" href="/rulesets">
              Published CBAM rulesets
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
                verify link — sellable today.
              </p>
            </div>
            <div className="deliv-card">
              <span className="fmt">ENTERPRISE</span>
              <h3>SSO · SLA · Holding</h3>
              <p>
                Contracted multi-site regime with IdP federation, SLA/DPA path, and holding scope —
                see /enterprise.
              </p>
            </div>
            <div className="deliv-card">
              <span className="fmt">SOW ONLY</span>
              <h3>Second-category expansion</h3>
              <p>
                Other regimes reuse the package contract only when an Enterprise expansion SOW is
                signed. No public half-product storefront.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ background: "var(--paper-2)" }}>
        <div className="wrap">
          <div className="section-head center">
            <span className="eyebrow">R6–R9 modules</span>
            <h2>Platform modules are LIVE to sell</h2>
          </div>
          <div className="deliv-grid">
            {PLATFORM_MODULES_R6_R9.map((m) => (
              <Link key={m.id} href={m.href} className="deliv-card" style={{ textDecoration: "none", color: "inherit" }}>
                <span className="fmt">
                  {m.id} · {m.status}
                </span>
                <h3>{m.title}</h3>
                <p>{m.sellLine}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <AeoPageChrome path="/platform" answerHeading="Platform answers" answerLimit={2} />
    </main>
  );
}
