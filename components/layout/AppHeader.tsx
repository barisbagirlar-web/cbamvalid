"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { CreditCard, LogOut, Menu, Shield, User, X } from "lucide-react";
import { BrandLockup } from "@/components/brand/BrandLockup";
import { useAuth } from "@/context/AuthProvider";
import { COMMERCIAL_CONTRACT, formatCommercialPrice } from "@/lib/billing/commercial-contract";
import { firebaseDb } from "@/lib/firebase/client";
import { APP_NAV } from "@/lib/navigation";

export function AppHeader() {
  const { user, claims, signOutUser, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [availableCredits, setAvailableCredits] = useState(0);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const isAdmin = claims?.ownerAdmin === true || claims?.admin === true;

  useEffect(() => {
    if (!user || isAdmin) {
      setAvailableCredits(0);
      return;
    }
    return onSnapshot(
      doc(firebaseDb, "users", user.uid, "creditSummary", "current"),
      (snapshot) => {
        const value = snapshot.exists() ? Number(snapshot.data().availableCredits || 0) : 0;
        setAvailableCredits(Number.isSafeInteger(value) && value >= 0 ? value : 0);
      },
      (error) => {
        console.error("Credit summary listener failed", error);
        setAvailableCredits(0);
      }
    );
  }, [isAdmin, user]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) setAccountOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  if (loading) {
    return (
      <header data-testid="app-header" className="sticky top-0 z-50 flex h-16 items-center border-b border-border/80 bg-surface px-[clamp(24px,4vw,48px)] md:h-[76px]">
        <div className="h-6 w-32 animate-pulse rounded bg-border" />
      </header>
    );
  }
  if (!user) return null;

  const navLinks = isAdmin
    ? [
        { href: "/admin", label: "Admin Console" },
        { href: "/admin/users", label: "Users" },
        { href: "/admin/reports", label: "Reports" },
        { href: "/admin/audit", label: "Audit" },
      ]
    : APP_NAV;
  const packUnlocksAvailable = Math.floor(availableCredits / COMMERCIAL_CONTRACT.creditsRequiredToUnlock);

  const isActive = (href: string) =>
    pathname === href || (href !== "/cbam" && pathname.startsWith(`${href}/`));

  return (
    <header data-testid="app-header" className="sticky top-0 z-50 w-full border-b border-border/80 bg-surface">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-[clamp(24px,4vw,48px)] md:h-[76px]">
        <div className="flex shrink-0 items-center"><BrandLockup /></div>

        <nav className="hidden flex-1 items-center justify-center gap-7 px-4 md:flex lg:gap-9" aria-label="Main Navigation">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className={`rounded-sm px-1 py-1 text-[15px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent ${isActive(link.href) ? "text-accent" : "text-muted hover:text-foreground"}`}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-3 lg:gap-5">
          {!isAdmin && (
            <Link href="/credits/buy" className="hidden items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-[13px] transition-colors hover:bg-border/30 lg:flex">
              <span className="font-semibold text-foreground">{availableCredits} credits</span>
              <span className="text-muted">· {packUnlocksAvailable} pack unlock{packUnlocksAvailable === 1 ? "" : "s"} available</span>
            </Link>
          )}
          {!isAdmin && availableCredits < COMMERCIAL_CONTRACT.creditsRequiredToUnlock && (
            <Link href="/credits/buy" className="hidden h-11 items-center justify-center rounded-md bg-accent px-5 text-[15px] font-medium text-surface transition-colors hover:bg-accent-hover lg:inline-flex">
              Buy Pack — {formatCommercialPrice()}
            </Link>
          )}

          <div className="relative" ref={accountMenuRef}>
            <button type="button" onClick={() => setAccountOpen((value) => !value)} className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-border/30 focus-visible:ring-2 focus-visible:ring-accent" aria-expanded={accountOpen} aria-label="User account menu">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-accent/20 bg-accent/10 text-[15px] font-semibold text-accent">
                {user.email?.[0]?.toUpperCase() || "U"}
              </div>
              <span className="hidden max-w-[120px] truncate text-[15px] font-medium lg:block">{user.displayName || user.email?.split("@")[0]}</span>
            </button>
            {accountOpen && (
              <div className="absolute right-0 z-50 mt-2 w-60 rounded-xl border border-border bg-surface py-2 shadow-[var(--shadow-card)]">
                <div className="mb-1 border-b border-border/50 px-4 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">Signed in as</p>
                  <p className="truncate text-sm font-medium" title={user.email || ""}>{user.email}</p>
                </div>
                <Link href="/account" className="flex items-center gap-3 px-4 py-2 text-[15px] hover:bg-border/30"><User className="h-4 w-4 text-muted" /> Account</Link>
                {!isAdmin && <Link href="/credits/buy" className="flex items-center gap-3 px-4 py-2 text-[15px] hover:bg-border/30"><CreditCard className="h-4 w-4 text-muted" /> Billing & Packs</Link>}
                <Link href="/account#security" className="flex items-center gap-3 px-4 py-2 text-[15px] hover:bg-border/30"><Shield className="h-4 w-4 text-muted" /> Security</Link>
                <div className="my-1 border-t border-border/50" />
                <button type="button" onClick={() => void signOutUser()} className="flex w-full items-center gap-3 px-4 py-2 text-[15px] text-red-600 hover:bg-red-50"><LogOut className="h-4 w-4" /> Sign Out</button>
              </div>
            )}
          </div>

          <button type="button" onClick={() => setMobileOpen((value) => !value)} className="flex h-11 w-11 items-center justify-center rounded-md hover:bg-border/50 focus-visible:ring-2 focus-visible:ring-accent md:hidden" aria-label="Toggle mobile menu" aria-expanded={mobileOpen} aria-controls="mobile-app-menu">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div id="mobile-app-menu" className="absolute left-0 top-full z-40 max-h-[calc(100vh-64px)] w-full overflow-y-auto border-b border-border bg-surface shadow-lg md:hidden">
          {!isAdmin && (
            <Link href="/credits/buy" className="flex items-center justify-between border-b border-border bg-accent/5 px-6 py-4">
              <span className="text-sm font-semibold">{availableCredits} credits</span>
              <span className="text-sm text-muted">{packUnlocksAvailable} pack unlock{packUnlocksAvailable === 1 ? "" : "s"}</span>
            </Link>
          )}
          <nav className="flex flex-col py-2" aria-label="Mobile Application Navigation">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className={`border-l-4 px-6 py-3 text-[15px] font-medium ${isActive(link.href) ? "border-accent bg-accent/5 text-accent" : "border-transparent"}`}>
                {link.label}
              </Link>
            ))}
            <div className="my-2 border-t border-border" />
            <Link href="/account" className="flex items-center gap-3 px-6 py-3 text-[15px]"><User className="h-5 w-5 text-muted" /> Account Settings</Link>
            <button type="button" onClick={async () => { await signOutUser(); router.push("/login"); }} className="flex w-full items-center gap-3 px-6 py-3 text-left text-[15px] text-red-600"><LogOut className="h-5 w-5" /> Sign Out</button>
          </nav>
        </div>
      )}
    </header>
  );
}
