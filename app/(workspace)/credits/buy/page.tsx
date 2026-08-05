"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthProvider";
import { CREDIT_PACKAGES } from "@/lib/billing/catalog";
import { CANONICAL_PRICING } from "@/lib/billing/pricing-config";
import { CASE_COMMERCIAL } from "@/lib/billing/case-commercial-contract";
import { isTestAdminEmail } from "@/lib/commerce/test-admin-emails";
import { initializePaddle, Paddle } from "@paddle/paddle-js";

type CheckoutApiData = {
  mode: "transaction" | "items";
  orderId: string;
  correlationId: string;
  priceId: string;
  transactionId?: string;
};

type FulfillmentPhase =
  | "idle"
  | "confirming"
  | "confirmed"
  | "pending"
  | "failed";

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
  const [fulfillmentPhase, setFulfillmentPhase] = useState<FulfillmentPhase>("idle");
  const [confirmedOrderId, setConfirmedOrderId] = useState("");
  const [caseId, setCaseId] = useState("");

  useEffect(() => {
    const nextCaseId = String(
      new URLSearchParams(window.location.search).get("caseId") || ""
    ).trim();
    const timer = window.setTimeout(() => setCaseId(nextCaseId), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const packages = CREDIT_PACKAGES.filter((p) => p.active).sort((a, b) => a.displayOrder - b.displayOrder);
  const pkg = packages[0];

  useEffect(() => {
    if (!loading && !user) {
      const next = caseId ? `/credits/buy?caseId=${encodeURIComponent(caseId)}` : "/credits/buy";
      router.push(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [user, loading, router, caseId]);

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
            role === "super_admin" ||
            role === "Owner" ||
            role === "pilot"
        );
      }).catch(console.error);
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/pricing")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
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
        if (cancelled) return;
        setPublicPaidLaunchEnabled(false);
        setDisplayPriceFormatted(CANONICAL_PRICING.priceFormatted);
      })
      .finally(() => {
        if (!cancelled) setFetchingConfig(false);
      });
    return () => {
      cancelled = true;
    };
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
      const code = confirmData?.error?.code || "";
      const message =
        confirmData?.error?.message ||
        confirmData?.message ||
        "Payment was received but your access could not be confirmed yet. Contact info@cbamvalid.com.";
      const err = new Error(message) as Error & { code?: string };
      err.code = code;
      throw err;
    }
    return confirmData;
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
        setFulfillmentPhase("confirming");
        setLoadingPkg("confirming");
        setError("");
        setConfirmedOrderId(orderId);
        const idToken = await user.getIdToken();
        await confirmFulfillment(idToken, orderId, transactionId);
        sessionStorage.removeItem("cbam_pending_order_id");
        if (!cancelled) {
          setFulfillmentPhase("confirmed");
          const paidCaseId =
            caseId || sessionStorage.getItem("cbam_pending_case_id") || "";
          sessionStorage.removeItem("cbam_pending_case_id");
          window.setTimeout(() => {
            if (!cancelled) {
              router.replace(
                paidCaseId
                  ? `/cases/${encodeURIComponent(paidCaseId)}?purchase=success`
                  : "/cases?purchase=success"
              );
            }
          }, 1600);
        }
      } catch (confirmErr: unknown) {
        if (!cancelled) {
          const code =
            confirmErr && typeof confirmErr === "object" && "code" in confirmErr
              ? String((confirmErr as { code?: string }).code || "")
              : "";
          const message = confirmErr instanceof Error ? confirmErr.message : "Confirmation failed.";
          if (code === "PAYMENT_PENDING" || /not completed yet/i.test(message)) {
            setFulfillmentPhase("pending");
            setError(
              "Payment is still processing. Do not pay again. Wait 1–2 minutes, then refresh this page or open Account → Purchase history."
            );
          } else {
            setFulfillmentPhase("failed");
            setError(
              `${message}\n\nDo not start another checkout if your card was charged. Email info@cbamvalid.com with order ${orderId}.`
            );
          }
        }
      } finally {
        if (!cancelled) setLoadingPkg(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, loading, router, caseId]);

  const handleCheckout = async (slug: string) => {
    if (!user) {
      const next = caseId ? `/credits/buy?caseId=${encodeURIComponent(caseId)}` : "/credits/buy";
      router.push(`/login?next=${encodeURIComponent(next)}`);
      return;
    }

    if (!caseId) {
      setError("Open a working file first. Payment unlocks locking for that specific file.");
      return;
    }

    if (!paddle) {
      setError("Payment system is initializing. Please wait.");
      return;
    }

    setLoadingPkg(slug);
    setError("");
    setFulfillmentPhase("idle");

    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/checkout/cbam", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ slug, caseId }),
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
      sessionStorage.setItem("cbam_pending_case_id", caseId);

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
            setFulfillmentPhase("confirming");
            setConfirmedOrderId(checkout.orderId);
            await confirmFulfillment(idToken, checkout.orderId, transactionId);
            sessionStorage.removeItem("cbam_pending_order_id");
            sessionStorage.removeItem("cbam_pending_case_id");
            setFulfillmentPhase("confirmed");
            router.push(`/cases/${encodeURIComponent(caseId)}?purchase=success`);
          } catch (confirmErr: unknown) {
            const code =
              confirmErr && typeof confirmErr === "object" && "code" in confirmErr
                ? String((confirmErr as { code?: string }).code || "")
                : "";
            const message = confirmErr instanceof Error ? confirmErr.message : "Confirmation failed.";
            if (code === "PAYMENT_PENDING" || /not completed yet/i.test(message)) {
              setFulfillmentPhase("pending");
              setError(
                "Payment is still processing. Do not pay again. Return to your working file in a minute."
              );
            } else {
              setFulfillmentPhase("failed");
              setError(
                `${message}\n\nDo not pay again if your card was charged. Email info@cbamvalid.com with order ${checkout.orderId}.`
              );
            }
          }
        },
      });

      const openSettings = {
        displayMode: "overlay" as const,
        theme: "light" as const,
        successUrl: `${window.location.origin}/credits/buy?purchase=success&orderId=${encodeURIComponent(checkout.orderId)}&caseId=${encodeURIComponent(caseId)}`,
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
            caseId,
          },
          settings: openSettings,
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Checkout could not be started.";
      setError(message);
      setFulfillmentPhase("failed");
    } finally {
      setLoadingPkg(null);
    }
  };

  if (!pkg) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 py-12 sm:px-6 lg:py-16">
        <p className="text-muted">No active Preparation Pack offers available.</p>
      </main>
    );
  }

  const isTestAdminUser = Boolean(
    user &&
      user.emailVerified === true &&
      isTestAdminEmail(user.email)
  );
  const isCheckoutBlocked = !publicPaidLaunchEnabled && !isAdmin && !isTestAdminUser;
  const returnHref = caseId ? `/cases/${encodeURIComponent(caseId)}?purchase=success` : "/cases?purchase=success";

  if (fulfillmentPhase === "confirmed") {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
          <Check className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="font-serif text-3xl font-bold text-foreground">Payment confirmed</h1>
        <p className="mt-3 text-sm text-muted leading-relaxed">
          This working file is paid. You can lock it now and correct/re-lock the same file as needed
          at no extra charge.
        </p>
        {confirmedOrderId ? (
          <p className="mt-4 font-mono text-xs text-muted">Order {confirmedOrderId}</p>
        ) : null}
        <Link
          href={returnHref}
          className="mt-8 inline-flex h-11 items-center justify-center rounded-md bg-accent px-6 text-sm font-semibold text-surface hover:bg-accent-hover"
        >
          Return to working file
        </Link>
      </main>
    );
  }

  if (fulfillmentPhase === "confirming") {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-16 text-center">
        <Loader2 className="mb-4 h-10 w-10 animate-spin text-accent" aria-hidden="true" />
        <h1 className="font-serif text-3xl font-bold text-foreground">Confirming payment…</h1>
        <p className="mt-3 text-sm text-muted leading-relaxed">
          Do not close this page and do not pay again. We are verifying your charge and unlocking
          lock for this working file.
        </p>
        {confirmedOrderId ? (
          <p className="mt-4 font-mono text-xs text-muted">Order {confirmedOrderId}</p>
        ) : null}
      </main>
    );
  }

  if (!caseId) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-16 text-center">
        <h1 className="font-serif text-3xl font-bold text-foreground mb-3">Pay when you lock a file</h1>
        <p className="text-sm text-muted leading-relaxed mb-8">{CASE_COMMERCIAL.customerOneLiner}</p>
        <Link
          href="/cases"
          className="inline-flex h-11 items-center justify-center rounded-md bg-accent px-6 text-sm font-semibold text-surface hover:bg-accent-hover"
        >
          Go to your working files
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 py-12 sm:px-6 lg:py-16 text-center">
      <div className="mb-10 max-w-xl">
        <h1 className="text-3xl md:text-4xl font-serif font-bold mb-4 text-foreground">
          Pay to lock this working file
        </h1>
        <p className="text-muted text-sm md:text-base leading-relaxed">
          {CASE_COMMERCIAL.customerOneLiner}
        </p>
        <p className="mt-3 font-mono text-xs text-muted break-all">File: {caseId}</p>
      </div>

      {fulfillmentPhase === "pending" || fulfillmentPhase === "failed" || error ? (
        <div className="w-full max-w-md mb-8 p-4 bg-[color:var(--status-blocked-soft)] text-status-blocked border border-status-blocked/30 rounded-md font-medium text-sm whitespace-pre-line text-left">
          {error}
          <p className="mt-3 text-xs">
            <Link href="/account" className="underline font-semibold">
              Open Account → Purchase history
            </Link>{" "}
            to see Paid / Pending / Failed.
          </p>
        </div>
      ) : null}

      <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-8 shadow-sm flex flex-col items-center">
        <div className="mb-6">
          <h3 className="text-2xl font-bold mb-2 text-foreground">{pkg.packName}</h3>
          <p className="text-muted text-sm">Unlocks lock &amp; download for this working file</p>
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
            <span className="text-sm text-foreground">Same file: unlimited correction re-locks</span>
          </li>
          <li className="flex items-center justify-center gap-2">
            <Check className="w-5 h-5 text-accent shrink-0" />
            <span className="text-sm text-foreground">New file requires a new payment</span>
          </li>
          <li className="flex items-center justify-center gap-2">
            <Check className="w-5 h-5 text-accent shrink-0" />
            <span className="text-sm text-foreground">Failed locks charge nothing</span>
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
            {loadingPkg === pkg.slug ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              CASE_COMMERCIAL.paymentCtaLabel
            )}
          </button>
        )}
      </div>

      <div className="mt-12 max-w-md space-y-3">
        <h4 className="font-bold text-foreground text-sm">How to know payment worked</h4>
        <p className="text-muted text-xs leading-relaxed">
          After checkout you will see “Confirming payment…”, then “Payment confirmed”.
          Return to the working file and choose Lock &amp; download. Account → Purchase history
          must show <strong className="text-foreground">Paid — pack active</strong>.
        </p>
      </div>

      <div className="mt-8 flex items-center justify-center gap-2 text-muted text-xs">
        <ShieldCheck className="w-4 h-4 text-muted" />
        Payments are securely processed by Paddle, our Merchant of Record.
      </div>
    </main>
  );
}
