"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthProvider";
import { CREDIT_PACKAGES } from "@/lib/billing/catalog";
import { CANONICAL_PRICING } from "@/lib/billing/pricing-config";
import { initializePaddle, Paddle } from "@paddle/paddle-js";

type CheckoutApiData = {
  mode: "transaction" | "items";
  orderId: string;
  correlationId: string;
  priceId: string;
  transactionId?: string;
};

export default function BuyCreditsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [paddle, setPaddle] = useState<Paddle | null>(null);
  const [loadingPkg, setLoadingPkg] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [publicPaidLaunchEnabled, setPublicPaidLaunchEnabled] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [fetchingConfig, setFetchingConfig] = useState(true);
  const [displayPriceFormatted, setDisplayPriceFormatted] = useState<string>(
    CANONICAL_PRICING.priceFormatted
  );

  const packages = CREDIT_PACKAGES.filter((p) => p.active).sort((a, b) => a.displayOrder - b.displayOrder);
  const pkg = packages[0];

  useEffect(() => {
    if (!loading && !user) {
      router.push(`/login?next=/credits/buy`);
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      user.getIdTokenResult().then((tokenResult) => {
        const role = tokenResult.claims.role;
        const adminClaim = tokenResult.claims.admin === true;
        const pilotClaim = tokenResult.claims.pilot === true;
        setIsAdmin(
          adminClaim ||
            pilotClaim ||
            role === "admin" ||
            role === "Owner" ||
            role === "pilot"
        );
      }).catch(console.error);
    }
  }, [user]);

  useEffect(() => {
    setFetchingConfig(true);
    fetch("/api/pricing")
      .then((res) => res.json())
      .then((data) => {
        setPublicPaidLaunchEnabled(data.publicPaidLaunchEnabled === true);
        if (typeof data.priceFormatted === "string" && data.priceFormatted.trim()) {
          setDisplayPriceFormatted(data.priceFormatted);
        } else if (typeof data.displayPrice === "string" && data.displayPrice.trim()) {
          setDisplayPriceFormatted(`$${data.displayPrice}`);
        } else {
          setDisplayPriceFormatted(CANONICAL_PRICING.priceFormatted);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch pricing config:", err);
        setPublicPaidLaunchEnabled(false);
        setDisplayPriceFormatted(CANONICAL_PRICING.priceFormatted);
      })
      .finally(() => {
        setFetchingConfig(false);
      });
  }, []);

  const confirmFulfillment = async (
    idToken: string,
    orderId: string,
    transactionId: string
  ) => {
    const confirmRes = await fetch("/api/checkout/confirm", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ orderId, transactionId }),
    });
    const confirmData = await confirmRes.json();
    if (!confirmRes.ok || confirmData.ok === false) {
      const message =
        confirmData?.error?.message ||
        confirmData?.message ||
        "Payment received but entitlement confirmation failed. Contact info@cbamvalid.com.";
      throw new Error(message);
    }
  };

  useEffect(() => {
    const useSandbox =
      process.env.NEXT_PUBLIC_PADDLE_SANDBOX === "true" ||
      process.env.NEXT_PUBLIC_PADDLE_ENV === "sandbox" ||
      process.env.NEXT_PUBLIC_PADDLE_ENV !== "production";
    initializePaddle({
      environment: useSandbox ? "sandbox" : "production",
      token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || "",
    }).then((paddleInstance) => {
      if (paddleInstance) {
        setPaddle(paddleInstance);
      }
    }).catch((err) => {
      console.error("Failed to initialize Paddle", err);
    });
  }, []);

  // Fulfill after Paddle redirects back with ?_ptxn=txn_...&orderId=...
  useEffect(() => {
    if (!user || loading) return;
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("orderId") || sessionStorage.getItem("cbam_pending_order_id") || "";
    const transactionId = params.get("_ptxn") || params.get("transactionId") || "";
    if (!orderId || !transactionId) return;
    if (params.get("purchase") !== "success" && !params.get("_ptxn")) return;

    let cancelled = false;
    (async () => {
      try {
        setLoadingPkg("confirming");
        const idToken = await user.getIdToken();
        await confirmFulfillment(idToken, orderId, transactionId);
        sessionStorage.removeItem("cbam_pending_order_id");
        if (!cancelled) {
          router.replace("/dashboard?purchase=success");
        }
      } catch (confirmErr: unknown) {
        if (!cancelled) {
          const message = confirmErr instanceof Error ? confirmErr.message : "Confirmation failed.";
          setError(message);
        }
      } finally {
        if (!cancelled) setLoadingPkg(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, loading, router]);

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
      const idToken = await user.getIdToken();
      const res = await fetch("/api/checkout/cbam", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ slug }),
      });

      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(
          data?.error?.message || data?.message || "Failed to create checkout session."
        );
      }

      const checkout = data.data as CheckoutApiData;
      if (!checkout?.orderId || !checkout?.priceId) {
        throw new Error("Checkout session response was incomplete.");
      }

      sessionStorage.setItem("cbam_pending_order_id", checkout.orderId);

      paddle.Update({
        eventCallback: async (event) => {
          if (event?.name !== "checkout.completed") return;
          const transactionId =
            (event.data as { transaction_id?: string; id?: string } | undefined)?.transaction_id ||
            (event.data as { id?: string } | undefined)?.id ||
            checkout.transactionId ||
            "";
          if (!transactionId) return;
          try {
            await confirmFulfillment(idToken, checkout.orderId, transactionId);
            sessionStorage.removeItem("cbam_pending_order_id");
            router.push("/dashboard?purchase=success");
          } catch (confirmErr: unknown) {
            const message = confirmErr instanceof Error ? confirmErr.message : "Confirmation failed.";
            setError(message);
          }
        },
      });

      const openSettings = {
        displayMode: "overlay" as const,
        theme: "light" as const,
        successUrl: `${window.location.origin}/credits/buy?purchase=success&orderId=${encodeURIComponent(checkout.orderId)}`,
      };

      if (checkout.mode === "transaction" && checkout.transactionId) {
        paddle.Checkout.open({
          transactionId: checkout.transactionId,
          settings: openSettings,
        });
      } else {
        paddle.Checkout.open({
          items: [{ priceId: checkout.priceId, quantity: 1 }],
          customData: {
            orderId: checkout.orderId,
            correlationId: checkout.correlationId,
          },
          settings: openSettings,
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Checkout could not be started.";
      setError(message);
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
      <div className="mb-10 max-w-xl">
        <h1 className="text-3xl md:text-4xl font-serif font-bold mb-4 text-foreground">
          Purchase Preparation Pack
        </h1>
        <p className="text-muted text-sm md:text-base leading-relaxed">
          One operator, one installation, one reporting year — unlimited drafts and five successful sealed releases.
          Your card is charged at checkout when you buy this pack.
        </p>
      </div>

      {error && (
        <div className="w-full max-w-md mb-8 p-4 bg-[color:var(--status-blocked-soft)] text-status-blocked border border-status-blocked/30 rounded-md font-medium text-sm whitespace-pre-line text-center">
          {error}
        </div>
      )}

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
          <span className="text-5xl font-bold font-serif text-foreground">
            {displayPriceFormatted || CANONICAL_PRICING.priceFormatted}
          </span>
        </div>

        <ul className="mb-8 space-y-4 w-full">
          <li className="flex items-center justify-center gap-2">
            <Check className="w-5 h-5 text-accent shrink-0" />
            <span className="text-sm text-foreground">1 operator · 1 installation · 1 reporting year</span>
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
            {loadingPkg === pkg.slug ? <Loader2 className="w-5 h-5 animate-spin" /> : "Get Preparation Pack"}
          </button>
        )}
      </div>

      <div className="mt-12 max-w-md space-y-3">
        <h4 className="font-bold text-foreground text-sm">How payment and sealing work</h4>
        <p className="text-muted text-xs leading-relaxed">
          Drafting and calculations are free. Your card is charged when you buy the Preparation Pack.
          Each successful seal uses one of the five included releases. Failed seals use none.
          Re-download of a sealed package is free and does not use a release.
        </p>
      </div>

      <div className="mt-8 flex items-center justify-center gap-2 text-muted text-xs">
        <ShieldCheck className="w-4 h-4 text-muted" />
        Payments are securely processed by Paddle, our Merchant of Record.
      </div>
    </main>
  );
}
