"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLockup } from "@/components/brand/BrandLockup";

export function AuthHeader() {
  const pathname = usePathname();
  const isLogin = pathname.startsWith("/login");

  return (
    <header data-testid="auth-header" className="w-full bg-surface border-b border-border shadow-sm">
      <div className="max-w-[1440px] mx-auto px-6 h-16 md:h-[72px] flex items-center justify-between">
        
        {/* LEFT: Logo area */}
        <div className="flex items-center">
          <BrandLockup />
        </div>

        {/* RIGHT: Actions */}
        <div className="flex items-center gap-4">
          {isLogin ? (
            <>
              <span className="hidden sm:block text-[15px] text-muted font-medium">
                New to CBAMValid?
              </span>
              <Link 
                href="/register" 
                className="inline-flex h-[42px] md:h-[44px] items-center justify-center gap-2 rounded-md border border-border bg-transparent px-5 font-medium text-foreground transition-colors hover:bg-neutral-soft outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent"
              >
                Create Account
              </Link>
            </>
          ) : (
            <>
              <span className="hidden sm:block text-[15px] text-muted font-medium">
                Already have an account?
              </span>
              <Link 
                href="/login" 
                className="inline-flex h-[42px] md:h-[44px] items-center justify-center gap-2 rounded-md border border-border bg-transparent px-5 font-medium text-foreground transition-colors hover:bg-neutral-soft outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent"
              >
                Sign In
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
