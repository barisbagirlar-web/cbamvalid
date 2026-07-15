"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import { useAuth } from "@/context/AuthProvider";
import { CREDIT_PACKAGES, formatPackagePrice } from "@/lib/billing/catalog";
import { COMMERCIAL_CONTRACT } from "@/lib/billing/commercial-contract";
import { createCommercialCheckout } from "@/lib/functions/commerce-client";

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : "Checkout could not be started.";
}

export default function BuyCreditsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const checkoutRequestId = useRef<string>(crypto.randomUUID());
  const [paddle, setPaddle] = useState<Paddle | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState("");
  const product = CREDIT_PACKAGES[0];

  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=/credits/buy");
  }, [loading, router, user]);

  useEffect(() => {
    let cancelled = false;
    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    const configuredEnvironment = process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT;
    if (!token || !["sandbox", "production"].includes(configuredEnvironment || "")) {
      setError("Payment system configuration is unavailable.");
      setInitializing(false);
      return;
    }

    void initializePaddle({
      environment: configuredEnvironment as "sandbox" | "production",
      token,
    })
      .then((instance) => {
        if (cancelled) return;
        if (!instance) throw new Error("PADDLE_CLIENT_INITIALIZATION_FAILED");
        setPaddle(instance);
        setInitializing(false);
      })
      .catch((initializationError: unknown) => {
        if (cancelled) return;
        console.error("Paddle initialization failed", initializationError);
        setError("Payment system initialization failed. No charge was created.");
        setInitializing(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleCheckout = async () => {
    if (!user) {
      router.replace("/login?next=/credits/buy");
      return;
    }
    if (!paddle) {
      setError("Payment system is not ready. Retry after initialization completes.");
      return;
    }

    setCheckoutLoading(true);
    setError("");
    try {
      const checkout = await createCommercialCheckout(checkoutRequestId.current);
      paddle.Checkout.open({
        transactionId: checkout.transactionId,
        settings: {
          displayMode: "overlay",
          theme: "light",
          successUrl: `${window.location.origin}/account?payment=completed`,
        },
      });
    } catch (checkoutError: unknown) {
      console.error("Server-controlled checkout failed", checkoutError);
      setError(errorMessage(checkoutError));
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (!product) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 py-16">
        <p className="text-muted">No active commercial product is available.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 py-12 text-center sm:px-6 lg:py-16">
      <div className="mb-10 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">One-time purchase · no subscription</p>
        <h1 className="mt-3 font-serif text-3xl font-bold text-foreground md:text-4xl">
          {product.displayName}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted md:text-base">
          Purchase {product.accountCredits} account credits. Use those credits once to unlock one case-scoped Preparation Pack with {product.cbamReportUses} sealed versions.
        </p>
      </div>

      {error && (
        <div role="alert" className="mb-8 w-full max-w-lg rounded-md border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <section className="flex w-full max-w-lg flex-col items-center rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-foreground">One Preparation Pack</h2>
          <p className="mt-2 text-sm text-muted">
            {product.accountCredits} credits → one selected case → {product.cbamReportUses} successful sealed releases
          </p>
        </div>

        <p className="my-7 font-serif text-5xl font-bold text-foreground">
          {formatPackagePrice(product)}
        </p>

        <ul className="mb-8 w-full space-y-4 text-left text-sm">
          {[
            "Unlimited draft editing and automated quality controls before sealing",
            "Five sealed versions for correction-controlled resubmission of one case",
            "27-component signed ZIP dossier with professional PDF and verifier XLSX",
            "Immutable manifest, KMS signature, evidence hashes and calculation trace",
            "No recurring subscription or automatic renewal",
          ].map((item) => (
            <li key={item} className="flex items-start gap-3">
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => void handleCheckout()}
          disabled={initializing || checkoutLoading || !paddle || !user}
          className="flex h-12 w-full items-center justify-center rounded-md bg-accent px-5 font-semibold text-surface transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {initializing || checkoutLoading ? <Loader2 className="h-5 w-5 animate-spin" aria-label="Preparing checkout" /> : `Purchase for ${formatPackagePrice(product)}`}
        </button>

        <p className="mt-4 text-xs leading-relaxed text-muted">
          A charge is created only by the server after validating the canonical product, price, currency and authenticated account.
        </p>
      </section>

      <section className="mt-10 max-w-2xl rounded-xl border border-border bg-neutral-soft p-6 text-left">
        <h3 className="font-bold text-foreground">Credit and release lifecycle</h3>
        <ol className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
          <li>1. Paddle confirms the {formatPackagePrice(product)} payment through a signed webhook.</li>
          <li>2. The server atomically credits {COMMERCIAL_CONTRACT.creditsGranted} account credits.</li>
          <li>3. Inside a selected case, you unlock one pack; exactly {COMMERCIAL_CONTRACT.creditsRequiredToUnlock} credits are deducted once.</li>
          <li>4. The case receives {COMMERCIAL_CONTRACT.releasesPerPack} sealed versions. Further versions require a correction reason.</li>
        </ol>
      </section>

      <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted">
        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        Paddle acts as Merchant of Record. CBAMValid never trusts a client-supplied price or order identity.
      </div>
    </main>
  );
}
