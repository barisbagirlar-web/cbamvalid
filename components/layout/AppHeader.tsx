"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import { doc, onSnapshot } from "firebase/firestore";
import { firebaseDb } from "@/lib/firebase/client";
import { Menu, X, User, LogOut, Shield, FileText, LayoutDashboard, CreditCard, Activity } from "lucide-react";

export function AppHeader() {
  const { user, claims, signOutUser, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  
  const [availableCredits, setAvailableCredits] = useState<number>(0);

  const isAdmin = claims?.admin === true || claims?.ownerAdmin === true;

  // Listen to live credit balance
  useEffect(() => {
    if (user && !isAdmin) {
      const unsub = onSnapshot(doc(firebaseDb, "users", user.uid, "creditSummary", "current"), (snapshot) => {
        if (snapshot.exists()) {
          setAvailableCredits(snapshot.data().availableCredits || 0);
        } else {
          setAvailableCredits(0);
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
      <header className="sticky top-0 z-50 w-full bg-surface border-b border-border shadow-sm h-16 flex items-center justify-between px-6">
        <div className="animate-pulse w-32 h-6 bg-border rounded"></div>
      </header>
    );
  }

  const renderNavLinks = () => {
    if (!user) {
      return (
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-semibold text-foreground hover:text-accent transition-colors">Sign In</Link>
          <Link href="/register" className="text-sm font-semibold text-surface bg-accent px-4 py-2 rounded-md hover:bg-accent-hover transition-colors">Create Account</Link>
        </div>
      );
    }

    if (isAdmin) {
      return (
        <div className="hidden md:flex items-center gap-6">
          <Link href="/admin" className={`text-sm font-semibold ${pathname === "/admin" ? "text-accent" : "text-muted hover:text-foreground"}`}>Admin Console</Link>
          <Link href="/admin/users" className={`text-sm font-semibold ${pathname.startsWith("/admin/users") ? "text-accent" : "text-muted hover:text-foreground"}`}>Users</Link>
          <Link href="/admin/reports" className={`text-sm font-semibold ${pathname.startsWith("/admin/reports") ? "text-accent" : "text-muted hover:text-foreground"}`}>Reports</Link>
          <Link href="/admin/audit" className={`text-sm font-semibold ${pathname.startsWith("/admin/audit") ? "text-accent" : "text-muted hover:text-foreground"}`}>Audit</Link>
        </div>
      );
    }

    return (
      <div className="hidden md:flex items-center gap-6">
        <Link href="/cbam" className={`text-sm font-semibold ${pathname === "/cbam" || pathname === "/dashboard" ? "text-accent" : "text-muted hover:text-foreground"}`}>Dashboard</Link>
        <Link href="/cbam/new" className={`text-sm font-semibold ${pathname === "/cbam/new" ? "text-accent" : "text-muted hover:text-foreground"}`}>Create New Case</Link>
        <Link href="/dashboard/reports" className={`text-sm font-semibold ${pathname.startsWith("/dashboard/reports") ? "text-accent" : "text-muted hover:text-foreground"}`}>Reports</Link>
      </div>
    );
  };

  const renderAccountMenu = () => {
    if (!user) return null;

    return (
      <div className="relative" ref={accountMenuRef}>
        <button 
          onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-border/30 transition-colors cursor-pointer"
          aria-expanded={isAccountMenuOpen}
        >
          <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent font-semibold text-sm">
            {user.email?.[0].toUpperCase() || "U"}
          </div>
          <span className="hidden lg:block text-sm font-medium max-w-[120px] truncate">
            {user.displayName || user.email}
          </span>
        </button>

        {isAccountMenuOpen && (
          <div className="absolute right-0 mt-2 w-56 bg-surface border border-border shadow-[var(--shadow-card)] rounded-xl py-2 z-50 animate-in fade-in slide-in-from-top-2">
            <div className="px-4 py-2 border-b border-border/50 mb-1">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-0.5">Signed in as</p>
              <p className="text-sm font-medium text-foreground truncate">{user.email}</p>
            </div>
            
            <Link href="/account" className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-border/30 transition-colors">
              <User className="w-4 h-4 text-muted" /> Account
            </Link>
            {!isAdmin && (
              <Link href="/account#credits" className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-border/30 transition-colors">
                <CreditCard className="w-4 h-4 text-muted" /> Credits & Usage
              </Link>
            )}
            <Link href="/account#security" className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-border/30 transition-colors">
              <Shield className="w-4 h-4 text-muted" /> Security
            </Link>
            
            <div className="my-1 border-t border-border/50"></div>
            
            <button 
              onClick={signOutUser}
              className="flex w-full items-center gap-3 px-4 py-2 text-sm text-[rgb(220,38,38)] hover:bg-[rgba(220,38,38,0.05)] transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-surface border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        
        {/* Logo area */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-3">
            <img src="/cbam_logo.svg" alt="CBAM Valid" className="h-6 w-auto" />
            <span className="font-serif text-lg font-bold tracking-tight text-foreground hidden sm:block">CBAM Valid</span>
          </Link>
          {renderNavLinks()}
        </div>

        {/* Right side area */}
        <div className="flex items-center gap-4">
          {user && !isAdmin && (
            <div className="hidden sm:flex items-center gap-2 bg-accent/10 text-accent px-3 py-1.5 rounded-full border border-accent/20">
              <span className="text-xs font-semibold uppercase tracking-wider">Credits</span>
              <span className="text-sm font-bold">{availableCredits}</span>
            </div>
          )}
          
          {user && renderAccountMenu()}

          {/* Mobile menu toggle */}
          {user && (
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-foreground hover:bg-border/50 rounded-md cursor-pointer"
              aria-label="Toggle mobile menu"
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          )}
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && user && (
        <div className="md:hidden bg-surface border-b border-border px-4 py-4 animate-in slide-in-from-top-2">
          {isAdmin ? (
            <div className="flex flex-col gap-2">
              <Link href="/admin" className="px-3 py-2 text-foreground font-medium rounded-md hover:bg-border/30">Admin Console</Link>
              <Link href="/admin/users" className="px-3 py-2 text-foreground font-medium rounded-md hover:bg-border/30">Users</Link>
              <Link href="/admin/reports" className="px-3 py-2 text-foreground font-medium rounded-md hover:bg-border/30">Reports</Link>
              <Link href="/admin/audit" className="px-3 py-2 text-foreground font-medium rounded-md hover:bg-border/30">Audit</Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-3 py-2 mb-2 bg-accent/5 rounded-md border border-accent/10">
                <span className="text-sm font-semibold text-accent uppercase tracking-wider">Credits Available</span>
                <span className="text-lg font-bold text-accent">{availableCredits}</span>
              </div>
              <Link href="/cbam" className="px-3 py-2 text-foreground font-medium rounded-md hover:bg-border/30">Dashboard</Link>
              <Link href="/cbam/new" className="px-3 py-2 text-foreground font-medium rounded-md hover:bg-border/30">Create New Case</Link>
              <Link href="/dashboard/reports" className="px-3 py-2 text-foreground font-medium rounded-md hover:bg-border/30">Reports</Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
