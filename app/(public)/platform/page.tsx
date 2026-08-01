import Link from "next/link";
import { AeoPageChrome } from "@/components/seo/AnswerEvidenceSection";
import { AuthorityRail } from "@/components/marketing/AuthorityRail";

const PLATFORM_MODULES = [
  {
    id: "R6",
    title: "Published Rulesets",
    href: "/rulesets",
    status: "LIVE",
    sellLine: "Version-pinned EU CBAM ruleset registry — buyers and verifiers can audit the pin.",
  },
  {
    id: "R7",
    title: "Buyer Share Link",
    href: "/buyer-link",
    status: "LIVE",
    sellLine: "Public /d/token integrity surface for EU buyers — view/download logging.",
  },
  {
    id: "R8",
    title: "Security · DPA",
    href: "/security",
    status: "LIVE",
    sellLine: "Hosting facts, TLS, session model and DPA draft — no fake ISO/SOC claims.",
  },
  {
    id: "R9",
    title: "Platform architecture",
    href: "/platform",
    status: "LIVE",
    sellLine: "CBAM door live. Additional regimes are not public half-products.",
  },
] as const;

export default function PlatformPage() {
  return (
    <main id="main">
      <section className="hero" style={{ paddingBottom: "40px" }}>
        <div className="wrap" style={{ maxWidth: "820px" }}>
          <AuthorityRail mode="compact" eyebrow="R9 · Platform architecture" />
          <span className="eyebrow">R9 · Category architecture · LIVE</span>
          <h1>
            Door = CBAM.
            <br />
            <span className="serif-i">No public half-products.</span>
          </h1>
          <p className="lede">
            CBAMValid is a sealed, evidence-linked, version-pinned compliance package architecture.
            EU CBAM is the live door. Additional regimes are not sold until CBAM leadership and
            opening conditions justify them — CBAMValid does not publish half-products.
          </p>
          <div className="hero-ctas">
            <Link className="btn btn-primary" href="/product">
              Product
            </Link>
            <Link className="btn btn-ghost" href="/rulesets">
              Published CBAM rulesets
            </Link>
            <Link className="btn btn-ghost" href="/demo">
              Product Demo
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
              <span className="fmt">SELF-SERVICE</span>
              <h3>Single Pack · pay at lock</h3>
              <p>
                USD 449 unlocks lock-and-download for one working file — one operator, one
                installation, one reporting year.
              </p>
            </div>
            <div className="deliv-card">
              <span className="fmt">NOT SOLD</span>
              <h3>Second-category expansion</h3>
              <p>
                Other regimes can reuse the package contract only when opening conditions are
                justified. No public half-product storefront.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ background: "var(--paper-2)" }}>
        <div className="wrap">
          <div className="section-head center">
            <span className="eyebrow">R6–R9 modules</span>
            <h2>Platform modules are LIVE to use</h2>
          </div>
          <div className="deliv-grid">
            {PLATFORM_MODULES.map((m) => (
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
