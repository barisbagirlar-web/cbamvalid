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
      

  <section className="hero" style={{"paddingBottom":"48px"}}>
    <div className="wrap" style={{"textAlign":"center"}}>
      <span className="eyebrow">The Complete Workflow</span>
      <h1 style={{"maxWidth":"820px","marginLeft":"auto","marginRight":"auto"}}>How <span className="serif-i">CBAMValid</span> works</h1>
      <p className="lede" style={{"margin":"0 auto"}}>Build a structured dossier for one installation and one reporting year. Enter production and emissions data, link supporting evidence, resolve quality findings, and generate a sealed verifier-preparation package.</p>
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


    </main>
  );
}