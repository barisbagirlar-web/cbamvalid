"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import { doc, onSnapshot } from "firebase/firestore";
import { firebaseDb } from "@/lib/firebase/client";
import { Menu, X, User, LogOut, Shield, FileText, LayoutDashboard, CreditCard, Activity, Plus } from "lucide-react";
import { BrandLockup } from "@/components/brand/BrandLockup";
import { APP_NAV } from "@/lib/navigation";

export function AppHeader() {
  const { user, claims, signOutUser, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  
  const [availableCredits, setAvailableCredits] = useState<number>(0);
  const [availableUses, setAvailableUses] = useState<number>(0);

  const isAdmin = claims?.admin === true || claims?.ownerAdmin === true;

  // Listen to live credit balance
  useEffect(() => {
    if (user && !isAdmin) {
      const unsub = onSnapshot(doc(firebaseDb, "users", user.uid, "creditSummary", "current"), (snapshot) => {
        if (snapshot.exists()) {
          const credits = snapshot.data().availableCredits || 0;
          setAvailableCredits(credits);
          setAvailableUses(Math.floor(credits / 20)); // 100 credits = 5 uses, so 1 use = 20 credits
        } else {
          setAvailableCredits(0);
          setAvailableUses(0);
        }
      });
      return () => unsub();
    }
  }, [user, isAdmin]);

  // Click outside listener for account menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsAccountMenuOpen(false);
  }, [pathname]);

  if (loading) {
    return (
      <header data-testid="app-header" className="sticky top-0 z-50 w-full bg-surface border-b border-border/80 h-16 md:h-[76px] flex items-center justify-between px-[clamp(24px,4vw,48px)]">
        <div className="animate-pulse w-32 h-6 bg-border rounded"></div>
      </header>
    );
  }

  // AppHeader is only for authenticated users
  if (!user) return null;

  const renderNavLinks = () => {
    if (isAdmin) {
      return (
        <nav className="hidden md:flex items-center gap-7 lg:gap-9" aria-label="Main Navigation">
          <Link href="/admin" className={`text-[15px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm px-1 py-1 ${pathname === "/admin" ? "text-accent" : "text-muted hover:text-foreground"}`}>Admin Console</Link>
          <Link href="/admin/users" className={`text-[15px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm px-1 py-1 ${pathname.startsWith("/admin/users") ? "text-accent" : "text-muted hover:text-foreground"}`}>Users</Link>
          <Link href="/admin/reports" className={`text-[15px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm px-1 py-1 ${pathname.startsWith("/admin/reports") ? "text-accent" : "text-muted hover:text-foreground"}`}>Reports</Link>
          <Link href="/admin/audit" className={`text-[15px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm px-1 py-1 ${pathname.startsWith("/admin/audit") ? "text-accent" : "text-muted hover:text-foreground"}`}>Audit</Link>
        </nav>
      );
    }

    return (
      <nav className="hidden md:flex items-center gap-7 lg:gap-9" aria-label="Main Navigation">
        {APP_NAV.map((link) => {
          const isActive = pathname === link.href || (link.href !== "/dashboard" && pathname.startsWith(link.href));
          return (
            <Link 
              key={link.label}
              href={link.href} 
              className={`text-[15px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm px-1 py-1 ${isActive ? "text-foreground" : "text-muted hover:text-foreground"}`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    );
  };

  const renderAccountMenu = () => {
    return (
      <div className="relative" ref={accountMenuRef}>
        <button 
          onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-border/30 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-expanded={isAccountMenuOpen}
          aria-label="User account menu"
        >
          <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center text-accent font-semibold text-[15px] border border-accent/20">
            {user.email?.[0].toUpperCase() || "U"}
          </div>
          <span className="hidden lg:block text-[15px] font-medium max-w-[120px] truncate" aria-label={user.email || ""}>
            {user.displayName || user.email?.split("@")[0]}
          </span>
        </button>

        {isAccountMenuOpen && (
          <div className="absolute right-0 mt-2 w-56 bg-surface border border-border shadow-[var(--shadow-card)] rounded-xl py-2 z-50 animate-in fade-in slide-in-from-top-2">
            <div className="px-4 py-2 border-b border-border/50 mb-1">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-0.5">Signed in as</p>
              <p className="text-sm font-medium text-foreground truncate" title={user.email || ""}>{user.email}</p>
            </div>
            
            <Link href="/account" className="flex items-center gap-3 px-4 py-2 text-[15px] text-foreground hover:bg-border/30 transition-colors outline-none focus-visible:bg-border/30">
              <User className="w-4 h-4 text-muted" /> Account
            </Link>
            {!isAdmin && (
              <Link href="/credits/buy" className="flex items-center gap-3 px-4 py-2 text-[15px] text-foreground hover:bg-border/30 transition-colors outline-none focus-visible:bg-border/30">
                <CreditCard className="w-4 h-4 text-muted" /> Billing & Packs
              </Link>
            )}
            <Link href="/account#security" className="flex items-center gap-3 px-4 py-2 text-[15px] text-foreground hover:bg-border/30 transition-colors outline-none focus-visible:bg-border/30">
              <Shield className="w-4 h-4 text-muted" /> Security
            </Link>
            
            <div className="my-1 border-t border-border/50"></div>
            
            <button 
              onClick={signOutUser}
              className="flex w-full items-center gap-3 px-4 py-2 text-[15px] text-[rgb(220,38,38)] hover:bg-[rgba(220,38,38,0.05)] transition-colors cursor-pointer outline-none focus-visible:bg-[rgba(220,38,38,0.05)]"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <header data-testid="app-header" className="sticky top-0 z-50 w-full bg-surface border-b border-border/80">
      <div className="max-w-[1440px] mx-auto px-[clamp(24px,4vw,48px)] h-16 md:h-[76px] flex items-center justify-between">
        
        {/* LEFT: Logo area - fit content */}
        <div className="flex-shrink-0 flex items-center">
          <BrandLockup />
        </div>

        {/* CENTER: Navigation - flexible */}
        <div className="flex-1 flex justify-center px-4">
          {renderNavLinks()}
        </div>

        {/* RIGHT: Actions - no wrap */}
        <div className="flex-shrink-0 flex items-center gap-4 lg:gap-5">
          {!isAdmin && (
            <Link href="/credits/buy" className="hidden lg:flex items-center gap-2 bg-surface hover:bg-border/30 transition-colors text-foreground px-4 py-1.5 rounded-full border border-border outline-none focus-visible:ring-2 focus-visible:ring-accent">
              <span className="text-[13px] font-medium text-muted">
                {availableUses > 0 ? (
                  <>1 Active Preparation Pack &middot; <span className="text-foreground">{availableUses} Sealed Versions Left</span></>
                ) : (
                  <>No Active Preparation Pack</>
                )}
              </span>
            </Link>
          )}

          {!isAdmin && availableUses === 0 && (
            <Link 
              href="/credits/buy" 
              className="hidden lg:inline-flex h-[44px] items-center justify-center gap-2 rounded-md bg-accent px-5 text-[15px] font-medium text-surface transition-colors hover:bg-accent-hover active:bg-accent-active outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent shadow-sm"
            >
              Buy Pack — $150
            </Link>
          )}

          {!isAdmin && (
            <Link 
              href="/cases/new" 
              className="hidden md:inline-flex h-[44px] items-center justify-center gap-2 rounded-md bg-accent px-5 text-[15px] font-medium text-surface transition-colors hover:bg-accent-hover active:bg-accent-active outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Create New Case
            </Link>
          )}
          
          {renderAccountMenu()}

          {/* Mobile menu toggle */}
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-foreground hover:bg-border/50 rounded-md cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent w-11 h-11 flex items-center justify-center"
            aria-label="Toggle mobile menu"
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-app-menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer (traps focus and prevents horizontal overflow) */}
      {isMobileMenuOpen && (
        <div id="mobile-app-menu" className="md:hidden absolute top-full left-0 w-full bg-surface border-b border-border shadow-lg animate-in slide-in-from-top-2 overflow-y-auto max-h-[calc(100vh-64px)] z-40">
          <nav className="flex flex-col py-2" aria-label="Mobile Application Navigation">
            {!isAdmin && (
              <div className="px-6 py-4 mb-2 bg-accent/5 border-b border-border">
                <Link href="/credits/buy" className="flex items-center justify-between outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm">
                  <span className="text-[15px] font-semibold text-muted uppercase tracking-wider">Preparation Pack</span>
                  <div className="flex items-center gap-2">
                    {availableUses > 0 ? (
                      <span className="text-sm font-bold text-accent px-2 py-1 bg-accent/10 rounded">{availableUses} Versions Left</span>
                    ) : (
                      <span className="text-sm text-muted">No Active Pack</span>
                    )}
                  </div>
                </Link>
                <Link 
                  href="/cases/new" 
                  className="mt-4 flex w-full h-[44px] items-center justify-center gap-2 rounded-md bg-accent px-5 font-medium text-surface transition-colors hover:bg-accent-hover outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent"
                >
                  <Plus className="w-4 h-4" />
                  Create New Case
                </Link>
              </div>
            )}
            
            {isAdmin ? (
              <>
                <Link href="/admin" className={`px-6 py-3 text-[15px] font-medium border-l-4 outline-none focus-visible:bg-border/30 ${pathname === "/admin" ? "border-accent text-accent bg-accent/5" : "border-transparent text-foreground"}`}>Admin Console</Link>
                <Link href="/admin/users" className={`px-6 py-3 text-[15px] font-medium border-l-4 outline-none focus-visible:bg-border/30 ${pathname.startsWith("/admin/users") ? "border-accent text-accent bg-accent/5" : "border-transparent text-foreground"}`}>Users</Link>
                <Link href="/admin/reports" className={`px-6 py-3 text-[15px] font-medium border-l-4 outline-none focus-visible:bg-border/30 ${pathname.startsWith("/admin/reports") ? "border-accent text-accent bg-accent/5" : "border-transparent text-foreground"}`}>Reports</Link>
                <Link href="/admin/audit" className={`px-6 py-3 text-[15px] font-medium border-l-4 outline-none focus-visible:bg-border/30 ${pathname.startsWith("/admin/audit") ? "border-accent text-accent bg-accent/5" : "border-transparent text-foreground"}`}>Audit</Link>
              </>
            ) : (
              <>
                {APP_NAV.map((link) => {
                  const isActive = pathname === link.href || (link.href !== "/dashboard" && pathname.startsWith(link.href));
                  return (
                    <Link 
                      key={link.label}
                      href={link.href} 
                      className={`px-6 py-3 text-[15px] font-medium border-l-4 outline-none focus-visible:bg-border/30 ${isActive ? "border-accent text-accent bg-accent/5" : "border-transparent text-foreground"}`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </>
            )}
            
            <div className="my-2 border-t border-border"></div>
            
            <Link href="/account" className="flex items-center gap-3 px-6 py-3 text-[15px] text-foreground outline-none focus-visible:bg-border/30">
              <User className="w-5 h-5 text-muted" /> Account Settings
            </Link>
            <button 
              onClick={signOutUser}
              className="flex w-full items-center gap-3 px-6 py-3 text-[15px] text-[rgb(220,38,38)] outline-none focus-visible:bg-[rgba(220,38,38,0.05)] cursor-pointer text-left"
            >
              <LogOut className="w-5 h-5" /> Sign Out
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}

