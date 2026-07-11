"use client";

import Link from "next/link";
import { legalConfig } from "@/lib/legal-config";

export default function AppFooter() {
  return (
    <footer className="border-t border-border bg-background py-12 text-sm text-muted font-sans">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="space-y-4">
          <h3 className="font-serif font-black text-foreground text-lg">CBAMValid</h3>
          <p className="leading-relaxed">
            Independent software for deterministic Carbon Border Adjustment Mechanism calculations and compliance documentation.
          </p>
          <div className="text-xs space-y-1">
            <p>&copy; {new Date().getFullYear()} {legalConfig.legalEntityName}</p>
            <p>{legalConfig.country}</p>
          </div>
        </div>

        <div>
          <h4 className="font-bold text-foreground mb-4">Resources</h4>
          <ul className="space-y-2">
            <li><Link href="/about" className="hover:text-foreground transition-colors">About Us</Link></li>
            <li><Link href="/methodology" className="hover:text-foreground transition-colors">Methodology & Sources</Link></li>
            <li><Link href="/contact" className="hover:text-foreground transition-colors">Contact Support</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-foreground mb-4">Legal</h4>
          <ul className="space-y-2">
            <li><Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link></li>
            <li><Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Notice</Link></li>
            <li><Link href="/refund-policy" className="hover:text-foreground transition-colors">Refund Policy</Link></li>
            <li><Link href="/cookie-policy" className="hover:text-foreground transition-colors">Cookie Policy</Link></li>
            <li><Link href="/legal-notice" className="hover:text-foreground transition-colors">Legal Notice</Link></li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 mt-12 pt-6 border-t border-border text-xs text-center text-subtle">
        <strong>Independence Notice:</strong> CBAMValid is an independent software service and is not an official European Commission or CBAM Registry service. <br/>
        Not EU certified, not guaranteed for official authority acceptance. Users are fully responsible for their declarative data.
      </div>
    </footer>
  );
}
