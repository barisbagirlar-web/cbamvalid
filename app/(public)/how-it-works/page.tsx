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
      <h1 style={{"maxWidth":"820px","marginLeft":"auto","marginRight":"auto"}}>From raw plant data to a sealed package — without email chaos</h1>
      <p className="lede" style={{"margin":"0 auto"}}>One factory + one year = one working file. Enter production and emissions data, link evidence, clear blockers, buy the Preparation Pack at checkout, then lock and download a sealed verifier-preparation package.</p>
      <p className="aeo-lead" style={{"margin":"18px auto 0"}}>
        <strong>Direct answer:</strong>{" "}
        <span className="speakable-answer">Draft free → buy USD 249 once → lock up to five immutable packages inside that scope. Locking is not accredited verification.</span>
      </p>
    </div>
  </section>

  <section className="section tight">
    <div className="wrap">
      <div className="vsteps">
        <div className="vstep reveal"><div className="n">1</div><div className="body"><h3>Who and where</h3><p>Open a working file for one installation and one reporting year — one clear perimeter.</p></div></div>
        <div className="vstep reveal"><div className="n">2</div><div className="body"><h3>What you sell</h3><p>Add goods and CN codes. Classifications are reused across the whole working file.</p></div></div>
        <div className="vstep reveal"><div className="n">3</div><div className="body"><h3>How you make it</h3><p>Map production routes and monitoring boundaries for that installation.</p></div></div>
        <div className="vstep reveal"><div className="n">4</div><div className="body"><h3>Emissions numbers</h3><p>Enter direct and indirect embedded emissions — every figure stays traceable to its inputs.</p></div></div>
        <div className="vstep reveal"><div className="n">5</div><div className="body"><h3>Bought inputs</h3><p>Account for precursors, allocation rules and double-counting guards where they apply.</p></div></div>
        <div className="vstep reveal"><div className="n">6</div><div className="body"><h3>Proof documents</h3><p>Link invoices, meter logs and lab analyses to the numbers they support.</p></div></div>
        <div className="vstep reveal"><div className="n">7</div><div className="body"><h3>Fix blockers</h3><p>Automated integrity checks flag gaps in plain language. Blockers must be cleared before lock.</p></div></div>
        <div className="vstep reveal"><div className="n">8</div><div className="body"><h3>Lock &amp; download</h3><p>Create the locked package: sealed PDF, canonical JSON and O3CI field-mapped Excel, with a SHA-256 integrity manifest.</p></div></div>
      </div>
      <div style={{"textAlign":"center","marginTop":"56px"}}>
        <a className="btn btn-primary btn-lg" href="/register?next=/cases/new">Create your first working file — Free <span className="arr">→</span></a>
      </div>
    </div>
  </section>

  <AeoPageChrome path="/how-it-works" answerHeading="Workflow answers with evidence" answerLimit={2} />


    </main>
  );
}