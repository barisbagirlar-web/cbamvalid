"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { CreditCard, LogOut, Menu, Shield, User, X } from "lucide-react";
import { useAuth } from "@/context/AuthProvider";
import { firebaseDb } from "@/lib/firebase/client";
import { APP_NAV } from "@/lib/navigation";
import { BrandLockup } from "@/components/brand/BrandLockup";
import {
  formatPreparationPackPrice,
  PREPARATION_PACK,
  releasesFromCredits,
} from "@/lib/commerce/preparation-pack";

export function AppHeader() {
  const { user, claims, signOutUser, loading } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [availableCredits, setAvailableCredits] = useState(0);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const isAdminPresentation =
    claims?.email_verified === true &&
    claims?.role === "super_admin" &&
    claims?.owner === true;

  useEffect(() => {
    if (!user || isAdminPresentation) {
      setAvailableCredits(0);
      return;
    }
    return onSnapshot(
      doc(firebaseDb, "users", user.uid, "creditSummary", "current"),
      (snapshot) => {
        const credits = Number(snapshot.data()?.availableCredits || 0);
        setAvailableCredits(Number.isSafeInteger(credits) && credits >= 0 ? credits : 0);
      },
      (error) => {
        console.error("Credit balance listener failed", error);
        setAvailableCredits(0);
      }
    );
  }, [isAdminPresentation, user]);

  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    };
    document.addEventListener("mousedown", closeOutside);
    return () => document.removeEventListener("mousedown", closeOutside);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  if (loading) {
    return <header data-testid="app-header" className="sticky top-0 z-50 h-16 border-b border-border/80 bg-surface px-6 md:h-[76px]"><div className="mt-5 h-6 w-32 animate-pulse rounded bg-border" /></header>;
  }
  if (!user) return null;

  const estimatedReleases = releasesFromCredits(availableCredits);
  const userLinks = APP_NAV.map((link) => ({ ...link, active: pathname === link.href || (link.href !== "/cbam" && pathname.startsWith(link.href)) }));
  const adminLinks = [
    ["Admin Console", "/admin"],
    ["Users", "/admin/users"],
    ["Reports", "/admin/reports"],
    ["Audit", "/admin/audit"],
  ] as const;

  return (
    <header data-testid="app-header" className="sticky top-0 z-50 w-full border-b border-border/80 bg-surface">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-[clamp(24px,4vw,48px)] md:h-[76px]">
        <div className="shrink-0"><BrandLockup /></div>
        <nav className="hidden flex-1 items-center justify-center gap-7 px-4 md:flex" aria-label="Main Navigation">
          {(isAdminPresentation ? adminLinks.map(([label, href]) => ({ label, href, active: pathname === href || pathname.startsWith(`${href}/`) })) : userLinks).map((link) => (
            <Link key={link.href} href={link.href} className={`rounded-sm px-1 py-1 text-[15px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent ${link.active ? "text-accent" : "text-muted hover:text-foreground"}`}>{link.label}</Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-3 lg:gap-5">
          {!isAdminPresentation && (
            <Link href="/credits/buy" className="hidden items-center rounded-full border border-border bg-surface px-4 py-1.5 text-[13px] lg:flex">
              {availableCredits > 0
                ? <><span className="text-muted">{availableCredits} credits · </span><span className="ml-1 font-semibold">up to {estimatedReleases} seals</span></>
                : <span className="text-muted">No seal credits</span>}
            </Link>
          )}
          {!isAdminPresentation && availableCredits < PREPARATION_PACK.creditsPerRelease && (
            <Link href="/credits/buy" className="hidden h-11 items-center justify-center rounded-md bg-accent px-5 text-[15px] font-medium text-surface shadow-sm hover:bg-accent-hover lg:inline-flex">
              Buy Pack — {formatPreparationPackPrice()}
            </Link>
          )}

          <div className="relative" ref={accountMenuRef}>
            <button type="button" onClick={() => setAccountOpen((value) => !value)} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-border/30 focus-visible:ring-2 focus-visible:ring-accent" aria-expanded={accountOpen} aria-label="User account menu">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-accent/20 bg-accent/10 text-[15px] font-semibold text-accent">{user.email?.[0]?.toUpperCase() || "U"}</div>
              <span className="hidden max-w-[120px] truncate text-[15px] font-medium lg:block">{user.displayName || user.email?.split("@")[0]}</span>
            </button>
            {accountOpen && (
              <div className="absolute right-0 z-50 mt-2 w-60 rounded-xl border border-border bg-surface py-2 shadow-[var(--shadow-card)]">
                <div className="mb-1 border-b border-border/50 px-4 py-2"><p className="text-xs font-semibold uppercase tracking-wider text-muted">Signed in as</p><p className="truncate text-sm font-medium">{user.email}</p></div>
                <Link href="/account" className="flex items-center gap-3 px-4 py-2 text-[15px] hover:bg-border/30"><User className="h-4 w-4 text-muted" />Account</Link>
                {!isAdminPresentation && <Link href="/credits/buy" className="flex items-center gap-3 px-4 py-2 text-[15px] hover:bg-border/30"><CreditCard className="h-4 w-4 text-muted" />Billing & Pack</Link>}
                <Link href="/account#security" className="flex items-center gap-3 px-4 py-2 text-[15px] hover:bg-border/30"><Shield className="h-4 w-4 text-muted" />Security</Link>
                <div className="my-1 border-t border-border/50" />
                <button type="button" onClick={signOutUser} className="flex w-full items-center gap-3 px-4 py-2 text-[15px] text-red-600 hover:bg-red-50"><LogOut className="h-4 w-4" />Sign Out</button>
              </div>
            )}
          </div>

          <button type="button" onClick={() => setMobileOpen((value) => !value)} className="flex h-11 w-11 items-center justify-center rounded-md md:hidden" aria-label="Toggle mobile menu" aria-expanded={mobileOpen}>{mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="absolute left-0 top-full z-40 flex max-h-[calc(100vh-64px)] w-full flex-col overflow-y-auto border-b border-border bg-surface py-2 shadow-lg md:hidden" aria-label="Mobile Application Navigation">
          {!isAdminPresentation && <Link href="/credits/buy" className="flex items-center justify-between border-b border-border bg-accent/5 px-6 py-4"><span className="text-sm font-semibold">Credits</span><span className="rounded bg-accent/10 px-2 py-1 text-sm font-bold text-accent">{availableCredits} · {estimatedReleases} seals</span></Link>}
          {(isAdminPresentation ? adminLinks.map(([label, href]) => ({ label, href })) : userLinks).map((link) => <Link key={link.href} href={link.href} className="border-l-4 border-transparent px-6 py-3 text-[15px] font-medium hover:border-accent hover:bg-accent/5">{link.label}</Link>)}
          <div className="my-2 border-t border-border" />
          <Link href="/account" className="flex items-center gap-3 px-6 py-3 text-[15px]"><User className="h-5 w-5 text-muted" />Account Settings</Link>
          <button type="button" onClick={signOutUser} className="flex w-full items-center gap-3 px-6 py-3 text-[15px] text-red-600"><LogOut className="h-5 w-5" />Sign Out</button>
        </nav>
      )}
    </header>
  );
}
