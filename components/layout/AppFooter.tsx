"use client";

import React from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { legalConfig } from "@/lib/legal-config";

const PRODUCT_LINKS = [
  { href: "/product", label: "Product" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/sample-dossier", label: "Sample Dossier" },
  { href: "/methodology", label: "Methodology & Sources" },
  { href: "/pricing", label: "Pricing" },
  { href: "/verify", label: "Verify a Dossier" },
  { href: "/demo", label: "Book a Demo" },
] as const;

const ENTERPRISE_LINKS = [
  { href: "/enterprise", label: "Enterprise Exclusive" },
  { href: "/verifier-review", label: "Structure Review" },
  { href: "/rulesets", label: "Published Rulesets" },
  { href: "/buyer-link", label: "Buyer Share Link" },
  { href: "/platform", label: "Platform Architecture" },
  { href: "/partners", label: "Partners" },
  { href: "/trust", label: "Trust Registry" },
] as const;

const GUIDE_LINKS = [
  { href: "/answers", label: "Answer Bank" },
  { href: "/glossary", label: "CBAM Glossary" },
  { href: "/cbam-2026-definitive-period", label: "2026 Definitive Period" },
  { href: "/cbam-verification-preparation", label: "Verification Preparation" },
  { href: "/cbam-non-eu-producer-guide", label: "Non-EU Producer Guide" },
  { href: "/cbam-embedded-emissions-calculation", label: "Embedded Emissions" },
  { href: "/cn-code", label: "CN Code Scope Hub" },
] as const;

const COMPANY_LINKS = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/security", label: "Security & DPA" },
  { href: "/case-studies", label: "Case Studies" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/legal-notice", label: "Legal Notice" },
] as const;

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: readonly { href: string; label: string }[];
}) {
  return (
    <div className="footer-col">
      <h4>{title}</h4>
      <ul>
        {links.map((item) => (
          <li key={item.href}>
            <Link href={item.href}>{item.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

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
              Independent software for CBAM verification preparation — sealed, evidence-linked
              dossiers for exporters and EU buyers.
            </p>
            <div className="footer-badges">
              <span className="f-badge">EU hosted</span>
              <span className="f-badge">GDPR</span>
              <span className="f-badge">TLS</span>
            </div>
            <div className="footer-contact-mini">
              <a className="mono" href="mailto:info@cbamvalid.com">
                info@cbamvalid.com
              </a>
              <span className="f-val">Dublin · Republic of Ireland</span>
            </div>
          </div>

          <FooterColumn title="Product" links={PRODUCT_LINKS} />
          <FooterColumn title="Enterprise" links={ENTERPRISE_LINKS} />
          <FooterColumn title="Guides" links={GUIDE_LINKS} />
          <FooterColumn title="Company" links={COMPANY_LINKS} />
        </div>

        <div className="footer-legal-row">
          <div className="footer-legal-links">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/cookie-policy">Cookies</Link>
            <Link href="/refund-policy">Refunds</Link>
            <Link href="/security">Security</Link>
            <Link href="/legal-notice">Legal notice</Link>
          </div>
        </div>

        <div className="footer-bottom">
          <p className="footer-copy">
            &copy; {new Date().getFullYear()} SectorCalc Corporation (CBAMValid). All rights reserved.
          </p>
          <div className="legal-identity-block">
            {legalConfig.identityPublication.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <p className="disclaimer">
            <b>Independence Notice:</b> CBAMValid is an independent software service for
            exporter-to-importer evidence packaging. It is not an EU institution, customs authority
            or accredited CBAM verifier. Actual emissions data must be independently verified where
            verification is legally required.
          </p>
        </div>
      </div>
    </footer>
  );
}
