/* CBAMValid — Redesign 2026 · UI behaviour
   NOTE: All marketing-layer only. Backend hooks (auth, cases, payments,
   sealing) are marked with TODO-BACKEND comments where they attach. */

(function () {
  'use strict';

  /* ---------- Mobile nav ---------- */
  var toggle = document.querySelector('.nav-toggle');
  var mobileNav = document.querySelector('.mobile-nav');
  if (toggle && mobileNav) {
    toggle.addEventListener('click', function () {
      mobileNav.classList.toggle('open');
      var open = mobileNav.classList.contains('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* ---------- Scroll reveal ---------- */
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- Animated counters ---------- */
  var counters = document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window && counters.length) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        cio.unobserve(el);
        var target = parseInt(el.getAttribute('data-count'), 10);
        var suffix = el.getAttribute('data-suffix') || '';
        var dur = 1300, start = null;
        function step(ts) {
          if (!start) start = ts;
          var p = Math.min((ts - start) / dur, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(target * eased) + suffix;
          if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      });
    }, { threshold: 0.4 });
    counters.forEach(function (el) { cio.observe(el); });
  }

  /* ---------- FAQ accordion ---------- */
  document.querySelectorAll('.faq-item').forEach(function (item) {
    var q = item.querySelector('.faq-q');
    var a = item.querySelector('.faq-a');
    if (!q || !a) return;
    q.addEventListener('click', function () {
      var open = item.classList.toggle('open');
      a.style.maxHeight = open ? a.scrollHeight + 'px' : '0px';
      q.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });

  /* ---------- Currency toggle (USD / EUR) ---------- */
  var RATE_NOTE = 'Approximate EUR figure; billing settles in USD at checkout.';
  document.querySelectorAll('.currency-toggle').forEach(function (wrap) {
    wrap.querySelectorAll('button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        wrap.querySelectorAll('button').forEach(function (b) { b.classList.remove('on'); });
        btn.classList.add('on');
        var cur = btn.getAttribute('data-cur');
        document.querySelectorAll('[data-usd]').forEach(function (el) {
          el.textContent = (cur === 'eur') ? el.getAttribute('data-eur') : el.getAttribute('data-usd');
        });
        document.querySelectorAll('[data-cur-note]').forEach(function (el) {
          el.textContent = (cur === 'eur') ? RATE_NOTE : el.getAttribute('data-cur-note');
        });
      });
    });
  });

  /* ---------- Sample dossier viewer (demo rendering) ---------- */
  var viewer = document.getElementById('dossier-viewer');
  if (viewer) {
    var SECTIONS = [
      { n: 1, t: 'Cover & Document Identity',
        html: '<span class="doc-eyebrow">CBAMValid · Sample Dossier</span><h3>CBAM Definitive-Period<br>Audit-Preparation Dossier</h3>' +
          '<table><tr><td>Document ID</td><td>CBMV-SAMPLE-2026-0001</td></tr><tr><td>Report version</td><td>1.0</td></tr>' +
          '<tr><td>Reporting period</td><td>1 Jan 2026 – 31 Mar 2026</td></tr><tr><td>Goods scope</td><td>Iron &amp; steel · CN 7208 39 00</td></tr>' +
          '<tr><td>Country of origin</td><td>Türkiye</td></tr><tr><td>Member State of import</td><td>Germany</td></tr>' +
          '<tr><td>Ruleset</td><td>CBAM-DEFINITIVE-2026.1-DEMO</td></tr></table>' +
          '<div class="watermark"><b>PUBLIC SAMPLE NOTICE</b><br>Generated from fictional demonstration data. Not a customs declaration, not an official CBAM Registry submission, not an accredited verifier opinion.</div>' },
      { n: 2, t: 'Executive Decision Summary',
        html: '<span class="doc-eyebrow">Section 2</span><h3>Executive Decision Summary</h3>' +
          '<table><tr><td>Total embedded emissions</td><td>412.6 tCO₂e</td></tr><tr><td>Specific embedded emissions</td><td>1.72 tCO₂e / t</td></tr>' +
          '<tr><td>Data quality score</td><td>86%</td></tr><tr><td>Open blockers</td><td>0</td></tr><tr><td>Warnings</td><td>2</td></tr>' +
          '<tr><td>Evidence coverage</td><td>14 / 16 nodes</td></tr></table><div class="watermark">Fictional demonstration data.</div>' },
      { n: 3, t: 'Reporting Scope', html: '<span class="doc-eyebrow">Section 3</span><h3>Reporting Scope</h3><p>One installation, one reporting year. Boundaries follow the definitive-period ruleset: direct emissions, indirect emissions, and relevant precursors.</p><div class="watermark">Fictional demonstration data.</div>' },
      { n: 4, t: 'Entity & Installation Profile', html: '<span class="doc-eyebrow">Section 4</span><h3>Entity &amp; Installation Profile</h3><table><tr><td>Operator</td><td>Demo Steelworks A.Ş.</td></tr><tr><td>Installation ID</td><td>TR-DEMO-0042</td></tr><tr><td>Location</td><td>İskenderun, Türkiye</td></tr><tr><td>Production route</td><td>BF–BOF</td></tr></table><div class="watermark">Fictional demonstration data.</div>' },
      { n: 5, t: 'Goods & CN Classification', html: '<span class="doc-eyebrow">Section 5</span><h3>Goods &amp; CN Classification</h3><table><tr><td>CN code</td><td>7208 39 00</td></tr><tr><td>Description</td><td>Flat-rolled iron/steel, coils</td></tr><tr><td>Net mass</td><td>240 t</td></tr></table><div class="watermark">Fictional demonstration data.</div>' },
      { n: 6, t: 'Production Route', html: '<span class="doc-eyebrow">Section 6</span><h3>Production Route</h3><p>Blast furnace – basic oxygen furnace route with coke and sinter precursors mapped to monitoring boundaries.</p><div class="watermark">Fictional demonstration data.</div>' },
      { n: 7, t: 'Data Trust Model', html: '<span class="doc-eyebrow">Section 7</span><h3>Data Trust Model</h3><p>Every calculation node carries a provenance flag: measured, calculated, literature, or default value — with the applicable EU method cited per node.</p><div class="watermark">Fictional demonstration data.</div>' },
      { n: 8, t: 'Direct Emissions', html: '<span class="doc-eyebrow">Section 8</span><h3>Direct Emissions</h3><table><tr><td>Fuel combustion</td><td>298.4 tCO₂e</td></tr><tr><td>Process emissions</td><td>87.2 tCO₂e</td></tr><tr><td>Total direct</td><td>385.6 tCO₂e</td></tr></table><div class="watermark">Fictional demonstration data.</div>' },
      { n: 9, t: 'Indirect Emissions', html: '<span class="doc-eyebrow">Section 9</span><h3>Indirect Emissions</h3><table><tr><td>Electricity consumed</td><td>96.0 MWh</td></tr><tr><td>Grid factor</td><td>0.281 tCO₂e/MWh</td></tr><tr><td>Total indirect</td><td>27.0 tCO₂e</td></tr></table><div class="watermark">Fictional demonstration data.</div>' },
      { n: 10, t: 'Precursors & Adjustments', html: '<span class="doc-eyebrow">Section 10</span><h3>Precursors &amp; Adjustments</h3><p>Sinter, coke and purchased pig iron allocated per mass-balance rules; no double counting across boundaries.</p><div class="watermark">Fictional demonstration data.</div>' },
      { n: 11, t: 'Calculation Trace', html: '<span class="doc-eyebrow">Section 11</span><h3>Calculation Trace</h3><p>Deterministic engine replay: every figure expands to formula, inputs, emission factors and source references.</p><div class="watermark">Fictional demonstration data.</div>' },
      { n: 12, t: 'Quality Controls', html: '<span class="doc-eyebrow">Section 12</span><h3>Quality Controls</h3><table><tr><td>Automated checks run</td><td>148</td></tr><tr><td>Passed</td><td>144</td></tr><tr><td>Warnings</td><td>4</td></tr><tr><td>Blockers</td><td>0</td></tr></table><div class="watermark">Fictional demonstration data.</div>' },
      { n: 13, t: 'Evidence Register', html: '<span class="doc-eyebrow">Section 13</span><h3>Evidence Register</h3><p>16 evidence items linked to calculation nodes: invoices, meter logs, lab analyses, supplier declarations.</p><div class="watermark">Fictional demonstration data.</div>' },
      { n: 14, t: 'Ruleset & Sources', html: '<span class="doc-eyebrow">Section 14</span><h3>Ruleset &amp; Sources</h3><table><tr><td>Regulation (EU) 2023/956</td><td>Applied</td></tr><tr><td>Impl. Reg. (EU) 2023/1773</td><td>Applied</td></tr><tr><td>Ruleset version</td><td>2026.1-DEMO</td></tr></table><div class="watermark">Fictional demonstration data.</div>' },
      { n: 15, t: 'Integrity Manifest', html: '<span class="doc-eyebrow">Section 15</span><h3>Integrity Manifest</h3><table><tr><td>SHA-256 (PDF)</td><td>9f2a…c41d</td></tr><tr><td>SHA-256 (JSON)</td><td>77be…08aa</td></tr><tr><td>Sealed at</td><td>2026-04-02 11:48 UTC</td></tr></table><div class="watermark">Fictional demonstration data.</div>' },
      { n: 16, t: 'Limitations & Deliverables', html: '<span class="doc-eyebrow">Section 16</span><h3>Limitations &amp; Deliverables</h3><p>Preparation package only — not an accredited third-party verification statement. Deliverables: sealed PDF, canonical JSON, O3CI-mapped XLSX.</p><div class="watermark">Fictional demonstration data.</div>' }
    ];

    var thumbs = viewer.querySelector('.viewer-thumbs');
    var doc = viewer.querySelector('.viewer-doc');
    var toc = viewer.querySelector('.toc-list');
    var pageLbl = viewer.querySelector('[data-page-label]');

    function render(i) {
      doc.innerHTML = SECTIONS[i].html;
      if (pageLbl) pageLbl.textContent = 'Page ' + SECTIONS[i].n + ' of 16';
      thumbs.querySelectorAll('.vthumb').forEach(function (t, k) { t.classList.toggle('on', k === i); });
      if (toc) toc.querySelectorAll('li').forEach(function (t, k) { t.classList.toggle('on', k === i); });
    }
    SECTIONS.forEach(function (s, i) {
      var b = document.createElement('button');
      b.className = 'vthumb'; b.type = 'button';
      b.innerHTML = '<span class="pg">' + s.n + '</span><span>p.</span>';
      b.setAttribute('aria-label', 'Open page ' + s.n + ': ' + s.t);
      b.addEventListener('click', function () { render(i); });
      thumbs.appendChild(b);
      if (toc) {
        var li = document.createElement('li');
        li.textContent = s.n + '. ' + s.t;
        li.addEventListener('click', function () { render(i); });
        toc.appendChild(li);
      }
    });
    render(0);
  }

  /* ---------- Verify demo ---------- */
  var vForm = document.getElementById('verify-form');
  if (vForm) {
    vForm.addEventListener('submit', function (e) {
      e.preventDefault();
      /* TODO-BACKEND: POST dossier ID to /api/verify and render the real
         integrity-manifest result here. This static build shows the UI state only. */
      var res = document.getElementById('verify-result');
      res.className = 'verify-result show demo';
      res.innerHTML = '<b>Demo mode.</b> In production this panel returns the sealed dossier’s integrity manifest (SHA-256 hashes, seal timestamp, ruleset version) fetched from the verification API.';
    });
  }
})();
