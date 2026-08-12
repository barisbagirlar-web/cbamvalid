"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { legalConfig } from "@/lib/legal-config";

const PRODUCT_LINKS = [
  { href: "/product", label: "Product" },
  { href: "/product-classification", label: "Product Classification" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/sample-dossier", label: "Sample Dossier" },
  { href: "/methodology", label: "Methodology & Sources" },
  { href: "/pricing", label: "Pricing" },
  { href: "/verify", label: "Verify" },
  { href: "/demo", label: "Product Demo" },
  { href: "/rulesets", label: "Published Rulesets" },
  { href: "/buyer-link", label: "Buyer Share Link" },
  { href: "/platform", label: "Platform Architecture" },
  { href: "/trust", label: "Trust Registry" },
] as const;

const GUIDE_LINKS = [
  { href: "/answers", label: "Answer Bank" },
  { href: "/glossary", label: "CBAM Glossary" },
  { href: "/cbam-2026-definitive-period", label: "2026 Definitive Period" },
  { href: "/cbam-verification-preparation", label: "Independent Review Preparation" },
  { href: "/cbam-non-eu-producer-guide", label: "Non-EU Producer Guide" },
  { href: "/cbam-embedded-emissions-calculation", label: "Embedded Emissions" },
  { href: "/cn-code", label: "CN Code Scope Hub" },
] as const;

const COMPANY_LINKS = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/security", label: "Security & DPA" },
  { href: "/status", label: "Status" },
  { href: "/case-studies", label: "Case Studies" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/legal-notice", label: "Legal Notice" },
] as const;

function useDesktopFooterOpen(): boolean {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const sync = () => setOpen(!media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return open;
}

function FooterColumn({
  title,
  links,
  forceOpen,
}: {
  title: string;
  links: readonly { href: string; label: string }[];
  forceOpen: boolean;
}) {
  return (
    <details className="footer-col footer-accordion" open={forceOpen || undefined}>
      <summary className="footer-accordion-summary">
        <h4>{title}</h4>
        <span className="footer-accordion-icon" aria-hidden="true" />
      </summary>
      <ul>
        {links.map((item) => (
          <li key={item.href}>
            <Link href={item.href}>{item.label}</Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function AppFooter() {
  const desktopOpen = useDesktopFooterOpen();

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
                <span className="brand-sub">Self-Service Emissions Data Software</span>
              </span>
            </Link>
            <p>
              B2B self-service software for customer-entered emissions data, automated calculations,
              quality controls and automated PDF, JSON and XLSX delivery.
            </p>
            <div className="footer-badges">
              <span className="f-badge">Software only</span>
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

          <FooterColumn title="Product" links={PRODUCT_LINKS} forceOpen={desktopOpen} />
          <FooterColumn title="Guides" links={GUIDE_LINKS} forceOpen={desktopOpen} />
          <FooterColumn title="Company" links={COMPANY_LINKS} forceOpen={desktopOpen} />
        </div>

        <div className="footer-legal-row">
          <div className="footer-legal-links">
            <Link className="footer-legal-dup" href="/privacy">
              Privacy
            </Link>
            <Link className="footer-legal-dup" href="/terms">
              Terms
            </Link>
            <Link href="/cookie-policy">Cookies</Link>
            <Link href="/refund-policy">Refund Policy</Link>
            <Link className="footer-legal-dup" href="/security">
              Security
            </Link>
            <Link className="footer-legal-dup" href="/legal-notice">
              Legal notice
            </Link>
            <Link href="/product-classification">Product classification</Link>
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
            <b>Software Classification:</b>{" "}
            <span className="disclaimer-full">
              CBAMValid is privately operated self-service B2B software. Customers enter and control
              their own data; the application performs automated calculations, quality controls and
              digital file generation. Review the{" "}
              <Link href="/product-classification">Product Classification Statement</Link> and{" "}
              <Link href="/terms">Terms of Service</Link> for the complete commercial scope.
            </span>
            <span className="disclaimer-compact">
              Privately operated self-service B2B software.{" "}
              <Link href="/product-classification">Classification</Link> ·{" "}
              <Link href="/terms">Terms</Link>
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}
