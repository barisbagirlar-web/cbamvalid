"use client";

import React from "react";
import { CountUp, useClassReveal } from "@/components/marketing/MarketingUi";
import { HeroDossierNarrative } from "@/components/marketing/HeroDossierNarrative";
import { AuthorityRail } from "@/components/marketing/AuthorityRail";
import { AeoPageChrome } from "@/components/seo/AnswerEvidenceSection";
import { HOMEPAGE_STATS } from "@/lib/marketing/homepage-stats";

const CAPABILITIES = [
  {
    title: "Deterministic calculation engine",
    body: "Every figure is reproducible: same inputs, same outputs, every time. The full calculation trace expands to formulas, emission factors and source references — exactly what an accredited verifier asks for first.",
    ref: "ENGINE · REPLAYABLE",
  },
  {
    title: "Evidence register",
    body: "Invoices, meter logs, lab analyses and supplier declarations are linked directly to the calculation nodes they support — so evidence coverage is visible, not assumed.",
    ref: "16 NODE TYPES",
  },
  {
    title: "Real-time quality controls",
    body: `${HOMEPAGE_STATS.qcChecks} automated QC rule families run against EU guidance: unit consistency, boundary completeness, allocation balance and default-value flagging. Blockers must be resolved before sealing.`,
    ref: `${HOMEPAGE_STATS.qcChecks} RULE FAMILIES · ALWAYS ON`,
  },
  {
    title: "O3CI field-mapped export",
    body: "Your emissions data maps field-by-field to the installation communication template circulating in EU supply chains — no re-typing by your buyer, no transcription errors.",
    ref: "XLSX · FIELD-MAPPED",
  },
  {
    title: "Versioned EU rulesets",
    body: "Calculations pin to a named ruleset version (e.g. CBAM-DEFINITIVE-2026.1). When the EU updates its methods, your sealed dossier still shows exactly which rules it was built against.",
    ref: "REGULATION (EU) 2023/956",
  },
  {
    title: "Integrity manifest & sealing",
    body: "On sealing, every deliverable is hashed (SHA-256) and timestamped. Anyone holding your dossier can confirm it was never altered after the seal.",
    ref: "SHA-256 · UTC SEAL",
  },
] as const;

export default function Page() {
  useClassReveal();

  return (
    <main id="main">
      <section className="hero product-hero">
        <div className="wrap">
          <AuthorityRail mode="compact" eyebrow="Authority · Product proof path" />
          <div className="hero-grid">
            <div>
              <span className="eyebrow">Product</span>
              <h1>
                When spreadsheets fail under{" "}
                <span className="serif-i">verifier questions</span>
              </h1>
              <p className="lede">
                One guided environment to enter production data, link evidence, resolve quality
                findings and seal a verifier-preparation package — without email-thread version
                chaos.
              </p>
              <p className="aeo-lead">
                <strong>Direct answer:</strong>{" "}
                <span className="speakable-answer">
                  Start a free draft, close the blockers you can see, then pay USD 449 once to lock
                  that working file. Same-file corrections stay included. A new file needs a new
                  payment. You are preparing for independent review — not buying a fake “verified”
                  stamp.
                </span>
              </p>
              <p className="price-line">
                USD 449 per working file at lock.{" "}
                <span>No subscription. Drafts free. Same-file corrections included.</span>
              </p>
              <div className="hero-ctas">
                <a className="btn btn-primary btn-lg" href="/register?next=/cases/new">
                  Start a Dossier <span className="arr">→</span>
                </a>
                <a className="btn btn-ghost btn-lg" href="/sample-dossier">
                  See a Sealed Sample
                </a>
              </div>
              <ul className="hero-micro">
                <li>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                    <path d="m4 12.5 5 5L20 6.5" />
                  </svg>
                  Deterministic engine
                </li>
                <li>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                    <path d="m4 12.5 5 5L20 6.5" />
                  </svg>
                  Fail-closed QC
                </li>
                <li>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                    <path d="m4 12.5 5 5L20 6.5" />
                  </svg>
                  SHA-256 sealed releases
                </li>
              </ul>
            </div>

            <div className="hero-visual">
              <HeroDossierNarrative />
            </div>
          </div>
        </div>
      </section>

      <section className="proof-strip">
        <div className="wrap">
          <div className="proof-grid">
            <div className="proof-item">
              <div className="num">
                <CountUp to={HOMEPAGE_STATS.dossierPages} />
              </div>
              <div className="lbl">Pages per sealed dossier</div>
            </div>
            <div className="proof-item">
              <div className="num">
                <CountUp to={HOMEPAGE_STATS.workflowStages} />
              </div>
              <div className="lbl">Guided workflow stages</div>
            </div>
            <div className="proof-item">
              <div className="num">
                <CountUp to={HOMEPAGE_STATS.qcChecks} />
              </div>
              <div className="lbl">Automated QC rule families</div>
            </div>
            <div className="proof-item">
              <div className="num">
                <CountUp to={HOMEPAGE_STATS.exportFormats} />
              </div>
              <div className="lbl">Export formats · PDF/JSON/XLSX</div>
            </div>
          </div>
          <p className="proof-note">
            Built around current published EU CBAM rules and official source data. QC count is derived
            from the engine rule registry.
          </p>
        </div>
      </section>

      <section className="section" style={{ background: "var(--paper-2)" }}>
        <div className="wrap">
          <div className="section-head center reveal">
            <span className="eyebrow">Core Capabilities</span>
            <h2>What you need when a buyer challenges your numbers</h2>
            <p>
              Six capabilities in one working file — calculation, evidence, QC, export, ruleset pin,
              and seal integrity.
            </p>
          </div>
          <div className="product-cap-grid">
            {CAPABILITIES.map((cap, index) => (
              <article key={cap.title} className="product-cap-card reveal">
                <span className="product-cap-index" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3>{cap.title}</h3>
                <p>{cap.body}</p>
                <span className="ref">{cap.ref}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="product-workspace">
            <div className="product-workspace-copy reveal">
              <span className="eyebrow">Inside the Workspace</span>
              <h2>Case readiness, at a glance</h2>
              <p>
                Track completion across all eight workflow stages, resolve blockers before sealing,
                and see whether this working file is paid and unlocked for lock-and-download — in one
                screen, not scattered spreadsheets.
              </p>
              <ul className="product-workspace-points">
                <li>Completion across all eight workflow stages</li>
                <li>Blockers that must be resolved before sealing</li>
                <li>Warnings with plain-language guidance</li>
                <li>Paid unlock status for this working file</li>
              </ul>
            </div>

            <div className="ui-mock product-ui-mock reveal">
              <div className="ui-mock-bar">
                <i></i>
                <i></i>
                <i></i>
                <span>cbamvalid.com — Case Readiness</span>
              </div>
              <div className="ui-mock-body">
                <div className="ui-panel">
                  <h4>Workspace trackers</h4>
                  <ul className="ui-list">
                    <li>Eight-stage completion</li>
                    <li>Seal blockers</li>
                    <li>Guidance warnings</li>
                    <li>File unlock state</li>
                  </ul>
                </div>
                <div className="ui-panel">
                  <h4>Case Readiness</h4>
                  <div className="qc-grid">
                    <div className="qc-box">
                      <div className="v terra">86%</div>
                      <div className="k">Completion</div>
                    </div>
                    <div className="qc-box">
                      <div className="v ok">0</div>
                      <div className="k">Blockers</div>
                    </div>
                    <div className="qc-box">
                      <div className="v warn">2</div>
                      <div className="k">Warnings</div>
                    </div>
                    <div className="qc-box">
                      <div className="v navy">Paid</div>
                      <div className="k">File unlock</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <AeoPageChrome path="/product" answerHeading="Product answers with evidence" answerLimit={2} />

      <section className="cta-band">
        <div className="wrap">
          <h2>
            Build your first case <span className="serif-i">free of charge</span>
          </h2>
          <p>
            Draft free. Pay USD 449 once to lock this working file — same-file corrections included,
            no subscription. A new file needs a new payment.
          </p>
          <a className="btn btn-primary btn-lg" href="/register?next=/cases/new">
            Start a Dossier <span className="arr">→</span>
          </a>
        </div>
      </section>
    </main>
  );
}
