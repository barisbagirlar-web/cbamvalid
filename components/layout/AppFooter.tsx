"use client";

import React from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";

export default function AppFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link href="/" className="brand" aria-label="CBAMValid home">
              <BrandMark tone="on-dark" />
              <span>
                <span className="brand-name">
                  CBAM<em>Valid</em>
                </span>
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
              <li>
                <Link href="/product">Product</Link>
              </li>
              <li>
                <Link href="/how-it-works">How It Works</Link>
              </li>
              <li>
                <Link href="/sample-dossier">Sample Dossier</Link>
              </li>
              <li>
                <Link href="/methodology">Methodology &amp; Sources</Link>
              </li>
              <li>
                <Link href="/pricing">Pricing</Link>
              </li>
              <li>
                <Link href="/verify">Verify a Dossier</Link>
              </li>
              <li>
                <Link href="/verifier-review">Structure Review</Link>
              </li>
              <li>
                <Link href="/rulesets">Published Rulesets</Link>
              </li>
              <li>
                <Link href="/buyer-link">Buyer Share Link</Link>
              </li>
              <li>
                <Link href="/platform">Platform Architecture</Link>
              </li>
            </ul>
          </div>
          <div>
            <h4>CBAM Guides</h4>
            <ul>
              <li>
                <Link href="/answers">Answer Bank</Link>
              </li>
              <li>
                <Link href="/glossary">CBAM Glossary</Link>
              </li>
              <li>
                <Link href="/cbam-2026-definitive-period">2026 Definitive Period</Link>
              </li>
              <li>
                <Link href="/cbam-verification-preparation">Verification Preparation</Link>
              </li>
              <li>
                <Link href="/cbam-non-eu-producer-guide">Non-EU Producer Guide</Link>
              </li>
              <li>
                <Link href="/cbam-embedded-emissions-calculation">Embedded Emissions</Link>
              </li>
              <li>
                <Link href="/cn-code">CN Code Scope Hub</Link>
              </li>
            </ul>
          </div>
          <div>
            <h4>Legal</h4>
            <ul>
              <li>
                <Link href="/security">Security &amp; DPA</Link>
              </li>
              <li>
                <Link href="/privacy">Privacy Notice</Link>
              </li>
              <li>
                <Link href="/terms">Terms of Service</Link>
              </li>
              <li>
                <Link href="/cookie-policy">Cookie Policy</Link>
              </li>
              <li>
                <Link href="/refund-policy">Refund Policy</Link>
              </li>
              <li>
                <Link href="/legal-notice">Legal Notice</Link>
              </li>
            </ul>
          </div>
          <div>
            <h4>Contact &amp; Support</h4>
            <ul>
              <li>
                <Link href="/about">About CBAMValid</Link>
              </li>
              <li>
                <Link href="/contact">Contact</Link>
              </li>
              <li>
                <span className="f-lbl">Email Support</span>
                <a className="mono" href="mailto:info@cbamvalid.com">
                  info@cbamvalid.com
                </a>
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
