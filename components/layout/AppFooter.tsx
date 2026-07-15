"use client";

import Link from "next/link";
import { legalConfig } from "@/lib/legal-config";
import { BrandLockup } from "@/components/brand/BrandLockup";

export default function AppFooter() {
  return (
    <footer className="border-t border-border bg-background py-12 text-sm text-muted font-sans" data-testid="app-footer">
      <div className="max-w-7xl mx-auto px-6 flex flex-col items-center text-center space-y-8">
        
        {/* CENTERED BRAND */}
        <div className="flex flex-col items-center space-y-3">
          <BrandLockup />
          <p className="max-w-md leading-relaxed text-muted/90">
            Independent software for deterministic Carbon Border Adjustment Mechanism calculations and compliance documentation.
          </p>
        </div>

        {/* CENTERED NAVIGATION */}
        <nav className="flex flex-wrap justify-center gap-x-8 gap-y-2 font-medium" aria-label="Footer Navigation">
          <Link href="/product" className="hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm px-1">Product</Link>
          <Link href="/how-it-works" className="hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm px-1">How It Works</Link>
          <Link href="/sample-dossier" className="hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm px-1">Sample Dossier</Link>
          <Link href="/methodology" className="hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm px-1">Methodology & Sources</Link>
          <Link href="/pricing" className="hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm px-1">Pricing</Link>
          <Link href="/verify" className="hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm px-1">Verify a Dossier</Link>
          <Link href="/contact" className="hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm px-1">Contact Support</Link>
        </nav>

        {/* CENTERED SUPPORT */}
        <div className="text-center font-medium">
          Support: <a href={`mailto:${legalConfig.supportEmail}`} className="text-accent hover:underline font-mono outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm px-1">{legalConfig.supportEmail}</a>
        </div>

        {/* CENTERED LEGAL */}
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs" aria-label="Footer Legal Links">
          <Link href="/privacy" className="hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm px-1">Privacy Notice</Link>
          <Link href="/terms" className="hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm px-1">Terms of Service</Link>
          <Link href="/cookie-policy" className="hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm px-1">Cookie Policy</Link>
          <Link href="/refund-policy" className="hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm px-1">Refund Policy</Link>
          <Link href="/legal-notice" className="hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm px-1">Legal Notice</Link>
        </nav>

        {/* CENTERED COPYRIGHT */}
        <div className="text-xs text-muted/75 space-y-1">
          <p>&copy; {new Date().getFullYear()} {legalConfig.legalEntityName}. All rights reserved.</p>
          <p>{legalConfig.country}</p>
        </div>
      </div>

      {/* INDEPENDENCE NOTICE */}
      <div className="max-w-4xl mx-auto px-6 mt-10 pt-6 border-t border-border/60 text-xs text-center text-subtle leading-relaxed">
        <strong>Independence Notice:</strong> CBAMValid is an independent software service and is not an official European Commission or CBAM Registry service. <br/>
        Not officially endorsed by the EU, not guaranteed for official authority acceptance. Users are fully responsible for their declarative data.
      </div>
    </footer>
  );
}
