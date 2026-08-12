"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/brand/BrandMark";
import { AUTHORITY_MORE_NAV } from "@/lib/marketing/authority-surfaces";

const PRIMARY_NAV = [
  { href: "/product", label: "Product" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/sample-dossier", label: "Sample" },
  { href: "/pricing", label: "Pricing" },
  { href: "/demo", label: "Product Demo" },
  { href: "/verify", label: "Verify" },
] as const;

/** Authority + deeper surfaces — derived from marketing SSOT (Trust, Rulesets, …). */
const MORE_NAV = AUTHORITY_MORE_NAV;

const MOBILE_NAV_ID = "public-mobile-nav";

export function PublicHeader() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const id = globalThis.setTimeout(() => setIsMobileMenuOpen(false), 0);
    return () => globalThis.clearTimeout(id);
  }, [pathname]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = isMobileMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isMobileMenuOpen]);

  const isActive = (path: string) => (pathname === path ? "active" : "");

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="topbar">
        <div className="wrap">
          <span className="dot" aria-hidden="true"></span>
          <span>
            <b>Self-service B2B software.</b> Customer-entered data, automated calculations and
            PDF/JSON/XLSX delivery.
          </span>
          <Link href="/product-classification">Product classification →</Link>
          <Link href="/pricing">Software pricing →</Link>
        </div>
      </div>

      <header className="site-header">
        <div className="wrap">
          <Link href="/" className="brand" aria-label="CBAMValid home">
            <BrandMark />
            <span>
              <span className="brand-name">
                CBAM<em>Valid</em>
              </span>
              <span className="brand-sub">Self-Service Emissions Data Software</span>
            </span>
          </Link>

          <nav className="main-nav" aria-label="Main navigation">
            {PRIMARY_NAV.map((item) => (
              <Link key={item.href} href={item.href} className={isActive(item.href)}>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="header-actions">
            <Link href="/login" className="signin">
              Sign In
            </Link>
            <Link href="/register?next=/cases/new" className="btn btn-primary">
              Start Free Draft
            </Link>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`nav-toggle ${isMobileMenuOpen ? "open" : ""}`}
              aria-label="Toggle menu"
              aria-expanded={isMobileMenuOpen}
              aria-controls={MOBILE_NAV_ID}
              type="button"
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>
        </div>
      </header>

      <nav
        id={MOBILE_NAV_ID}
        className={`mobile-nav ${isMobileMenuOpen ? "open" : ""}`}
        aria-label="Mobile navigation"
        style={{ display: isMobileMenuOpen ? "flex" : "none" }}
      >
        {[...PRIMARY_NAV, ...MORE_NAV].map((item) => (
          <Link key={item.href} href={item.href}>
            {item.label}
          </Link>
        ))}
        <Link href="/product-classification">Product Classification</Link>
        <Link href="/login">Sign In</Link>
        <Link href="/register?next=/cases/new">Start Free Draft</Link>
      </nav>
    </>
  );
}
