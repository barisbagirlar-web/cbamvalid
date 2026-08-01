import type { Metadata } from "next";
import Link from "next/link";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { JsonLdForRoute } from "@/components/seo/JsonLdForRoute";
import { AeoPageChrome } from "@/components/seo/AnswerEvidenceSection";
import {
  ILLUSTRATIVE_SCENARIOS,
  ILLUSTRATIVE_SCENARIOS_PUBLIC,
} from "@/lib/marketing/illustrative-scenarios";

export const metadata: Metadata = generateSeoMetadata("/case-studies");

export default function CaseStudiesPage() {
  return (
    <>
      <JsonLdForRoute path="/case-studies" />
      <main id="main">
        <section className="hero" style={{ paddingBottom: "48px" }}>
          <div className="wrap" style={{ maxWidth: "920px" }}>
            <span className="eyebrow">{ILLUSTRATIVE_SCENARIOS_PUBLIC.eyebrow}</span>
            <h1>
              Field scenarios
              <br />
              <span className="serif-i">anonymized on purpose</span>
            </h1>
            <p className="lede">{ILLUSTRATIVE_SCENARIOS_PUBLIC.lede}</p>
            <p className="aeo-lead">
              <strong>Boundary:</strong> {ILLUSTRATIVE_SCENARIOS_PUBLIC.boundary}
            </p>
            <div className="hero-ctas">
              <Link className="btn btn-primary" href="/sample-dossier">
                Inspect the sample dossier
              </Link>
              <Link className="btn btn-ghost" href="/product">
                Product capabilities
              </Link>
              <Link className="btn btn-ghost" href="/demo">
                Product Demo
              </Link>
            </div>
          </div>
        </section>

        <section className="section" style={{ background: "var(--paper-2)" }}>
          <div className="wrap">
            <div className="section-head center">
              <span className="eyebrow">Four sectors · zero invented logos</span>
              <h2>What the working-file path looks like under buyer pressure</h2>
            </div>
            <div className="scenario-grid">
              {ILLUSTRATIVE_SCENARIOS.map((scenario) => (
                <article key={scenario.id} className="scenario-card">
                  <div className="scenario-card-top">
                    <span className="scenario-sector">{scenario.sectorLabel}</span>
                    <span className="scenario-alias">{scenario.alias}</span>
                  </div>
                  <h3>The pressure</h3>
                  <p>{scenario.pressure}</p>
                  <h3>Path taken</h3>
                  <ol className="scenario-steps">
                    {scenario.pathTaken.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  <h3>Outcome shape</h3>
                  <p>{scenario.outcomeShape}</p>
                  <p className="scenario-commercial">{scenario.commercialUnit}</p>
                  <p className="scenario-boundary">{scenario.independenceNote}</p>
                </article>
              ))}
            </div>
            <div className="notice" style={{ marginTop: "28px", maxWidth: "820px", marginInline: "auto" }}>
              <b>Named references:</b> still require written permission for company name, logo, and a
              measurable outcome. Until then we publish anonymized scenarios only — not fake
              testimonials.
            </div>
          </div>
        </section>

        <AeoPageChrome path="/case-studies" answerHeading="Scenario answers" answerLimit={3} />
      </main>
    </>
  );
}
