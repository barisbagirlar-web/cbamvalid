"use client";

import React from 'react';
import { useClassReveal } from '@/components/marketing/MarketingUi';
import { AeoPageChrome } from '@/components/seo/AnswerEvidenceSection';

export default function Page() {
  useClassReveal();

  return (
    <main id="main">
      

  <section className="hero" style={{"paddingBottom":"48px"}}>
    <div className="wrap" style={{"textAlign":"center"}}>
      <span className="eyebrow">The Complete Workflow</span>
      <h1 style={{"maxWidth":"820px","marginLeft":"auto","marginRight":"auto"}}>How <span className="serif-i">CBAMValid</span> works</h1>
      <p className="lede" style={{"margin":"0 auto"}}>Build a structured dossier for one installation and one reporting year. Enter production and emissions data, link supporting evidence, resolve quality findings, buy the Preparation Pack at checkout, and generate a sealed verifier-preparation package.</p>
      <p className="aeo-lead" style={{"margin":"18px auto 0"}}>
        <strong>Direct answer:</strong> Draft free → buy USD 249 once → seal up to five immutable releases inside that scope. Sealing is not accredited verification.
      </p>
    </div>
  </section>

  <section className="section tight">
    <div className="wrap">
      <div className="vsteps">
        <div className="vstep reveal"><div className="n">1</div><div className="body"><h3>Case &amp; Reporting Scope</h3><p>Define the boundaries of your CBAM declaration — one installation, one reporting year, one clear perimeter.</p></div></div>
        <div className="vstep reveal"><div className="n">2</div><div className="body"><h3>Goods &amp; Customs Data</h3><p>Import CN codes and customs evidence. Goods are classified once and reused across the whole case.</p></div></div>
        <div className="vstep reveal"><div className="n">3</div><div className="body"><h3>Installation &amp; Production Route</h3><p>Map the manufacturing origins of your goods: facilities, routes and monitoring boundaries.</p></div></div>
        <div className="vstep reveal"><div className="n">4</div><div className="body"><h3>Embedded Emissions</h3><p>Calculate direct and indirect carbon footprints with the deterministic engine — every figure traceable to its inputs.</p></div></div>
        <div className="vstep reveal"><div className="n">5</div><div className="body"><h3>Precursors &amp; Adjustments</h3><p>Account for complex supply chains: purchased precursors, allocation rules and double-counting guards.</p></div></div>
        <div className="vstep reveal"><div className="n">6</div><div className="body"><h3>Evidence Register</h3><p>Link primary documents — invoices, meter logs, lab analyses — directly to the calculation nodes they support.</p></div></div>
        <div className="vstep reveal"><div className="n">7</div><div className="body"><h3>Quality Review</h3><p>148 automated integrity checks run against EU guidelines. Blockers must be cleared; warnings come with plain-language fixes.</p></div></div>
        <div className="vstep reveal"><div className="n">8</div><div className="body"><h3>Seal &amp; Deliverables</h3><p>Generate the final locked dossier: sealed PDF, canonical JSON and O3CI field-mapped Excel, with a SHA-256 integrity manifest.</p></div></div>
      </div>
      <div style={{"textAlign":"center","marginTop":"56px"}}>
        <a className="btn btn-primary btn-lg" href="/register?next=/cases/new">Start Your First Case — Free <span className="arr">→</span></a>
      </div>
    </div>
  </section>

  <AeoPageChrome path="/how-it-works" answerHeading="Workflow answers with evidence" answerLimit={2} />


    </main>
  );
}