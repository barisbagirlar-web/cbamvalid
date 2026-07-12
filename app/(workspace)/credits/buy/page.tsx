"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthProvider";
import { CREDIT_PACKAGES } from "@/lib/billing/catalog";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { initializePaddle, Paddle } from "@paddle/paddle-js";
import { useRouter } from "next/navigation";

class ClientApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ClientApiError";
    this.code = code;
  }
}

interface ApiResponseEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  requestId?: string;
}

async function readApiResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const raw = await response.text();

  if (!contentType.includes("application/json")) {
    throw new ClientApiError(
      "NON_JSON_RESPONSE",
      "Checkout could not be started."
    );
  }

  let parsed: ApiResponseEnvelope<T>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ClientApiError(
      "INVALID_JSON_RESPONSE",
      "Checkout could not be started."
    );
  }

  if (!parsed.ok || !parsed.data) {
    const refText = parsed.requestId ? `\nReference: ${parsed.requestId}` : "";
    throw new ClientApiError(
      parsed.error?.code || "CHECKOUT_FAILED",
      `Checkout could not be started.${refText}`
    );
  }

  return parsed.data;
}

export default function BuyCreditsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [paddle, setPaddle] = useState<Paddle | null>(null);
  const [loadingPkg, setLoadingPkg] = useState<string | null>(null);
  const [error, setError] = useState("");

  const packages = CREDIT_PACKAGES.filter((p) => p.active).sort((a, b) => a.displayOrder - b.displayOrder);
  const pkg = packages[0];

  useEffect(() => {
    if (!loading && !user) {
      router.push(`/login?next=/credits/buy`);
    }
  }, [user, loading, router]);

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
      const orderId = `ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const productCode = slug === "cbam-5-reports" ? "CBAM_CREDIT_PACK_5" : "CBAM_EXPORTER_FINAL_REPORT";

      paddle.Checkout.open({
        items: [
          {
            priceId: pkg.paddlePriceId,
            quantity: 1,
          }
        ],
        customData: {
          uid: user.uid,
          productCode: productCode,
          orderId: orderId,
        },
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

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 py-12 sm:px-6 lg:py-16 text-center">
      {/* Header */}
      <div className="mb-10 max-w-xl">
        <h1 className="text-3xl md:text-4xl font-serif font-bold mb-4 text-foreground">
          Purchase Account Credits
        </h1>
        <p className="text-muted text-sm md:text-base leading-relaxed">
          Top up your account balance to generate definitive, sealed CBAM reports.
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
            {pkg.cbamReportUses} CBAM Reports
          </h3>
          <p className="text-muted text-sm">
            {pkg.accountCredits} account credits included
          </p>
        </div>
        
        <div className="mb-6">
          <span className="text-5xl font-bold font-serif text-foreground">€150</span>
        </div>
        
        <ul className="mb-8 space-y-4 w-full">
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
            <span className="text-sm text-foreground">XML registry format output</span>
          </li>
        </ul>
        
        <button 
          onClick={() => handleCheckout(pkg.slug)}
          disabled={loadingPkg !== null}
          className="w-full h-[44px] flex items-center justify-center rounded-md font-medium bg-accent text-surface hover:bg-accent-hover transition-colors disabled:opacity-70 cursor-pointer"
        >
          {loadingPkg === pkg.slug ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Purchase Credits'}
        </button>
      </div>

      {/* Credit usage explanation */}
      <div className="mt-12 max-w-md space-y-3">
        <h4 className="font-bold text-foreground text-sm">How Credit Usage Works</h4>
        <p className="text-muted text-xs leading-relaxed">
          Preparing case drafts and performing calculations is completely free. 
          Credits are only consumed when you seal a report and generate the final dossier. 
          Each report seal consumes exactly 20 credits from your account balance.
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
