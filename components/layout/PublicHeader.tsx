"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/brand/BrandMark";

export function PublicHeader() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const id = globalThis.setTimeout(() => setIsMobileMenuOpen(false), 0);
    return () => globalThis.clearTimeout(id);
  }, [pathname]);

  const isActive = (path: string) => (pathname === path ? "active" : "");

  return (
    <>
      <div className="topbar">
        <div className="wrap">
          <span className="dot" aria-hidden="true"></span>
          <span>
            <b>CBAM definitive period is now in force.</b> 2026 annual declarations are due — prepare your evidence dossier early.
          </span>
          <Link href="/rulesets">See the ruleset →</Link>
        </div>
      </div>

      <header className="site-header">
        <div className="wrap">
          <Link href="/" className="brand" aria-label="CBAMValid home">
            <BrandMark />
            <span style={{ display: "flex", flexDirection: "column" }}>
              <span className="brand-name">
                CBAM<em>Valid</em>
              </span>
              <span className="brand-sub">Carbon Border Compliance Validation</span>
            </span>
          </Link>

          <nav className="main-nav" aria-label="Main navigation">
            <Link href="/product" className={isActive("/product")}>
              Product
            </Link>
            <Link href="/how-it-works" className={isActive("/how-it-works")}>
              How It Works
            </Link>
            <Link href="/sample-dossier" className={isActive("/sample-dossier")}>
              Sample Dossier
            </Link>
            <Link href="/methodology" className={isActive("/methodology")}>
              Methodology &amp; Sources
            </Link>
            <Link href="/pricing" className={isActive("/pricing")}>
              Pricing
            </Link>
            <Link href="/demo" className={isActive("/demo")}>
              Book a Demo
            </Link>
            <Link href="/verify" className={isActive("/verify")}>
              Verify a Dossier
            </Link>
            <Link href="/verifier-review" className={isActive("/verifier-review")}>
              Structure Review
            </Link>
          </nav>

          <div className="header-actions">
            <Link href="/login" className="signin">
              Sign In
            </Link>
            <Link href="/register?next=/cases/new" className="btn btn-primary">
              Start a Dossier
            </Link>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`nav-toggle ${isMobileMenuOpen ? "open" : ""}`}
              aria-label="Toggle menu"
              aria-expanded={isMobileMenuOpen}
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>
        </div>
      </header>

      <nav
        className={`mobile-nav ${isMobileMenuOpen ? "open" : ""}`}
        aria-label="Mobile navigation"
        style={{ display: isMobileMenuOpen ? "flex" : "none" }}
      >
        <Link href="/product">Product</Link>
        <Link href="/how-it-works">How It Works</Link>
        <Link href="/sample-dossier">Sample Dossier</Link>
        <Link href="/methodology">Methodology &amp; Sources</Link>
        <Link href="/pricing">Pricing</Link>
        <Link href="/demo">Book a Demo</Link>
        <Link href="/verify">Verify a Dossier</Link>
        <Link href="/verifier-review">Structure Review</Link>
        <Link href="/login">Sign In</Link>
      </nav>
    </>
  );
}
