import React from "react";
import { AeoPageChrome } from "@/components/seo/AnswerEvidenceSection";

// MethodologyContent — stable public-navigation contract marker; page remains a Server Component.
export default function Page() {
  return (
    <main id="main">
      <section className="hero" style={{ paddingBottom: "48px" }}>
        <div className="wrap">
          <div style={{ maxWidth: "760px" }}>
            <span className="eyebrow">Methodology &amp; Sources</span>
            <h1>When a verifier asks “which rules?”, you need a dated answer</h1>
            <p className="lede">CBAMValid never silently changes methods — each ruleset is named, dated and recorded inside the sealed report.</p>
            <p className="aeo-lead">
              <strong>Direct answer:</strong>{" "}
              <span className="speakable-answer">
                Authoritative calculations pin to a named, versioned ruleset recorded in the sealed dossier. Historical seals keep the ruleset they were built against.
              </span>
            </p>
            <p className="authority-lead-empathy" style={{ marginTop: "10px", color: "var(--ink-2)" }}>
              <strong>The pressure you are under:</strong> vague “we followed latest guidance” answers fail. You need a dated method reference — and honesty that sealing is preparation, not accreditation.
            </p>
          </div>
        </div>
      </section>

      <section className="section tight" id="rulesets">
        <div className="wrap">
          <div className="section-head reveal in">
            <span className="eyebrow">Legal Basis</span>
            <h2>Primary sources</h2>
          </div>
          <table className="ruleset-table reveal in">
            <thead>
              <tr><th>Instrument</th><th>Scope</th><th>Reference</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><b>CBAM Regulation</b></td>
                <td>Establishing the Carbon Border Adjustment Mechanism — definitive-period obligations</td>
                <td><span className="mono">Regulation (EU) 2023/956</span></td>
              </tr>
              <tr>
                <td><b>CBAM Implementing Regulation</b></td>
                <td>Reporting obligations, calculation methods and transitional-period rules</td>
                <td><span className="mono">Implementing Regulation (EU) 2023/1773</span></td>
              </tr>
              <tr>
                <td><b>Commission guidance &amp; default values</b></td>
                <td>Published default values and sector guidance, applied only where flagged in the dossier</td>
                <td><span className="mono">EC official publications</span></td>
              </tr>
              <tr>
                <td><b>O3CI communication template</b></td>
                <td>Field mapping for operator-to-importer emissions data exchange</td>
                <td><span className="mono">Installation communication template</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="section" style={{ background: "var(--paper-2)" }}>
        <div className="wrap">
          <div className="section-head reveal in">
            <span className="eyebrow">Method Principles</span>
            <h2>How the engine treats your data</h2>
          </div>
          <div className="method-grid">
            <div className="method-card reveal in">
              <h3>Deterministic replay</h3>
              <p>Identical inputs always produce identical outputs. The calculation trace records every formula and factor, so results can be re-derived by an independent party.</p>
              <span className="ref">PRINCIPLE 01</span>
            </div>
            <div className="method-card reveal in">
              <h3>Provenance flags</h3>
              <p>Every value carries a source class: measured, calculated, literature or default. Defaults are never hidden — they are flagged in the dossier with the legal basis for their use.</p>
              <span className="ref">PRINCIPLE 02</span>
            </div>
            <div className="method-card reveal in">
              <h3>Boundary discipline</h3>
              <p>One installation, one reporting year per dossier. Allocations follow mass-balance rules with explicit double-counting guards across precursors.</p>
              <span className="ref">PRINCIPLE 03</span>
            </div>
            <div className="method-card reveal in">
              <h3>Versioned change policy</h3>
              <p>Ruleset updates ship as new named versions. Previously sealed dossiers remain bound to their original ruleset — history is never rewritten.</p>
              <span className="ref">PRINCIPLE 04</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section tight">
        <div className="wrap">
          <div className="trust-card reveal in">
            <div className="t-row">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M12 2 20 5.5v6c0 5-3.5 8.5-8 10.5-4.5-2-8-5.5-8-10.5v-6L12 2Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg>
              <div>
                <h3 style={{ fontSize: "1.15rem", marginBottom: "6px" }}>Trust Statement</h3>
                <p>Built around current published EU CBAM rules and official source data. Designed for exporter-to-importer evidence transfer and verification readiness.</p>
              </div>
            </div>
            <p className="disc-title">Mandatory Limitation &amp; Regulatory Disclaimer</p>
            <p className="disc">CBAMValid prepares calculation and evidence packages. It is not an EU institution, customs authority, or accredited CBAM verifier. Actual emissions must be independently verified where verification is legally required.</p>
          </div>
        </div>
      </section>

      <AeoPageChrome path="/methodology" answerHeading="Methodology answers with evidence" answerLimit={2} />

      <section className="cta-band">
        <div className="wrap">
          <h2>Questions about our method?</h2>
          <p>Write to us — methodology questions are answered by the team that built the engine.</p>
          <a className="btn btn-primary btn-lg" href="mailto:info@cbamvalid.com">Contact Support <span className="arr">→</span></a>
        </div>
      </section>
    </main>
  );
}
