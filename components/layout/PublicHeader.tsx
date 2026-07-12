"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { PUBLIC_NAV } from "@/lib/navigation";
import { BrandLockup } from "@/components/brand/BrandLockup";

export function PublicHeader() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close menus on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const navLinks = PUBLIC_NAV;

  return (
    <header data-testid="public-header" className="sticky top-0 z-50 w-full bg-surface border-b border-border/80">
      <div className="max-w-[1440px] mx-auto px-[clamp(24px,4vw,48px)] h-16 md:h-[76px] flex items-center justify-between">
        
        {/* LEFT: Logo area */}
        <div className="flex-shrink-0 flex items-center">
          <BrandLockup />
        </div>

        {/* CENTER: Desktop Navigation */}
        <nav className="hidden lg:flex flex-1 items-center justify-center gap-7" aria-label="Main Navigation">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link 
                key={link.label}
                href={link.href} 
                className={`text-[15px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm px-1 py-1 ${isActive ? "text-foreground" : "text-muted hover:text-foreground"}`}
                aria-current={isActive ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* RIGHT: Actions */}
        <div className="flex-shrink-0 flex items-center gap-4 lg:gap-5">
          <Link 
            href="/login" 
            className="hidden sm:block text-[15px] font-medium text-foreground hover:text-accent transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm px-2 py-1"
          >
            Sign In
          </Link>
          <Link 
            href="/register?next=/cases/new" 
            className="inline-flex h-[42px] md:h-[44px] items-center justify-center gap-2 rounded-md bg-accent px-5 font-medium text-surface transition-colors hover:bg-accent-hover active:bg-accent-active outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent shadow-sm"
          >
            Start a Dossier
          </Link>

          {/* Mobile menu toggle */}
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 text-foreground hover:bg-border/50 rounded-md cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent w-11 h-11 flex items-center justify-center"
            aria-label="Toggle mobile menu"
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div id="mobile-menu" className="lg:hidden absolute top-full left-0 w-full bg-surface border-b border-border shadow-lg animate-in slide-in-from-top-2 overflow-y-auto max-h-[calc(100vh-64px)] z-40">
          <nav className="flex flex-col py-2" aria-label="Mobile Navigation">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link 
                  key={link.label}
                  href={link.href} 
                  className={`px-6 py-3 text-[15px] font-medium border-l-4 transition-colors outline-none focus-visible:bg-border/30 ${isActive ? "border-accent text-accent bg-accent/5" : "border-transparent text-foreground hover:bg-border/30"}`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="my-2 border-t border-border"></div>
            <Link 
              href="/login" 
              className="flex w-full items-center px-6 py-3 text-[15px] font-medium text-foreground hover:text-accent transition-colors outline-none focus-visible:bg-border/30 rounded-sm"
            >
              Sign In
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

