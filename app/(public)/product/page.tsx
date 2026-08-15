"use client";

import React from "react";
import { CountUp, useClassReveal } from "@/components/marketing/MarketingUi";
import { HeroDossierNarrative } from "@/components/marketing/HeroDossierNarrative";
import { AuthorityRail } from "@/components/marketing/AuthorityRail";
import { AeoPageChrome } from "@/components/seo/AnswerEvidenceSection";
import { CANONICAL_PRICING } from "@/lib/billing/pricing-config";
import { HOMEPAGE_STATS } from "@/lib/marketing/homepage-stats";

const CAPABILITIES = [
  {
    title: "Deterministic calculation engine",
    body: "Reproducible arithmetic: same case snapshot, same ruleset, same engine version → same outputs and node hashes. The calculation trace records formulas, factors and source pins. Deterministic ≠ third-party audited — no independent engine audit is published.",
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
    body: "Calculations pin to a named ruleset version (e.g. CBAM-DEFINITIVE-2026.1). Historical seals keep that pin when the Commission later amends methods. Pinning is reproducibility — not perpetual “current law” without monitoring.",
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
                  Start a free draft, close the blockers you can see, then pay {CANONICAL_PRICING.currency}{" "}
                  {CANONICAL_PRICING.displayPrice} once to lock that working file. Same-file corrections stay
                  included. A new file needs a new payment. You are preparing for independent review — not
                  buying a fake “verified” stamp.
                </span>
              </p>
              <p className="price-line">
                {CANONICAL_PRICING.currency} {CANONICAL_PRICING.displayPrice} per working file at lock.{" "}
                <span>No subscription. Drafts free. Same-file corrections included.</span>
              </p>
              <div className="hero-ctas">
                <a className="btn btn-primary btn-lg" href="/register?next=/cases/new">
                  Start Free Draft <span className="arr">→</span>
                </a>
                <a className="btn btn-ghost btn-lg" href="/sample-dossier">
                  View Sample Dossier
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
        <div className="wrap" style={{ maxWidth: "820px" }}>
          <div className="section-head reveal">
            <span className="eyebrow">Demand boundary · facts only</span>
            <h2>Who this software is for — and who it is not</h2>
            <p>
              Omnibus Regulation (EU) 2025/2083 exempts importers under the 50-tonne cumulative mass
              threshold (vast majority of importers; at least 99% of embedded emissions remain in
              CBAM scope). Exporter preparation demand is driven mainly by buyers that still need
              actual-value evidence. If a buyer accepts defaults, verification is not required for
              that path — and dossier demand can disappear. Deterministic replay is not a third-party
              engine audit. See{" "}
              <a href="/trust">Trust registry</a> and{" "}
              <a href="/cbam-actual-vs-default-values">actual vs default</a>.
            </p>
          </div>
        </div>
      </section>

      <section className="section" style={{ background: "var(--paper-2)" }}>
        <div className="wrap">
          <div className="section-head center reveal">
            <span className="eyebrow">How the software works</span>
            <h2>Self-service by design</h2>
            <p>
              No CBAMValid employee prepares, reviews or approves your dossier. You enter the data,
              the software calculates and checks, and the platform generates your digital outputs.
            </p>
          </div>
          <div className="timeline">
            <div className="tl-step reveal">
              <div className="tl-node">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>
              </div>
              <p className="step-no">Step 1</p>
              <h3>Customer enters data</h3>
              <p>You enter installation, production, goods and CN-code data in the working file.</p>
            </div>
            <div className="tl-step reveal">
              <div className="tl-node">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9 3v2m6-2v2M5 7h14v13H5V7Z"/><path d="M9 11h6m-6 4h6"/></svg>
              </div>
              <p className="step-no">Step 2</p>
              <h3>Software calculates</h3>
              <p>The engine runs deterministic embedded-emissions calculations against the pinned ruleset.</p>
            </div>
            <div className="tl-step reveal">
              <div className="tl-node">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 9v4m0 4h.01"/><circle cx="12" cy="12" r="9"/></svg>
              </div>
              <p className="step-no">Step 3</p>
              <h3>Software identifies blockers</h3>
              <p>The platform flags missing inputs, unit and boundary issues and quality-control blockers.</p>
            </div>
            <div className="tl-step reveal">
              <div className="tl-node">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5"/></svg>
              </div>
              <p className="step-no">Step 4</p>
              <h3>Customer links evidence</h3>
              <p>You link your own invoices, meter logs and supplier declarations to the calculation nodes they support.</p>
            </div>
            <div className="tl-step reveal">
              <div className="tl-node">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M7 3h7l5 5v13H7V3Z"/><path d="M14 3v5h5M10 13h6m-6 4h6"/></svg>
              </div>
              <p className="step-no">Step 5</p>
              <h3>Software generates outputs</h3>
              <p>The platform generates automated digital PDF, JSON and XLSX deliverables with an integrity manifest.</p>
            </div>
            <div className="tl-step reveal">
              <div className="tl-node">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></svg>
              </div>
              <p className="step-no">Step 6</p>
              <h3>Customer locks and downloads</h3>
              <p>You pay once to lock the working file and download the sealed package — same-file re-locks included.</p>
            </div>
            <div className="tl-step reveal">
              <div className="tl-node">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="m16 6-4-4-4 4M12 2v13"/></svg>
              </div>
              <p className="step-no">Step 7</p>
              <h3>Customer shares the sealed package</h3>
              <p>You send the downloaded dossier to your buyer, adviser or independent verifier outside CBAMValid.</p>
            </div>
            <div className="tl-step reveal">
              <div className="tl-node">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 3 4 6v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6l-8-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg>
              </div>
              <p className="step-no">Step 8</p>
              <h3>Recipient checks integrity</h3>
              <p>The manifest and SHA-256 hashes let recipients confirm that the sealed files have not changed.</p>
            </div>
            <div className="tl-step reveal">
              <div className="tl-node">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z"/></svg>
              </div>
              <p className="step-no">Step 9</p>
              <h3>Customer makes corrections</h3>
              <p>If review feedback requires changes, you return to the same paid working file and update its supporting data.</p>
            </div>
            <div className="tl-step reveal">
              <div className="tl-node">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M20 7h-7a4 4 0 0 0-4 4v1"/><path d="m17 4 3 3-3 3"/><path d="M4 17h7a4 4 0 0 0 4-4v-1"/><path d="m7 20-3-3 3-3"/></svg>
              </div>
              <p className="step-no">Step 10</p>
              <h3>Customer re-locks the same file</h3>
              <p>You generate a fresh sealed release for that same working file without another payment; a new file is charged separately.</p>
            </div>
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
                  <h3>Workspace trackers</h3>
                  <ul className="ui-list">
                    <li>Eight-stage completion</li>
                    <li>Seal blockers</li>
                    <li>Guidance warnings</li>
                    <li>File unlock state</li>
                  </ul>
                </div>
                <div className="ui-panel">
                  <h3>Case Readiness</h3>
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

      <AeoPageChrome path="/product" answerHeading="Product answers with evidence" answerLimit={8} />

      <section className="cta-band">
        <div className="wrap">
          <h2>
            Build your first case <span className="serif-i">free of charge</span>
          </h2>
          <p>
            Draft free. Pay {CANONICAL_PRICING.currency} {CANONICAL_PRICING.displayPrice} once to lock this
            working file — same-file corrections included, no subscription. A new file needs a new payment.
          </p>
          <a className="btn btn-primary btn-lg" href="/register?next=/cases/new">
            Start Free Draft <span className="arr">→</span>
          </a>
        </div>
      </section>
    </main>
  );
}
