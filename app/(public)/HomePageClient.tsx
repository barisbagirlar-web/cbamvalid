"use client";

import React from 'react';
import { HeroDossierNarrative } from '@/components/marketing/HeroDossierNarrative';
import { CountUp, FaqItem, useClassReveal } from '@/components/marketing/MarketingUi';
import { SealSignatureMark } from '@/components/marketing/SealSignatureMark';
import { AuthorityRail } from '@/components/marketing/AuthorityRail';
import { AeoPageChrome } from '@/components/seo/AnswerEvidenceSection';
import { HOMEPAGE_STATS } from '@/lib/marketing/homepage-stats';
import { PUBLIC_SAMPLE_DOSSIER } from '@/lib/sample/public-sample-dossier';
import { STRUCTURE_REVIEW_PUBLIC } from '@/lib/trust/verifier-structure-review';

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
          <strong>Direct answer:</strong>{" "}
          <span className="speakable-answer">
            USD 449 unlocks lock-and-download for one working file — unlimited drafts and same-file
            correction re-locks for that operator, installation, and year. Card charged when you pay
            to lock that file. A new file needs a new payment. Not an accredited verification opinion.
          </span>
        </p>
        <p className="authority-lead-empathy" style={{ maxWidth: "62ch", marginTop: "10px", color: "var(--ink-2)" }}>
          <strong>The pressure you are under:</strong> Buyer requests arrive before your evidence package
          is ready. You need a defendable dossier for one plant and one year — without pretending the
          software issued an accredited verification opinion.
        </p>
        <p className="price-line">USD 449 per working file at lock. <span>No subscription. Drafts free. Same-file corrections included.</span></p>
        <div className="hero-ctas">
          <a className="btn btn-primary btn-lg" href="/register?next=/cases/new">Start a Dossier <span className="arr">→</span></a>
          <a className="btn btn-ghost btn-lg" href="/sample-dossier">View the Sample Dossier</a>
          <a className="btn btn-navy btn-lg" href="/demo">Book a Demo</a>
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
        <div className="proof-item"><div className="num"><CountUp to={HOMEPAGE_STATS.dossierPages} /></div><div className="lbl">Pages per sealed dossier</div></div>
        <div className="proof-item"><div className="num"><CountUp to={HOMEPAGE_STATS.workflowStages} /></div><div className="lbl">Guided workflow stages</div></div>
        <div className="proof-item"><div className="num"><CountUp to={HOMEPAGE_STATS.qcChecks} /></div><div className="lbl">Automated QC rule families</div></div>
        <div className="proof-item"><div className="num"><CountUp to={HOMEPAGE_STATS.exportFormats} /></div><div className="lbl">Export formats · PDF/JSON/XLSX</div></div>
      </div>
      <p className="proof-note">Built around current published EU CBAM rules and official source data. QC count is derived from the engine rule registry.</p>
    </div>
  </section>

  <AuthorityRail
    mode="map"
    eyebrow="Authority · Proof chain"
    title="Inspect every public proof surface before you pay"
  />

  
  <section className="section tight">
    <div className="wrap">
      <div className="section-head center reveal">
        <span className="eyebrow">Math review · Structure review</span>
        <h2>You need math you can defend — and a package verifiers can navigate</h2>
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

      <a className="structure-review-card reveal" href="/verifier-review">
        <div className="structure-review-badge" aria-hidden="true">SR</div>
        <div>
          <span className="eyebrow">Verifier structure review</span>
          <h3>Reviewed for structure — not a verification opinion</h3>
          <p>
            Watermarked SAMPLE report format published for structure-review illustration — not a
            valid certificate. Package fields, evidence lineage, and integrity mapped for independent
            verification workflows.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="structure-review-thumb"
            src={STRUCTURE_REVIEW_PUBLIC.sampleDocument.previewHref}
            alt={`${STRUCTURE_REVIEW_PUBLIC.sampleDocument.title} — ${STRUCTURE_REVIEW_PUBLIC.sampleDocument.notice}`}
            width={320}
            height={178}
          />
          <span className="structure-review-cta">Open structure review <span className="arr">→</span></span>
        </div>
      </a>
    </div>
  </section>

  
  <section className="section" style={{"background":"var(--paper-2)"}}>
    <div className="wrap">
      <div className="section-head center reveal">
        <span className="eyebrow">Guided Process</span>
        <h2>When the buyer asks this week, start here</h2>
        <p>From raw production data to a sealed verifier-preparation package — draft free, then pay once when you lock this file.</p>
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
          <p className="step-no">Step 4</p><h3>Pay once to lock this file</h3><p>USD 449 for one operator, one installation, one year — same-file corrections included</p>
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
        <h2>Stop sending fragile files. <span className="serif-i">Seal one package.</span></h2>
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
        <span className="eyebrow">Sample Dossier Spreads</span>
        <h2>See three pages from the public sample</h2>
        <p>Cover, calculation trace, and evidence register — gate-free. Download the full 16-page PDF, JSON, and XLSX without an account.</p>
      </div>
      <div className="deliv-grid">
        <a className="deliv-card reveal" href="/sample-dossier" style={{ textDecoration: "none", color: "inherit" }}>
          <span className="fmt">Cover</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={PUBLIC_SAMPLE_DOSSIER.spreads.cover}
            alt="Sample dossier cover page"
            style={{ width: "100%", borderRadius: "8px", border: "1px solid var(--line)", marginTop: "12px" }}
          />
        </a>
        <a className="deliv-card reveal" href="/sample-dossier" style={{ textDecoration: "none", color: "inherit" }}>
          <span className="fmt">Calculation trace</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={PUBLIC_SAMPLE_DOSSIER.spreads.calculationTrace}
            alt="Sample dossier calculation trace page"
            style={{ width: "100%", borderRadius: "8px", border: "1px solid var(--line)", marginTop: "12px" }}
          />
        </a>
        <a className="deliv-card reveal" href="/sample-dossier" style={{ textDecoration: "none", color: "inherit" }}>
          <span className="fmt">Evidence register</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={PUBLIC_SAMPLE_DOSSIER.spreads.evidenceRegister}
            alt="Sample dossier evidence register page"
            style={{ width: "100%", borderRadius: "8px", border: "1px solid var(--line)", marginTop: "12px" }}
          />
        </a>
      </div>
      <div style={{ textAlign: "center", marginTop: "32px" }}>
        <a className="btn btn-navy" href="/sample-dossier">Open sample dossier <span className="arr">→</span></a>
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
              <li>Pay once to lock this working file and download the sealed dossier</li>
            </ul>
          </div>
          <div className="ui-panel">
            <h4>Case Readiness</h4>
            <div className="qc-grid">
              <div className="qc-box"><div className="v terra">86%</div><div className="k">Completion</div></div>
              <div className="qc-box"><div className="v ok">0</div><div className="k">Blockers</div></div>
              <div className="qc-box"><div className="v warn">2</div><div className="k">Warnings</div></div>
              <div className="qc-box"><div className="v navy">Paid</div><div className="k">File unlock</div></div>
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
        <h2>Pay once when you lock this file — <span className="serif-i">not while you are still drafting.</span></h2>
        <p>Draft free. Pay at lock. Same-file corrections included. A new working file needs a new payment. Failed locks charge nothing.</p>
      </div>
      <div className="pricing-grid">
        <div className="price-card featured">
          <span className="badge-pop">Pay at lock · One-time</span>
          <h3>Exporter Verification Preparation Pack</h3>
          <p className="sub">Prepared for independent accredited verification</p>
          <p className="price-fig"><span data-usd="$449" data-eur="≈ €415">$449</span> <small data-cur-note="per file at lock · no subscription">per file at lock · no subscription</small></p>
          <ul className="feat-list">
            <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="m4 12.5 5 5L20 6.5"/></svg>1 operator · 1 installation · 1 reporting year</li>
            <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="m4 12.5 5 5L20 6.5"/></svg>Unlimited drafts on that working file</li>
            <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="m4 12.5 5 5L20 6.5"/></svg>Same-file corrections and re-locks included</li>
            <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="m4 12.5 5 5L20 6.5"/></svg>Evidence-linked calculations and QC</li>
            <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="m4 12.5 5 5L20 6.5"/></svg>Immutable sealed versions · free re-download</li>
            <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="m4 12.5 5 5L20 6.5"/></svg>O3CI field-mapped structured data export</li>
          </ul>
          <a className="btn btn-primary" href="/pricing">See pay-at-lock pricing <span className="arr">→</span></a>
          <a className="btn btn-ghost" href="/pricing#roi" style={{ marginTop: "10px" }}>
            Open ROI exposure calculator <span className="arr">→</span>
          </a>
        </div>
        <div className="price-card free">
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
      <div style={{ marginTop: "48px", display: "flex", justifyContent: "center" }}>
        <SealSignatureMark
          rulesetVersion="v3.0.0-DEFINITIVE"
          documentHash={PUBLIC_SAMPLE_DOSSIER.primaryDocumentSha256}
        />
      </div>
      <p style={{ textAlign: "center", marginTop: "18px" }}>
        <a href="/enterprise">Enterprise Exclusive (SSO · SLA · Holding)</a>
        {" · "}
        <a href="/demo">Book a demo</a>
        {" · "}
        <a href="/pricing#tiers">See all four tiers</a>
        {" · "}
        <a href="/pricing#roi">ROI calculator</a>
        {" · "}
        <a href="/trust">Trust registry</a>
        {" · "}
        <a href="/case-studies">Illustrative sector scenarios</a>
      </p>
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
        <h2>Boundaries before you spend money or promise a buyer</h2>
      </div>
      <div className="faq-list">
        <FaqItem
          question="How do I inspect CBAMValid claims before paying?"
          answer="Open the Trust Evidence Registry (/trust), Sample Dossier, Published Rulesets, Security & DPA, and Structure Review SAMPLE. Anonymized sector scenarios live on /case-studies — named logos stay permissioned. Gaps stay tagged, never invented."
        />
        <FaqItem
          question="Is CBAMValid an official European Commission service?"
          answer="No. CBAMValid is an independent software service that assists exporters and importers with calculations and reporting preparation."
        />
        <FaqItem
          question="When is the card charged?"
          answer="Drafting is free. You pay USD 449 once when you lock that working file. Same-file corrections and re-locks stay included. A new working file needs a new payment. Failed locks and re-downloads charge nothing."
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
            <p>Built around current published EU CBAM rules and official source data. Designed for exporter-to-importer evidence transfer and verification readiness. Full claim registry: <a href="/trust">cbamvalid.com/trust</a>.</p>
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
      <p>Drafts are free. Pay USD 449 once to lock this working file — same-file corrections included. A new file needs a new payment.</p>
      <a className="btn btn-primary btn-lg" href="/register?next=/cases/new">Start a Dossier <span className="arr">→</span></a>
    </div>
  </section>


    </main>
  );
}