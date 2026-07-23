"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

const SECTIONS = [
  {
    n: 1,
    t: 'Cover & Document Identity',
    html: '<span class="doc-eyebrow">CBAMValid · Sample Dossier</span><h3>CBAM Definitive-Period<br>Audit-Preparation Dossier</h3>' +
      '<table><tr><td>Document ID</td><td>CBMV-SAMPLE-2026-0001</td></tr><tr><td>Report version</td><td>1.0</td></tr>' +
      '<tr><td>Reporting period</td><td>1 Jan 2026 – 31 Mar 2026</td></tr><tr><td>Goods scope</td><td>Iron &amp; steel · CN 7208 39 00</td></tr>' +
      '<tr><td>Country of origin</td><td>Türkiye</td></tr><tr><td>Member State of import</td><td>Germany</td></tr>' +
      '<tr><td>Ruleset</td><td>CBAM-DEFINITIVE-2026.1-DEMO</td></tr></table>' +
      '<div class="watermark"><b>PUBLIC SAMPLE NOTICE</b><br>Generated from fictional demonstration data. Not a customs declaration, not an official CBAM Registry submission, not an accredited verifier opinion.</div>'
  },
  {
    n: 2,
    t: 'Executive Decision Summary',
    html: '<span class="doc-eyebrow">Section 2</span><h3>Executive Decision Summary</h3>' +
      '<table><tr><td>Total embedded emissions</td><td>412.6 tCO₂e</td></tr><tr><td>Specific embedded emissions</td><td>1.72 tCO₂e / t</td></tr>' +
      '<tr><td>Data quality score</td><td>86%</td></tr><tr><td>Open blockers</td><td>0</td></tr><tr><td>Warnings</td><td>2</td></tr>' +
      '<tr><td>Evidence coverage</td><td>14 / 16 nodes</td></tr></table><div class="watermark">Fictional demonstration data.</div>'
  },
  {
    n: 3,
    t: 'Reporting Scope',
    html: '<span class="doc-eyebrow">Section 3</span><h3>Reporting Scope</h3><p>One installation, one reporting year. Boundaries follow the definitive-period ruleset: direct emissions, indirect emissions, and relevant precursors.</p><div class="watermark">Fictional demonstration data.</div>'
  },
  {
    n: 4,
    t: 'Entity & Installation Profile',
    html: '<span class="doc-eyebrow">Section 4</span><h3>Entity &amp; Installation Profile</h3><table><tr><td>Operator</td><td>Demo Steelworks A.Ş.</td></tr><tr><td>Installation ID</td><td>TR-DEMO-0042</td></tr><tr><td>Location</td><td>İskenderun, Türkiye</td></tr><tr><td>Production route</td><td>BF–BOF</td></tr></table><div class="watermark">Fictional demonstration data.</div>'
  },
  {
    n: 5,
    t: 'Goods & CN Classification',
    html: '<span class="doc-eyebrow">Section 5</span><h3>Goods &amp; CN Classification</h3><table><tr><td>CN code</td><td>7208 39 00</td></tr><tr><td>Description</td><td>Flat-rolled iron/steel, coils</td></tr><tr><td>Net mass</td><td>240 t</td></tr></table><div class="watermark">Fictional demonstration data.</div>'
  },
  {
    n: 6,
    t: 'Production Route',
    html: '<span class="doc-eyebrow">Section 6</span><h3>Production Route</h3><p>Blast furnace – basic oxygen furnace route with coke and sinter precursors mapped to monitoring boundaries.</p><div class="watermark">Fictional demonstration data.</div>'
  },
  {
    n: 7,
    t: 'Data Trust Model',
    html: '<span class="doc-eyebrow">Section 7</span><h3>Data Trust Model</h3><p>Every calculation node carries a provenance flag: measured, calculated, literature, or default value — with the applicable EU method cited per node.</p><div class="watermark">Fictional demonstration data.</div>'
  },
  {
    n: 8,
    t: 'Direct Emissions',
    html: '<span class="doc-eyebrow">Section 8</span><h3>Direct Emissions</h3><table><tr><td>Fuel combustion</td><td>298.4 tCO₂e</td></tr><tr><td>Process emissions</td><td>87.2 tCO₂e</td></tr><tr><td>Total direct</td><td>385.6 tCO₂e</td></tr></table><div class="watermark">Fictional demonstration data.</div>'
  },
  {
    n: 9,
    t: 'Indirect Emissions',
    html: '<span class="doc-eyebrow">Section 9</span><h3>Indirect Emissions</h3><table><tr><td>Electricity consumed</td><td>96.0 MWh</td></tr><tr><td>Grid factor</td><td>0.281 tCO₂e/MWh</td></tr><tr><td>Total indirect</td><td>27.0 tCO₂e</td></tr></table><div class="watermark">Fictional demonstration data.</div>'
  },
  {
    n: 10,
    t: 'Precursors & Adjustments',
    html: '<span class="doc-eyebrow">Section 10</span><h3>Precursors &amp; Adjustments</h3><p>Sinter, coke and purchased pig iron allocated per mass-balance rules; no double counting across boundaries.</p><div class="watermark">Fictional demonstration data.</div>'
  },
  {
    n: 11,
    t: 'Calculation Trace',
    html: '<span class="doc-eyebrow">Section 11</span><h3>Calculation Trace</h3><p>Deterministic engine replay: every figure expands to formula, inputs, emission factors and source references.</p><div class="watermark">Fictional demonstration data.</div>'
  },
  {
    n: 12,
    t: 'Quality Controls',
    html: '<span class="doc-eyebrow">Section 12</span><h3>Quality Controls</h3><table><tr><td>Automated checks run</td><td>148</td></tr><tr><td>Passed</td><td>144</td></tr><tr><td>Warnings</td><td>4</td></tr><tr><td>Blockers</td><td>0</td></tr></table><div class="watermark">Fictional demonstration data.</div>'
  },
  {
    n: 13,
    t: 'Evidence Register',
    html: '<span class="doc-eyebrow">Section 13</span><h3>Evidence Register</h3><p>16 evidence items linked to calculation nodes: invoices, meter logs, lab analyses, supplier declarations.</p><div class="watermark">Fictional demonstration data.</div>'
  },
  {
    n: 14,
    t: 'Ruleset & Sources',
    html: '<span class="doc-eyebrow">Section 14</span><h3>Ruleset &amp; Sources</h3><table><tr><td>Regulation (EU) 2023/956</td><td>Applied</td></tr><tr><td>Impl. Reg. (EU) 2023/1773</td><td>Applied</td></tr><tr><td>Ruleset version</td><td>2026.1-DEMO</td></tr></table><div class="watermark">Fictional demonstration data.</div>'
  },
  {
    n: 15,
    t: 'Integrity Manifest',
    html: '<span class="doc-eyebrow">Section 15</span><h3>Integrity Manifest</h3><table><tr><td>SHA-256 (PDF)</td><td>9f2a…c41d</td></tr><tr><td>SHA-256 (JSON)</td><td>77be…08aa</td></tr><tr><td>Sealed at</td><td>2026-04-02 11:48 UTC</td></tr></table><div class="watermark">Fictional demonstration data.</div>'
  },
  {
    n: 16,
    t: 'Limitations & Deliverables',
    html: '<span class="doc-eyebrow">Section 16</span><h3>Limitations &amp; Deliverables</h3><p>Preparation package only — not an accredited third-party verification statement. Deliverables: sealed PDF, canonical JSON, O3CI-mapped XLSX.</p><div class="watermark">Fictional demonstration data.</div>'
  }
];

export default function SampleDossierPage() {
  const [activeIndex, setActiveIndex] = useState(0);

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
  }, []);

  return (
    <main id="main">
      <section className="hero" style={{ paddingBottom: "32px" }}>
        <div className="wrap" style={{ textAlign: "center" }}>
          <span className="eyebrow">Interactive Preview</span>
          <h1>See the dossier<br /><span className="serif-i">before you purchase</span></h1>
          <p className="lede" style={{ margin: "0 auto 22px" }}>
            Below is the full 16-page Exporter Verification Preparation Pack generated from fictional demonstration data. Open the pages to inspect the audit structure.
          </p>
          <Link className="btn btn-primary" href="/register?next=/cases/new">Create Your Case — Free <span className="arr">→</span></Link>
        </div>
      </section>

      <section className="section tight" style={{ paddingTop: "12px" }}>
        <div className="wrap">
          <div className="viewer-layout" id="dossier-viewer">
            {/* Left page navigation */}
            <div className="viewer-nav">
              <div className="toc-title">Manifest Index</div>
              <ul className="toc-list">
                {SECTIONS.map((sec, i) => (
                  <li
                    key={sec.n}
                    className={activeIndex === i ? "on" : ""}
                    onClick={() => setActiveIndex(i)}
                  >
                    {sec.n}. {sec.t}
                  </li>
                ))}
              </ul>
            </div>

            {/* Right page content */}
            <div className="viewer-panel">
              <div className="viewer-top">
                <span data-page-label="">Page {SECTIONS[activeIndex].n} of 16</span>
              </div>

              {/* Main Document Content */}
              <div className="viewer-doc" dangerouslySetInnerHTML={{ __html: SECTIONS[activeIndex].html }}>
              </div>

              <div className="viewer-thumbs">
                {SECTIONS.map((sec, i) => (
                  <button
                    key={sec.n}
                    className={`vthumb ${activeIndex === i ? "on" : ""}`}
                    type="button"
                    aria-label={`Open page ${sec.n}: ${sec.t}`}
                    onClick={() => setActiveIndex(i)}
                  >
                    <span className="pg">{sec.n}</span>
                    <span>p.</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
