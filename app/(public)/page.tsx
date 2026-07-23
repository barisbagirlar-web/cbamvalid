"use client";

import React, { useEffect } from 'react';
import Link from 'next/link';

export default function Page() {
  // Simple scroll reveal logic in React
  useEffect(() => {
    const revealEls = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window && revealEls.length) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      }, { threshold: 0.12 });
      revealEls.forEach((el) => io.observe(el));
    } else {
      revealEls.forEach((el) => el.classList.add('in'));
    }

    // Counter animation
    const counters = document.querySelectorAll('[data-count]');
    if ('IntersectionObserver' in window && counters.length) {
      const cio = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          cio.unobserve(el);
          const target = parseInt(el.getAttribute('data-count') || '0', 10);
          const suffix = el.getAttribute('data-suffix') || '';
          const dur = 1300;
          let start: number | null = null;
          function step(ts: number) {
            if (!start) start = ts;
            const p = Math.min((ts - start) / dur, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            el.textContent = String(Math.round(target * eased)) + suffix;
            if (p < 1) requestAnimationFrame(step);
          }
          requestAnimationFrame(step);
        });
      }, { threshold: 0.4 });
      counters.forEach((el) => cio.observe(el));
    }
  }, []);

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
        <p className="lede">Prepare a buyer-ready CBAM emissions and evidence package in one guided workflow. Enter your product, shipment, installation and emissions data. Review missing evidence, pay once, and download your final report in PDF, JSON and Excel formats.</p>
        <p className="price-line">USD 149 per Exporter Verification Preparation Pack. <span>No subscription. Drafts are free.</span></p>
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
        <div className="hero-chip">USD 149<small>One-time · No subscription</small></div>
        <div className="dossier-mock" role="img" aria-label="Preview of a sealed CBAM evidence dossier cover page">
          <div className="dm-head">
            <svg className="brand-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M20 3 35 9.5v9.7c0 8.9-6.2 15-15 17.8C11.2 34.2 5 28.1 5 19.2V9.5L20 3Z" stroke="#C0562F" strokeWidth="2.6" fill="#F5E4D8"/><path d="m13.5 20.2 4.3 4.3 8.7-9" stroke="#C0562F" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <b>Evidence Dossier</b>
            <span className="tag">Sealed · v1.0</span>
          </div>
          <p className="dm-title">CBAM Definitive-Period<br />Audit-Preparation Dossier</p>
          <div className="dm-rows">
            <div className="dm-row"><b>Goods scope</b><span>CN 7208 39 00</span></div>
            <div className="dm-row"><b>Embedded emissions</b><span>412.6 tCO₂e</span></div>
            <div className="dm-row"><b>Evidence coverage</b><span>14 / 16 nodes</span></div>
            <div className="dm-row"><b>QC blockers</b><span>0 open</span></div>
          </div>
          <div className="dm-foot">
            <span className="dm-hash">SHA-256 · 9f2a…c41d</span>
            <div className="dm-seal"><span>CBAMValid</span><span>Sealed</span></div>
          </div>
        </div>
        <div className="include-card">
          <h4>Included in the pack</h4>
          <ul>
            <li>PDF Evidence Manifest <span className="inc">Included</span></li>
            <li>Canonical JSON Format <span className="inc">Included</span></li>
            <li>O3CI Field-Mapped Excel <span className="inc">Included</span></li>
          </ul>
        </div>
      </div>
    </div>
  </section>

  
  <section className="proof-strip">
    <div className="wrap">
      <div className="proof-grid">
        <div className="proof-item"><div className="num"><span data-count="16">0</span></div><div className="lbl">Pages per sealed dossier</div></div>
        <div className="proof-item"><div className="num"><span data-count="8">0</span></div><div className="lbl">Guided workflow stages</div></div>
        <div className="proof-item"><div className="num"><span data-count="148">0</span></div><div className="lbl">Automated QC checks</div></div>
        <div className="proof-item"><div className="num"><span data-count="3">0</span></div><div className="lbl">Export formats · PDF/JSON/XLSX</div></div>
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
        <p>From raw production data to a sealed, verifier-preparation package — every stage is checked before you pay.</p>
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
          <p className="step-no">Step 4</p><h3>Pay USD 149</h3><p>Only when you seal the dossier</p>
        </div>
        <div className="tl-step reveal">
          <div className="tl-node"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 15a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/><path d="M12 3v2m0 14v2M3 12h2m14 0h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18"/></svg></div>
          <p className="step-no">Step 5</p><h3>Download premium dossier</h3><p>Sealed PDF, JSON and Excel</p>
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
        <h2>Prepare your CBAM case <span className="serif-i">before you pay</span></h2>
        <p>Create, complete and review your case without charge. Releases are consumed only after a dossier is successfully sealed.</p>
      </div>
      <div className="pricing-grid">
        <div className="price-card featured reveal">
          <span className="badge-pop">One-time payment</span>
          <h3>Exporter Verification Preparation Pack</h3>
          <p className="sub">Prepared for independent accredited-verification</p>
          <p className="price-fig"><span data-usd="$149" data-eur="≈ €139">$149</span> <small data-cur-note="per pack · no subscription">per pack · no subscription</small></p>
          <ul className="feat-list">
            <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="m4 12.5 5 5L20 6.5"/></svg>1 installation included</li>
            <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="m4 12.5 5 5L20 6.5"/></svg>1 reporting year included</li>
            <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="m4 12.5 5 5L20 6.5"/></svg>5 sealed releases included</li>
            <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="m4 12.5 5 5L20 6.5"/></svg>Emissions calculations and validation</li>
            <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="m4 12.5 5 5L20 6.5"/></svg>Unlimited drafts</li>
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

  
  <section className="section" style={{"background":"var(--paper-2)"}}>
    <div className="wrap">
      <div className="section-head center reveal">
        <span className="eyebrow">Frequently Asked Questions</span>
        <h2>Answers before you commit</h2>
      </div>
      <div className="faq-list">
        <div className="faq-item">
          <button className="faq-q" aria-expanded="false">What is a CBAM evidence dossier?<span className="chev"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></span></button>
          <div className="faq-a"><p>A CBAM evidence dossier is a compiled report containing the direct and indirect embedded emissions data of imported goods, structured to align with EU regulations.</p></div>
        </div>
        <div className="faq-item">
          <button className="faq-q" aria-expanded="false">Is CBAMValid an official European Commission service?<span className="chev"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></span></button>
          <div className="faq-a"><p>No. CBAMValid is an independent software service that assists exporters and importers with calculations and reporting preparation.</p></div>
        </div>
        <div className="faq-item">
          <button className="faq-q" aria-expanded="false">When do I pay?<span className="chev"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></span></button>
          <div className="faq-a"><p>You create, complete and review your case free of charge. Payment is taken only when you seal the final dossier.</p></div>
        </div>
        <div className="faq-item">
          <button className="faq-q" aria-expanded="false">What formats do I receive?<span className="chev"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></span></button>
          <div className="faq-a"><p>A sealed 16-page PDF evidence manifest, the canonical JSON dataset, and an O3CI field-mapped Excel workbook.</p></div>
        </div>
        <div className="faq-item">
          <button className="faq-q" aria-expanded="false">Does CBAMValid replace accredited independent verification?<span className="chev"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></span></button>
          <div className="faq-a"><p>No. Where verification is legally required, actual emissions must be independently verified by an accredited verifier. CBAMValid prepares the calculation and evidence package for that step.</p></div>
        </div>
        <div className="faq-item">
          <button className="faq-q" aria-expanded="false">Which sectors are covered?<span className="chev"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></span></button>
          <div className="faq-a"><p>Iron and steel, aluminium, cement, fertilisers, hydrogen and electricity — the goods currently in CBAM scope.</p></div>
        </div>
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
      <p>Drafts are free. You pay USD 149 only when your dossier is sealed and ready to hand over.</p>
      <a className="btn btn-primary btn-lg" href="/register?next=/cases/new">Start a Dossier <span className="arr">→</span></a>
    </div>
  </section>


    </main>
  );
}