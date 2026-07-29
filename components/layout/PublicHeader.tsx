"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/brand/BrandMark";
import { AUTHORITY_MORE_NAV } from "@/lib/marketing/authority-surfaces";

const PRIMARY_NAV = [
  { href: "/product", label: "Product" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/sample-dossier", label: "Sample" },
  { href: "/pricing", label: "Pricing" },
  { href: "/verify", label: "Verify" },
] as const;

/** Authority + deeper surfaces — derived from marketing SSOT (Trust, Rulesets, …). */
const MORE_NAV = AUTHORITY_MORE_NAV;


export function PublicHeader() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const id = globalThis.setTimeout(() => setIsMobileMenuOpen(false), 0);
    return () => globalThis.clearTimeout(id);
  }, [pathname]);

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isMobileMenuOpen]);

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
          <Link href="/trust">Trust registry →</Link>
          <Link href="/rulesets">See the ruleset →</Link>
        </div>
      </div>

      <header className="site-header" data-testid="public-header">
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
            <Link href="/login" className="signin">
              Sign In
            </Link>
            <Link href="/register?next=/cases/new" className="btn btn-primary">
              Start a Dossier
            </Link>
            <button
              ref={menuButtonRef}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`nav-toggle ${isMobileMenuOpen ? "open" : ""}`}
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMobileMenuOpen}
              aria-controls="public-mobile-navigation"
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
        id="public-mobile-navigation"
        className={`mobile-nav ${isMobileMenuOpen ? "open" : ""}`}
        aria-label="Mobile navigation"
        aria-hidden={!isMobileMenuOpen}
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
