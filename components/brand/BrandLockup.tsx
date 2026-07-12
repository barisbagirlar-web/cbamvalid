import React from "react";
import Link from "next/link";
import { SITE_CONFIG } from "@/lib/site-config";

export function BrandLockup() {
  return (
    <Link 
      href="/" 
      className="flex items-center outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm shrink-0"
      aria-label={`${SITE_CONFIG.name} Home`}
    >
      <img 
        src={SITE_CONFIG.logo.lockup} 
        alt={`${SITE_CONFIG.name} Logo`} 
        className="h-[34px] md:h-[38px] w-auto object-contain block" 
      />
    </Link>
  );
}
