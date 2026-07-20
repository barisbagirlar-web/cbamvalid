"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, ShieldCheck, CreditCard } from "lucide-react";
import { useAuth } from "@/context/AuthProvider";
import { CREDIT_PACKAGES } from "@/lib/billing/catalog";
import { initializePaddle, Paddle } from "@paddle/paddle-js";
import { CANONICAL_PRICING } from "@/lib/billing/pricing-config";

export default function BuyCreditsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [paddle, setPaddle] = useState<Paddle | null>(null);
  const [loadingPkg, setLoadingPkg] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [publicPaidLaunchEnabled, setPublicPaidLaunchEnabled] = useState<boolean>(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [fetchingConfig, setFetchingConfig] = useState(true);

  const packages = CREDIT_PACKAGES.filter((p) => p.active).sort((a, b) => a.displayOrder - b.displayOrder);
  const pkg = packages[0];

  useEffect(() => {
    if (!loading && !user) {
      router.push(`/login?next=/credits/buy`);
    }
  }, [user, loading, router]);

  useEffect(() => {
    // Check custom claims for admin/pilot status
    if (user) {
      user.getIdTokenResult().then((tokenResult: any) => {
        const role = tokenResult.claims.role;
        const adminClaim = tokenResult.claims.admin === true;
        const pilotClaim = tokenResult.claims.pilot === true;
        setIsAdmin(adminClaim || pilotClaim || role === "admin" || role === "Owner" || role === "pilot");
      }).catch(console.error);
    }
  }, [user]);

  useEffect(() => {
    // Fetch pricing and public launch status from API
    setFetchingConfig(true);
    fetch("/api/pricing")
      .then((res) => res.json())
      .then((data) => {
        setPublicPaidLaunchEnabled(data.publicPaidLaunchEnabled === true);
      })
      .catch((err) => {
        console.error("Failed to fetch pricing config:", err);
      })
      .finally(() => {
        setFetchingConfig(false);
      });
  }, []);

  useEffect(() => {
    // Initialize Paddle Billing Sandbox/Production
    initializePaddle({ 
      environment: process.env.NEXT_PUBLIC_PADDLE_ENV === 'production' ? 'production' : 'sandbox',
      token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || 'test_82d61d560c5a1a1f0a2e...', 
    }).then((paddleInstance) => {
      if (paddleInstance) {
        setPaddle(paddleInstance);
      }
    }).catch((err) => {
      console.error("Failed to initialize Paddle", err);
    });
  }, []);

  const handleCheckout = async (slug: string) => {
    if (!user) {
      router.push(`/login?next=/credits/buy`);
      return;
    }
    
    if (!paddle) {
      setError("Payment system is initializing. Please wait.");
      return;
    }

    setLoadingPkg(slug);
    setError("");

    try {
      // Get ID token for API authentication
      const idToken = await user.getIdToken();
      
      // Call secure server order creation API
      const res = await fetch("/api/checkout/cbam", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({ slug }),
      });

      const data = await res.json();
      if (!res.ok || data.status === "error") {
        throw new Error(data.message || "Failed to create checkout session.");
      }

      // Open checkout via transaction ID
      paddle.Checkout.open({
        transactionId: data.data.transactionId,
        settings: {
          displayMode: "overlay",
          theme: "light",
          successUrl: `${window.location.origin}/dashboard?success=true`,
        }
      });
      
    } catch (err: any) {
      setError(err.message || "Checkout could not be started.");
    } finally {
      setLoadingPkg(null);
    }
  };

  if (!pkg) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 py-12 sm:px-6 lg:py-16">
        <p className="text-muted">No active credit packages available.</p>
      </main>
    );
  }

  const isCheckoutBlocked = !publicPaidLaunchEnabled && !isAdmin;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 py-12 sm:px-6 lg:py-16 text-center">
      {/* Header */}
      <div className="mb-10 max-w-xl">
        <h1 className="text-3xl md:text-4xl font-serif font-bold mb-4 text-foreground">
          Purchase Preparation Pack
        </h1>
        <p className="text-muted text-sm md:text-base leading-relaxed">
          Unlock your verifier-preparation dossier compilation for independent accredited-verification.
        </p>
      </div>

      {/* Error state */}
      {error && (
        <div className="w-full max-w-md mb-8 p-4 bg-red-50 text-red-700 border border-red-200 rounded-md font-medium text-sm whitespace-pre-line text-center">
          {error}
        </div>
      )}

      {/* Commercial package card */}
      <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-8 shadow-sm flex flex-col items-center">
        <div className="mb-6">
          <h3 className="text-2xl font-bold mb-2 text-foreground">
            {pkg.packName}
          </h3>
          <p className="text-muted text-sm">
            Includes {pkg.cbamReportUses} Sealed Releases
          </p>
        </div>
        
        <div className="mb-6">
          <span className="text-5xl font-bold font-serif text-foreground">{pkg.priceFormatted}</span>
        </div>
        
        <ul className="mb-8 space-y-4 w-full">
          <li className="flex items-center justify-center gap-2">
            <Check className="w-5 h-5 text-accent shrink-0" />
            <span className="text-sm text-foreground">1 Installation and 1 Reporting Year</span>
          </li>
          <li className="flex items-center justify-center gap-2">
            <Check className="w-5 h-5 text-accent shrink-0" />
            <span className="text-sm text-foreground">5 Sealed Releases included</span>
          </li>
          <li className="flex items-center justify-center gap-2">
            <Check className="w-5 h-5 text-accent shrink-0" />
            <span className="text-sm text-foreground">Emissions calculations and validation</span>
          </li>
          <li className="flex items-center justify-center gap-2">
            <Check className="w-5 h-5 text-accent shrink-0" />
            <span className="text-sm text-foreground">Unlimited draft revisions</span>
          </li>
          <li className="flex items-center justify-center gap-2">
            <Check className="w-5 h-5 text-accent shrink-0" />
            <span className="text-sm text-foreground">O3CI field-mapped structured data export</span>
          </li>
        </ul>

        {isCheckoutBlocked ? (
          <div className="w-full p-4 bg-accent/5 text-accent border border-accent/20 rounded-md font-medium text-xs text-center leading-relaxed">
            Purchasing is temporarily unavailable while final launch checks are completed.
          </div>
        ) : (
          <button 
            onClick={() => handleCheckout(pkg.slug)}
            disabled={loadingPkg !== null || fetchingConfig}
            className="w-full h-[44px] flex items-center justify-center rounded-md font-medium bg-accent text-surface hover:bg-accent-hover transition-colors disabled:opacity-70 cursor-pointer"
          >
            {loadingPkg === pkg.slug ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Get Preparation Pack'}
          </button>
        )}
      </div>

      {/* Product usage explanation */}
      <div className="mt-12 max-w-md space-y-3">
        <h4 className="font-bold text-foreground text-sm">How Sealing & Releases Work</h4>
        <p className="text-muted text-xs leading-relaxed">
          Preparing case drafts and performing calculations is completely free. 
          Entitlements are consumed only when you seal a report and generate the final dossier. 
          The Exporter Verification Preparation Pack includes up to 5 successful sealed releases for corrections or updates.
        </p>
      </div>

      {/* Trust statement */}
      <div className="mt-8 flex items-center justify-center gap-2 text-muted text-xs">
        <ShieldCheck className="w-4 h-4 text-muted" />
        Payments are securely processed by Paddle, our Merchant of Record.
      </div>
    </main>
  );
}
