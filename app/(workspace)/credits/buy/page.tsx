"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthProvider";
import { CREDIT_PACKAGES } from "@/lib/billing/catalog";
import { formatPreparationPackPrice, PREPARATION_PACK } from "@/lib/commerce/preparation-pack";
import { createCheckout } from "@/lib/functions/client";

function describeError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Checkout could not be started.";
}

export default function BuyCreditsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [paddle, setPaddle] = useState<Paddle | null>(null);
  const [paddleLoading, setPaddleLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(crypto.randomUUID());
  const requestInFlight = useRef(false);

  const pkg = CREDIT_PACKAGES.find((item) => item.slug === PREPARATION_PACK.slug && item.active);
  const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?.trim() || "";
  const environment = process.env.NEXT_PUBLIC_PADDLE_SANDBOX === "true" ? "sandbox" : "production";
  const paymentConfigured = Boolean(pkg?.configured && clientToken);

  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=/credits/buy");
  }, [loading, router, user]);

  useEffect(() => {
    let cancelled = false;
    if (!paymentConfigured) {
      setPaddleLoading(false);
      setError("Payment configuration is unavailable. No charge can be initiated.");
      return;
    }

    void initializePaddle({ environment, token: clientToken })
      .then((instance) => {
        if (cancelled) return;
        setPaddle(instance || null);
        setPaddleLoading(false);
        if (!instance) setError("Payment system initialization returned no checkout client.");
      })
      .catch((initializationError: unknown) => {
        if (cancelled) return;
        console.error("Paddle initialization failed", initializationError);
        setPaddle(null);
        setPaddleLoading(false);
        setError("Payment system could not be initialized. No charge was created.");
      });

    return () => {
      cancelled = true;
    };
  }, [clientToken, environment, paymentConfigured]);

  const handleCheckout = async () => {
    if (!user) {
      router.replace("/login?next=/credits/buy");
      return;
    }
    if (!paddle || !paymentConfigured || requestInFlight.current) {
      setError("Payment system is not ready. No charge was created.");
      return;
    }

    requestInFlight.current = true;
    setCheckoutLoading(true);
    setError("");
    try {
      const result = await createCheckout(requestId.current);
      paddle.Checkout.open({
        transactionId: result.transactionId,
        settings: {
          displayMode: "overlay",
          theme: "light",
          successUrl: `${window.location.origin}/account?purchase=processing`,
        },
      });
    } catch (checkoutError: unknown) {
      console.error("Checkout creation failed", checkoutError);
      setError(describeError(checkoutError));
      requestId.current = crypto.randomUUID();
    } finally {
      requestInFlight.current = false;
      setCheckoutLoading(false);
    }
  };

  if (!pkg) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 py-12 sm:px-6 lg:py-16">
        <p className="text-muted">No active Preparation Pack is available.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 py-12 text-center sm:px-6 lg:py-16">
      <div className="mb-10 max-w-2xl">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-accent">One controlled commercial product</p>
        <h1 className="font-serif text-3xl font-bold text-foreground md:text-4xl">{pkg.displayName}</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted md:text-base">
          Purchase one pack for one CBAM case. The pack funds five successful sealed versions; drafts, calculations and remediation remain free.
        </p>
      </div>

      {error && (
        <div role="alert" className="mb-8 w-full max-w-lg rounded-md border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <section className="flex w-full max-w-lg flex-col items-center rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <h2 className="text-2xl font-bold text-foreground">{PREPARATION_PACK.maxReleases} successful sealed versions</h2>
        <p className="mt-2 text-sm text-muted">{PREPARATION_PACK.accountCredits} account credits included</p>
        <div className="my-7 font-serif text-5xl font-bold text-foreground">{formatPreparationPackPrice()}</div>
        <p className="-mt-4 mb-7 text-xs font-semibold uppercase tracking-wider text-muted">USD · one-time purchase</p>

        <ul className="mb-8 w-full space-y-4 text-left">
          {[
            `${PREPARATION_PACK.creditsPerRelease} credits debited only after each successful seal`,
            "Unlimited draft revisions and automated calculations before sealing",
            "Professional PDF, controlled XLSX and signed 27-component ZIP dossier",
            "Five release versions scope-locked to one case",
            "Paddle Merchant of Record payment processing",
          ].map((feature) => (
            <li key={feature} className="flex items-start gap-3">
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
              <span className="text-sm text-foreground">{feature}</span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => void handleCheckout()}
          disabled={loading || paddleLoading || checkoutLoading || !paymentConfigured || !paddle}
          className="flex h-11 w-full items-center justify-center rounded-md bg-accent px-5 font-medium text-surface transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {paddleLoading || checkoutLoading ? <Loader2 className="h-5 w-5 animate-spin" aria-label="Preparing checkout" /> : `Purchase Pack — ${formatPreparationPackPrice()}`}
        </button>
      </section>

      <div className="mt-10 max-w-lg rounded-xl border border-border bg-neutral-soft/40 p-5 text-left text-xs leading-relaxed text-muted">
        <p className="font-bold text-foreground">Balance conservation rule</p>
        <p className="mt-2">
          Successful payment adds {PREPARATION_PACK.accountCredits} credits. Each successful sealed report version deducts exactly {PREPARATION_PACK.creditsPerRelease} credits in the same database transaction that activates the report. Failed sealing attempts do not consume credits.
        </p>
      </div>

      <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted">
        <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Payments are securely processed by Paddle, our Merchant of Record.
      </div>
    </main>
  );
}
