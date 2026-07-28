"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/brand/BrandMark";

const PRIMARY_NAV = [
  { href: "/product", label: "Product" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/sample-dossier", label: "Sample" },
  { href: "/pricing", label: "Pricing" },
  { href: "/verify", label: "Verify" },
] as const;

const MORE_NAV = [
  { href: "/methodology", label: "Methodology & Sources" },
  { href: "/verifier-review", label: "Structure Review" },
  { href: "/rulesets", label: "Published Rulesets" },
  { href: "/security", label: "Security & DPA" },
  { href: "/demo", label: "Book a Demo" },
] as const;

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
            <b>CBAM definitive period is now in force.</b> 2026 annual declarations are due — prepare
            your evidence dossier early.
          </span>
          <Link href="/rulesets">See the ruleset →</Link>
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
              <span className="brand-sub">Carbon Border Compliance Validation</span>
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
            <Link href="/demo" className="btn btn-ghost header-demo">
              Book a Demo
            </Link>
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
        className={`mobile-nav ${isMobileMenuOpen ? "open" : ""}`}
        aria-label="Mobile navigation"
        style={{ display: isMobileMenuOpen ? "flex" : "none" }}
      >
        {[...PRIMARY_NAV, ...MORE_NAV].map((item) => (
          <Link key={item.href} href={item.href}>
            {item.label}
          </Link>
        ))}
        <Link href="/login">Sign In</Link>
        <Link href="/register?next=/cases/new">Start a Dossier</Link>
      </nav>
    </>
  );
}
