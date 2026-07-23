"use client";

import React from "react";
import Link from "next/link";

export default function AppFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link href="/" className="brand" aria-label="CBAMValid home">
              <svg className="brand-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                <path d="M20 3 35 9.5v9.7c0 8.9-6.2 15-15 17.8C11.2 34.2 5 28.1 5 19.2V9.5L20 3Z" stroke="#C0562F" strokeWidth="2.6" fill="rgba(192,86,47,.15)"/>
                <path d="m13.5 20.2 4.3 4.3 8.7-9" stroke="#C0562F" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>
                <span className="brand-name" style={{ color: "#fff" }}>CBAM<em>Valid</em></span>
                <span className="brand-sub">Carbon Border Compliance Validation</span>
              </span>
            </Link>
            <p>
              Independent software for Carbon Border Adjustment Mechanism (CBAM) calculations and compliance documentation.
            </p>
            <div className="footer-badges">
              <span className="f-badge">Data hosted in the EU</span>
              <span className="f-badge">GDPR</span>
              <span className="f-badge">SSL Secured</span>
            </div>
          </div>
          <div>
            <h4>Product</h4>
            <ul>
              <li><Link href="/product">Product</Link></li>
              <li><Link href="/how-it-works">How It Works</Link></li>
              <li><Link href="/sample-dossier">Sample Dossier</Link></li>
              <li><Link href="/methodology">Methodology &amp; Sources</Link></li>
              <li><Link href="/pricing">Pricing</Link></li>
              <li><Link href="/verify">Verify a Dossier</Link></li>
            </ul>
          </div>
          <div>
            <h4>Legal</h4>
            <ul>
              <li><Link href="/privacy">Privacy Notice</Link></li>
              <li><Link href="/terms">Terms of Service</Link></li>
              <li><Link href="/cookie-policy">Cookie Policy</Link></li>
              <li><Link href="/refund-policy">Refund Policy</Link></li>
              <li><Link href="/legal-notice">Legal Notice</Link></li>
            </ul>
          </div>
          <div>
            <h4>Contact &amp; Support</h4>
            <ul>
              <li>
                <span className="f-lbl">Email Support</span>
                <a className="mono font-semibold" href="mailto:info@cbamvalid.com">info@cbamvalid.com</a>
              </li>
              <li>
                <span className="f-lbl">Location</span>
                <span className="f-val">Republic of Ireland</span>
              </li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} SectorCalc Corporation (CBAMValid). All rights reserved.</p>
          <p className="disclaimer">
            <b>Independence Notice:</b> CBAMValid is an independent software service for exporter-to-importer evidence packaging. It is not an EU institution, customs authority or accredited CBAM verifier. Actual emissions data must be independently verified where verification is legally required.
          </p>
        </div>
      </div>
    </footer>
  );
}
