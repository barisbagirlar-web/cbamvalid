"use client";

import React from 'react';
import { HeroDossierNarrative } from '@/components/marketing/HeroDossierNarrative';
import { CountUp, FaqItem, useClassReveal } from '@/components/marketing/MarketingUi';
import { AeoPageChrome } from '@/components/seo/AnswerEvidenceSection';

export default function HomePageClient() {
  useClassReveal();

  return (
    <main id="main">
      

  
  <section className="hero">
    <div className="wrap hero-grid">
      <div>
        <span className="eyebrow">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
          EU Regulatory Method Alignment
        </span>
        <h1>CBAM Exporter<br /><span className="serif-i">Final Evidence Report</span></h1>
        <p className="lede">When an EU buyer asks for actual embedded-emissions evidence, you need a package you can defend — not a fragile spreadsheet. Build one installation, one reporting year, link evidence, clear blockers, then seal a verifier-preparation dossier.</p>
        <p className="aeo-lead">
          <strong>Direct answer:</strong> USD 249 buys one scoped Exporter Verification Preparation Pack — unlimited drafts and five successful sealed releases for that operator, installation, and year. Card charged at checkout. Not an accredited verification opinion.
        </p>
        <p className="price-line">USD 249 per Exporter Verification Preparation Pack. <span>No subscription. Drafts are free. Five sealed releases.</span></p>
        <div className="hero-ctas">
          <a className="btn btn-primary btn-lg" href="/register?next=/cases/new">Start a Dossier <span className="arr">→</span></a>
          <a className="btn btn-ghost btn-lg" href="/how-it-works">Watch the Workflow</a>
          <a className="btn btn-ghost btn-lg" href="/sample-dossier">View the Sample Dossier</a>
        </div>
        <ul className="hero-micro">
          <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="m4 12.5 5 5L20 6.5"/></svg>Deterministic engine</li>
          <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="m4 12.5 5 5L20 6.5"/></svg>Versioned EU rulesets</li>
          <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="m4 12.5 5 5L20 6.5"/></svg>Data hosted in the EU</li>
        </ul>
      </div>

      <div className="hero-visual">
        <HeroDossierNarrative />
      </div>
    </div>
  </section>

  
  <section className="proof-strip">
    <div className="wrap">
      <div className="proof-grid">
        <div className="proof-item"><div className="num"><CountUp to={16} /></div><div className="lbl">Pages per sealed dossier</div></div>
        <div className="proof-item"><div className="num"><CountUp to={8} /></div><div className="lbl">Guided workflow stages</div></div>
        <div className="proof-item"><div className="num"><CountUp to={148} /></div><div className="lbl">Automated QC checks</div></div>
        <div className="proof-item"><div className="num"><CountUp to={3} /></div><div className="lbl">Export formats · PDF/JSON/XLSX</div></div>
      </div>
      <p className="proof-note">Built around current published EU CBAM rules and official source data.</p>
    </div>
  </section>

  
  <section className="section tight">
    <div className="wrap">
      <div className="section-head center reveal">
        <span className="eyebrow">Academic Oversight &amp; Expert Review</span>
        <h2>Rigorous Mathematical Integrity</h2>
      </div>
      <div className="academic-card reveal">
        <div className="academic-badge" aria-hidden="true">IIT</div>
        <div>
          <h3>Reviewed against EU CBAM mathematical rules</h3>
          <p>Our embedded emissions calculation engines, allocation methodology, and compliance logic are reviewed for compliance with EU CBAM mathematical rules.</p>
          <div className="who">
            <b>Prof. Dr. Neela Nataraj</b>
            <span>Department of Mathematics · Indian Institute of Technology Bombay (IIT Bombay)</span>
          </div>
        </div>
      </div>
    </div>
  </section>

  
  <section className="section" style={{"background":"var(--paper-2)"}}>
    <div className="wrap">
      <div className="section-head center reveal">
        <span className="eyebrow">Guided Process</span>
        <h2>Five-Step Evidence Compilation Workflow</h2>
        <p>From raw production data to a sealed verifier-preparation package — draft free, then buy the pack before sealing.</p>
      </div>
      <div className="timeline">
        <div className="tl-step reveal">
          <div className="tl-node"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg></div>
          <p className="step-no">Step 1</p><h3>Add your exported goods</h3><p>CN codes, net mass, customs data</p>
        </div>
        <div className="tl-step reveal">
          <div className="tl-node"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 21h18M5 21V8l5 3V8l5 3V5l4-1v17"/></svg></div>
          <p className="step-no">Step 2</p><h3>Add factory &amp; production data</h3><p>Installation, routes, precursors</p>
        </div>
        <div className="tl-step reveal">
          <div className="tl-node"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg></div>
          <p className="step-no">Step 3</p><h3>Review emissions &amp; gaps</h3><p>Real-time QC and evidence review</p>
        </div>
        <div className="tl-step reveal">
          <div className="tl-node"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/></svg></div>
          <p className="step-no">Step 4</p><h3>Buy the USD 249 pack</h3><p>One operator, one installation, one year — five seals</p>
        </div>
        <div className="tl-step reveal">
          <div className="tl-node"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 15a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/><path d="M12 3v2m0 14v2M3 12h2m14 0h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18"/></svg></div>
          <p className="step-no">Step 5</p><h3>Seal and download</h3><p>Immutable sealed PDF, JSON and Excel</p>
        </div>
      </div>
      <div style={{"textAlign":"center","marginTop":"56px"}}>
        <a className="btn btn-navy" href="/how-it-works">Open the Full Walkthrough <span className="arr">→</span></a>
      </div>
    </div>
  </section>

  
  <section className="section">
    <div className="wrap">
      <div className="section-head reveal">
        <span className="eyebrow">What You Receive</span>
        <h2>Three deliverables, <span className="serif-i">one sealed package</span></h2>
        <p>Every dossier is locked with an integrity manifest — hashes, ruleset version and seal timestamp — so your buyer or verifier can confirm it was never altered.</p>
      </div>
      <div className="deliv-grid">
        <div className="deliv-card reveal">
          <span className="fmt">PDF · 16 pages</span>
          <div className="deliv-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M7 3h7l5 5v13H7V3Z"/><path d="M14 3v5h5M10 13h6m-6 4h6"/></svg></div>
          <h3>PDF Evidence Manifest</h3>
          <p>A human-readable, audit-preparation report: scope, emissions, evidence register, quality controls and calculation trace.</p>
        </div>
        <div className="deliv-card reveal">
          <span className="fmt">JSON · Canonical</span>
          <div className="deliv-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M8 3H6a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h2M16 3h2a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-2"/></svg></div>
          <h3>Canonical JSON Dataset</h3>
          <p>Machine-readable structured data with a fixed schema — ready for your buyer’s systems and long-term archiving.</p>
        </div>
        <div className="deliv-card reveal">
          <span className="fmt">XLSX · O3CI</span>
          <div className="deliv-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg></div>
          <h3>O3CI Field-Mapped Excel</h3>
          <p>Emissions data mapped field-by-field to the installation communication template used across EU supply chains.</p>
        </div>
      </div>
    </div>
  </section>

  
  <section className="section tight" style={{"background":"var(--paper-2)"}}>
    <div className="wrap">
      <div className="section-head center reveal">
        <span className="eyebrow">See CBAMValid in Action</span>
        <h2>Review the full evidence-linked workflow</h2>
        <p>Completion, blockers, warnings and remaining releases — visible before you create your first case.</p>
      </div>
      <div className="ui-mock reveal">
        <div className="ui-mock-bar"><i></i><i></i><i></i><span>cbamvalid.com — Case Readiness</span></div>
        <div className="ui-mock-body">
          <div className="ui-panel">
            <h4>What the walkthrough covers</h4>
            <ul className="ui-list">
              <li>Create and complete an eight-step CBAM case</li>
              <li>Understand the logic behind each material input</li>
              <li>Link evidence, resolve blockers and review calculations</li>
              <li>Purchase credits securely and seal the final dossier</li>
            </ul>
          </div>
          <div className="ui-panel">
            <h4>Case Readiness</h4>
            <div className="qc-grid">
              <div className="qc-box"><div className="v terra">86%</div><div className="k">Completion</div></div>
              <div className="qc-box"><div className="v ok">0</div><div className="k">Blockers</div></div>
              <div className="qc-box"><div className="v warn">2</div><div className="k">Warnings</div></div>
              <div className="qc-box"><div className="v navy">5</div><div className="k">Report uses</div></div>
            </div>
          </div>
        </div>
      </div>
      <div className="ui-mock-cta reveal">
        <a className="btn btn-primary" href="/how-it-works">Open Full Walkthrough <span className="arr">→</span></a>
      </div>
    </div>
  </section>

  
  <section className="section">
    <div className="wrap">
      <div className="section-head center reveal">
        <span className="eyebrow">Simple Pricing</span>
        <h2>One scoped pack. <span className="serif-i">Five sealed releases.</span></h2>
        <p>Draft free. Buy once at checkout. Each successful seal uses one of five releases. Failed seals use none.</p>
      </div>
      <div className="pricing-grid">
        <div className="price-card featured reveal">
          <span className="badge-pop">Scoped pack · One-time</span>
          <h3>Exporter Verification Preparation Pack</h3>
          <p className="sub">Prepared for independent accredited verification</p>
          <p className="price-fig"><span data-usd="$249" data-eur="≈ €229">$249</span> <small data-cur-note="per pack · no subscription">per pack · no subscription</small></p>
          <ul className="feat-list">
            <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="m4 12.5 5 5L20 6.5"/></svg>1 operator · 1 installation · 1 reporting year</li>
            <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="m4 12.5 5 5L20 6.5"/></svg>Unlimited drafts on that working file</li>
            <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="m4 12.5 5 5L20 6.5"/></svg>5 successful sealed releases</li>
            <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="m4 12.5 5 5L20 6.5"/></svg>Evidence-linked calculations and QC</li>
            <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="m4 12.5 5 5L20 6.5"/></svg>Immutable sealed versions · free re-download</li>
            <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="m4 12.5 5 5L20 6.5"/></svg>O3CI field-mapped structured data export</li>
          </ul>
          <a className="btn btn-primary" href="/pricing">Get the Preparation Pack <span className="arr">→</span></a>
        </div>
        <div className="price-card free reveal">
          <h3>Free Drafts</h3>
          <p className="sub">Prepare and review without cost</p>
          <p className="price-fig">$0 <small>forever</small></p>
          <ul className="feat-list">
            <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="m4 12.5 5 5L20 6.5"/></svg>Create unlimited cases</li>
            <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="m4 12.5 5 5L20 6.5"/></svg>Real-time QC engine</li>
            <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="m4 12.5 5 5L20 6.5"/></svg>Data gap analysis</li>
          </ul>
          <a className="btn btn-ghost" href="/register?next=/cases/new">Start for Free</a>
        </div>
      </div>
      <ul className="guarantee-row">
        <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M12 2 20 5.5v6c0 5-3.5 8.5-8 10.5-4.5-2-8-5.5-8-10.5v-6L12 2Z"/></svg>Secure card payment</li>
        <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M12 2 20 5.5v6c0 5-3.5 8.5-8 10.5-4.5-2-8-5.5-8-10.5v-6L12 2Z"/></svg>Refund policy published</li>
        <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M12 2 20 5.5v6c0 5-3.5 8.5-8 10.5-4.5-2-8-5.5-8-10.5v-6L12 2Z"/></svg>GDPR compliant · EU hosted</li>
      </ul>
    </div>
  </section>

  
  <AeoPageChrome
    path="/"
    answerHeading="Answers your buyer, verifier, or an AI assistant can cite"
    answerLimit={3}
  />

  
  <section className="section" style={{"background":"var(--paper-2)"}}>
    <div className="wrap">
      <div className="section-head center reveal">
        <span className="eyebrow">Short FAQ</span>
        <h2>Boundaries before you commit</h2>
      </div>
      <div className="faq-list">
        <FaqItem
          question="Is CBAMValid an official European Commission service?"
          answer="No. CBAMValid is an independent software service that assists exporters and importers with calculations and reporting preparation."
        />
        <FaqItem
          question="What formats do I receive after sealing?"
          answer="A sealed PDF evidence package, the canonical JSON dataset, and an O3CI field-mapped Excel workbook — with an integrity manifest."
        />
        <FaqItem
          question="Which sectors are covered?"
          answer="Iron and steel, aluminium, cement, fertilisers, hydrogen and electricity — the goods currently in CBAM scope."
        />
      </div>
    </div>
  </section>

  
  <section className="section tight">
    <div className="wrap">
      <div className="trust-card reveal">
        <div className="t-row">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M12 2 20 5.5v6c0 5-3.5 8.5-8 10.5-4.5-2-8-5.5-8-10.5v-6L12 2Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg>
          <div>
            <h3 style={{"fontSize":"1.15rem","marginBottom":"6px"}}>Trust Statement</h3>
            <p>Built around current published EU CBAM rules and official source data. Designed for exporter-to-importer evidence transfer and verification readiness.</p>
          </div>
        </div>
        <p className="disc-title">Mandatory Limitation &amp; Regulatory Disclaimer</p>
        <p className="disc">CBAMValid prepares calculation and evidence packages. It is not an EU institution, customs authority, or accredited CBAM verifier. Actual emissions must be independently verified where verification is legally required.</p>
      </div>
    </div>
  </section>

  
  <section className="cta-band">
    <div className="wrap">
      <span className="eyebrow navy">Definitive Period · 2026</span>
      <h2>Your buyer will ask for evidence.<br /><span className="serif-i">Be ready before they do.</span></h2>
      <p>Drafts are free. Buy the USD 249 pack once — one installation, one year, five sealed releases.</p>
      <a className="btn btn-primary btn-lg" href="/register?next=/cases/new">Start a Dossier <span className="arr">→</span></a>
    </div>
  </section>


    </main>
  );
}