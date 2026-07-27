"use client";

import React from 'react';
import { useClassReveal } from '@/components/marketing/MarketingUi';
import { AeoPageChrome } from '@/components/seo/AnswerEvidenceSection';

export default function Page() {
  useClassReveal();

  return (
    <main id="main">
      

  <section className="hero" style={{"paddingBottom":"64px"}}>
    <div className="wrap">
      <div style={{"maxWidth":"720px"}}>
        <span className="eyebrow">Product</span>
        <h1>The dossier workspace built for <span className="serif-i">CBAM exporters</span></h1>
        <p className="lede">One guided environment to enter production data, link evidence, resolve quality findings and seal a verifier-preparation package — without spreadsheets, email threads or version chaos.</p>
        <p className="aeo-lead">
          <strong>If you are under buyer pressure:</strong> start a free draft, close the blockers you can see, then buy one USD 249 scoped pack when you are ready to seal. You are preparing for independent review — not buying a fake “verified” stamp.
        </p>
        <div className="hero-ctas" style={{"marginTop":"30px"}}>
          <a className="btn btn-primary btn-lg" href="/register?next=/cases/new">Start a Dossier <span className="arr">→</span></a>
          <a className="btn btn-ghost btn-lg" href="/sample-dossier">See a Sealed Sample</a>
        </div>
      </div>
    </div>
  </section>

  <section className="section" style={{"background":"var(--paper-2)"}}>
    <div className="wrap">
      <div className="section-head reveal">
        <span className="eyebrow">Core Capabilities</span>
        <h2>Engineered for verification readiness</h2>
      </div>
      <div className="method-grid">
        <div className="method-card reveal">
          <h3>Deterministic calculation engine</h3>
          <p>Every figure is reproducible: same inputs, same outputs, every time. The full calculation trace expands to formulas, emission factors and source references — exactly what an accredited verifier asks for first.</p>
          <span className="ref">ENGINE · REPLAYABLE</span>
        </div>
        <div className="method-card reveal">
          <h3>Evidence register</h3>
          <p>Invoices, meter logs, lab analyses and supplier declarations are linked directly to the calculation nodes they support — so evidence coverage is visible, not assumed.</p>
          <span className="ref">16 NODE TYPES</span>
        </div>
        <div className="method-card reveal">
          <h3>Real-time quality controls</h3>
          <p>148 automated checks run continuously against EU guidance: unit consistency, boundary completeness, allocation balance and default-value flagging. Blockers must be resolved before sealing.</p>
          <span className="ref">148 CHECKS · ALWAYS ON</span>
        </div>
        <div className="method-card reveal">
          <h3>O3CI field-mapped export</h3>
          <p>Your emissions data maps field-by-field to the installation communication template circulating in EU supply chains — no re-typing by your buyer, no transcription errors.</p>
          <span className="ref">XLSX · FIELD-MAPPED</span>
        </div>
        <div className="method-card reveal">
          <h3>Versioned EU rulesets</h3>
          <p>Calculations pin to a named ruleset version (e.g. CBAM-DEFINITIVE-2026.1). When the EU updates its methods, your sealed dossier still shows exactly which rules it was built against.</p>
          <span className="ref">REGULATION (EU) 2023/956</span>
        </div>
        <div className="method-card reveal">
          <h3>Integrity manifest &amp; sealing</h3>
          <p>On sealing, every deliverable is hashed (SHA-256) and timestamped. Anyone holding your dossier can confirm it was never altered after the seal.</p>
          <span className="ref">SHA-256 · UTC SEAL</span>
        </div>
      </div>
    </div>
  </section>

  <section className="section">
    <div className="wrap">
      <div className="section-head center reveal">
        <span className="eyebrow">Inside the Workspace</span>
        <h2>Case readiness, at a glance</h2>
      </div>
      <div className="ui-mock reveal">
        <div className="ui-mock-bar"><i></i><i></i><i></i><span>cbamvalid.com — Case Readiness</span></div>
        <div className="ui-mock-body">
          <div className="ui-panel">
            <h4>What the workspace tracks</h4>
            <ul className="ui-list">
              <li>Completion across all eight workflow stages</li>
              <li>Blockers that must be resolved before sealing</li>
              <li>Warnings with plain-language guidance</li>
              <li>Remaining sealed releases in your pack</li>
            </ul>
          </div>
          <div className="ui-panel">
            <h4>Case Readiness</h4>
            <div className="qc-grid">
              <div className="qc-box"><div className="v terra">86%</div><div className="k">Completion</div></div>
              <div className="qc-box"><div className="v ok">0</div><div className="k">Blockers</div></div>
              <div className="qc-box"><div className="v warn">2</div><div className="k">Warnings</div></div>
              <div className="qc-box"><div className="v navy">5</div><div className="k">Sealed releases</div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <AeoPageChrome path="/product" answerHeading="Product answers with evidence" answerLimit={2} />

  <section className="cta-band">
    <div className="wrap">
      <h2>Build your first case <span className="serif-i">free of charge</span></h2>
      <p>Draft free. Buy the USD 249 pack once for one installation and one reporting year — five sealed releases, no subscription.</p>
      <a className="btn btn-primary btn-lg" href="/register?next=/cases/new">Start a Dossier <span className="arr">→</span></a>
    </div>
  </section>


    </main>
  );
}