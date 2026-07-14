"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { CREDIT_PACKAGES } from "@/lib/billing/catalog";
import { createCheckout, getCases, type CbamCaseRecord } from "@/lib/functions/client";
import { Check, Loader2, ShieldCheck, FileText } from "lucide-react";
import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import Link from "next/link";
import { useRouter } from "next/navigation";

const PRODUCT_CODE = "CBAM_CREDIT_PACK_5" as const;
const PADDLE_CLIENT_TOKEN = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || "";
const PADDLE_ENVIRONMENT = process.env.NEXT_PUBLIC_PADDLE_ENV === "production" ? "production" : "sandbox";
const PAYMENT_CONFIGURATION_ERROR = "Payment configuration is unavailable. Please contact support and quote PAYMENT_CONFIG_MISSING.";

export default function BuyPreparationPackPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [paddle, setPaddle] = useState<Paddle | null>(null);
  const [cases, setCases] = useState<CbamCaseRecord[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [loadingPkg, setLoadingPkg] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState(() => PADDLE_CLIENT_TOKEN ? "" : PAYMENT_CONFIGURATION_ERROR);

  const pkg = useMemo(
    () => CREDIT_PACKAGES.filter((item) => item.active).sort((a, b) => a.displayOrder - b.displayOrder)[0],
    []
  );

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login?next=/credits/buy");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;

    let active = true;
    getCases()
      .then((result) => {
        if (!active) return;
        const activeCases = result.filter((item) => item.status === "DRAFT");
        setCases(activeCases);
        if (activeCases.length === 1) setSelectedCaseId(activeCases[0].caseId);
      })
      .catch((loadError: unknown) => {
        console.error("Draft case loading failed", loadError);
        if (active) setError("Your draft cases could not be loaded. Please refresh and try again.");
      })
      .finally(() => {
        if (active) setDataLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!PADDLE_CLIENT_TOKEN) return;

    let active = true;
    initializePaddle({
      environment: PADDLE_ENVIRONMENT,
      token: PADDLE_CLIENT_TOKEN,
    })
      .then((instance) => {
        if (active && instance) setPaddle(instance);
      })
      .catch((initializationError: unknown) => {
        console.error("Paddle initialization failed", initializationError);
        if (active) setError("The secure checkout could not be initialized. Please refresh and try again.");
      });

    return () => {
      active = false;
    };
  }, []);

  const handleCheckout = async () => {
    if (!user) {
      router.replace("/login?next=/credits/buy");
      return;
    }
    if (!selectedCaseId) {
      setError("Select the draft dossier that this Preparation Pack will cover.");
      return;
    }
    if (!paddle) {
      setError(PADDLE_CLIENT_TOKEN ? "The secure checkout is still initializing. Please wait a moment and try again." : PAYMENT_CONFIGURATION_ERROR);
      return;
    }

    setLoadingPkg(true);
    setError("");

    try {
      const checkout = await createCheckout(PRODUCT_CODE, selectedCaseId);
      if (!checkout.transactionId) {
        throw new Error("CHECKOUT_TRANSACTION_MISSING");
      }

      paddle.Checkout.open({
        transactionId: checkout.transactionId,
        settings: {
          displayMode: "overlay",
          theme: "light",
          successUrl: `${window.location.origin}/cbam?purchase=success`,
        },
      });
    } catch (checkoutError: unknown) {
      console.error("Preparation Pack checkout failed", checkoutError);
      setError("Checkout could not be started. No payment has been taken. Please refresh and try again.");
    } finally {
      setLoadingPkg(false);
    }
  };

  if (!pkg) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 py-12 sm:px-6 lg:py-16">
        <p className="text-muted">The Preparation Pack is temporarily unavailable.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 py-12 sm:px-6 lg:py-16 text-center">
      <div className="mb-10 max-w-2xl">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-accent">
          Exporter Verification Preparation Pack
        </p>
        <h1 className="text-3xl md:text-4xl font-serif font-bold mb-4 text-foreground">
          Seal and download your verifier-preparation package
        </h1>
        <p className="text-muted text-sm md:text-base leading-relaxed">
          One pack covers one installation, one reporting year, the defined production processes and linked goods in the selected dossier. It includes five successful sealed report versions.
        </p>
      </div>

      {error && (
        <div className="w-full max-w-xl mb-8 p-4 bg-red-50 text-red-700 border border-red-200 rounded-md font-medium text-sm whitespace-pre-line text-center" role="alert">
          {error}
        </div>
      )}

      <div className="w-full max-w-xl bg-surface border border-border rounded-2xl p-8 shadow-sm flex flex-col items-center">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2 text-foreground">CBAMValid Preparation Pack</h2>
          <p className="text-muted text-sm">Five sealed report versions for one selected dossier</p>
        </div>

        <div className="mb-7">
          <span className="text-5xl font-bold font-serif text-foreground">$150</span>
          <span className="ml-2 text-sm font-semibold text-muted">USD</span>
        </div>

        <ul className="mb-8 space-y-4 w-full text-left">
          <li className="flex items-start gap-3">
            <Check className="w-5 h-5 text-accent shrink-0 mt-0.5" />
            <span className="text-sm text-foreground">Evidence-linked emissions calculations and quality controls</span>
          </li>
          <li className="flex items-start gap-3">
            <Check className="w-5 h-5 text-accent shrink-0 mt-0.5" />
            <span className="text-sm text-foreground">Five successful immutable sealed versions; failed attempts and re-downloads consume no version</span>
          </li>
          <li className="flex items-start gap-3">
            <Check className="w-5 h-5 text-accent shrink-0 mt-0.5" />
            <span className="text-sm text-foreground">Verifier-preparation ZIP, integrity manifest and O3CI field-mapped structured export</span>
          </li>
        </ul>

        {dataLoading ? (
          <div className="flex min-h-20 items-center justify-center text-sm text-muted">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading draft dossiers…
          </div>
        ) : cases.length === 0 ? (
          <div className="w-full rounded-xl border border-dashed border-border bg-background p-6">
            <FileText className="mx-auto mb-3 h-7 w-7 text-muted" />
            <p className="mb-4 text-sm text-muted">Create a draft dossier before purchasing. The pack is linked to that dossier for auditability.</p>
            <Link href="/cases/new" className="inline-flex h-11 items-center justify-center rounded-md bg-accent px-5 text-sm font-semibold text-surface hover:bg-accent-hover">
              Create Your First Dossier
            </Link>
          </div>
        ) : (
          <div className="w-full space-y-4">
            <label htmlFor="case-selection" className="block text-left text-sm font-bold text-foreground">
              Select the dossier covered by this pack
            </label>
            <select
              id="case-selection"
              value={selectedCaseId}
              onChange={(event) => setSelectedCaseId(event.target.value)}
              className="h-12 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <option value="">Choose a draft dossier</option>
              {cases.map((item) => {
                const installation = item.data.installation.name.value || "Unnamed installation";
                const year = item.data.reportingPeriod.year.value || "Year pending";
                return (
                  <option key={item.caseId} value={item.caseId}>
                    {String(installation)} — {String(year)}
                  </option>
                );
              })}
            </select>

            <button
              onClick={handleCheckout}
              disabled={loadingPkg || !selectedCaseId || !paddle}
              className="w-full h-12 flex items-center justify-center rounded-md font-semibold bg-accent text-surface hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingPkg ? <Loader2 className="w-5 h-5 animate-spin" /> : "Purchase Preparation Pack — $150"}
            </button>
          </div>
        )}
      </div>

      <div className="mt-10 max-w-xl rounded-xl border border-border bg-background p-5 text-left">
        <h3 className="mb-2 text-sm font-bold text-foreground">Commercial and verification boundary</h3>
        <p className="text-xs leading-relaxed text-muted">
          Draft preparation remains free. Payment is required only before sealing and downloading final deliverables. CBAMValid prepares the dossier for independent verification; it does not issue an accredited verifier&apos;s opinion, customs approval, EU approval or acceptance guarantee.
        </p>
      </div>

      <div className="mt-6 flex items-center justify-center gap-2 text-muted text-xs">
        <ShieldCheck className="w-4 h-4 text-muted" />
        Payments are processed by Paddle as Merchant of Record.
      </div>
    </main>
  );
}
