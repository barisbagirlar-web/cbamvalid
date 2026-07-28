import type { Metadata } from "next";
import Link from "next/link";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { JsonLdForRoute } from "@/components/seo/JsonLdForRoute";
import { AeoPageChrome } from "@/components/seo/AnswerEvidenceSection";
import { AuthorityRail } from "@/components/marketing/AuthorityRail";
import { EnterpriseInquiryForm } from "@/components/enterprise/EnterpriseInquiryForm";
import {
  ENTERPRISE_MODULES,
  ENTERPRISE_PRICING,
  ENTERPRISE_PUBLIC,
  PLATFORM_MODULES_R6_R9,
  SLA_DRAFT,
} from "@/lib/enterprise/enterprise-contract";

export const metadata: Metadata = generateSeoMetadata("/enterprise");

export default function EnterprisePage() {
  return (
    <>
      <JsonLdForRoute path="/enterprise" />
      <main id="main">
        <section className="hero" style={{ paddingBottom: "40px" }}>
          <div className="wrap" style={{ maxWidth: "860px" }}>
            <AuthorityRail mode="compact" eyebrow="Enterprise Exclusive" />
            <span className="eyebrow">{ENTERPRISE_PUBLIC.eyebrow}</span>
            <h1>
              Enterprise Exclusive
              <br />
              <span className="serif-i">SSO · SLA · Holding</span>
            </h1>
            <p className="lede">{ENTERPRISE_PUBLIC.lede}</p>
            <p className="price-line">
              {ENTERPRISE_PRICING.priceLabel}{" "}
              <span>{ENTERPRISE_PRICING.cadence}</span>
            </p>
            <div className="hero-ctas">
              <a className="btn btn-primary" href="#inquiry">
                Request Enterprise scoping
              </a>
              <a className="btn btn-ghost" href={SLA_DRAFT.pdfHref} download>
                Download SLA draft (PDF)
              </a>
              <Link className="btn btn-ghost" href="/security/dpa-draft.pdf">
                Download DPA draft
              </Link>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="wrap">
            <div className="section-head center">
              <span className="eyebrow">What Enterprise buys</span>
              <h2>Contracted modules — not marketing checkboxes</h2>
            </div>
            <div className="deliv-grid">
              {ENTERPRISE_MODULES.map((m) => (
                <Link key={m.id} href={m.href} className="deliv-card" style={{ textDecoration: "none", color: "inherit" }}>
                  <span className="fmt">{m.status}</span>
                  <h3>{m.title}</h3>
                  <p>{m.summary}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="sla" style={{ background: "var(--paper-2)" }}>
          <div className="wrap" style={{ maxWidth: "900px" }}>
            <div className="section-head">
              <span className="eyebrow">SLA draft · {SLA_DRAFT.version}</span>
              <h2>Support targets buyers can put in a procurement pack</h2>
              <p>{SLA_DRAFT.uptimePosture}</p>
            </div>
            <div className="deliv-grid">
              {SLA_DRAFT.targets.map((t) => (
                <div key={t.name} className="deliv-card">
                  <span className="fmt">TARGET</span>
                  <h3>{t.name}</h3>
                  <p>
                    Response: <b>{t.response}</b>
                    <br />
                    Resolution aim: <b>{t.resolutionAim}</b>
                  </p>
                </div>
              ))}
            </div>
            <div className="notice" style={{ marginTop: "20px" }}>
              <b>Draft only:</b> Credits and binding terms live in the signed Enterprise MSA. ISO 27001 /
              SOC 2 are not claimed.
            </div>
            <div className="hero-ctas" style={{ marginTop: "18px" }}>
              <a className="btn btn-navy" href={SLA_DRAFT.pdfHref} download>
                Download SLA draft PDF
              </a>
              <Link className="btn btn-ghost" href="/security">
                Security &amp; DPA
              </Link>
            </div>
          </div>
        </section>

        <section className="section" id="r69">
          <div className="wrap">
            <div className="section-head center">
              <span className="eyebrow">R6–R9 · Enterprise platform modules</span>
              <h2>Live to sell — not waiting on vanity volume gates</h2>
              <p>
                Rulesets, buyer share, security/SLA, and platform architecture are published and
                usable in Enterprise deals today.
              </p>
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

        <section className="section" id="api" style={{ background: "var(--paper-2)" }}>
          <div className="wrap" style={{ maxWidth: "820px" }}>
            <span className="eyebrow">API &amp; onboarding</span>
            <h2>Scoped in the Enterprise SOW</h2>
            <p className="lede">
              Onboarding plan, installation rollout, buyer-share coordination, and API access are
              contracted — not a public free API. Single Pack remains self-serve for one working
              file.
            </p>
            <div className="hero-ctas">
              <Link className="btn btn-ghost" href="/partners">
                Channel partners
              </Link>
              <Link className="btn btn-ghost" href="/demo">
                Book a demo
              </Link>
            </div>
          </div>
        </section>

        <section className="section" id="inquiry">
          <div className="wrap" style={{ maxWidth: "720px" }}>
            <div className="section-head">
              <span className="eyebrow">Close the deal path</span>
              <h2>Request Enterprise scoping</h2>
              <p>Tell us installations, IdP, and holding structure. We respond from info@cbamvalid.com.</p>
            </div>
            <EnterpriseInquiryForm source="enterprise" defaultSso defaultHolding defaultSla />
          </div>
        </section>

        <AeoPageChrome path="/enterprise" answerHeading="Enterprise answers" answerLimit={8} />
      </main>
    </>
  );
}
