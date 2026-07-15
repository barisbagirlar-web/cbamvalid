"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { useAuth } from "@/context/AuthProvider";
import type { AuditReadyCase } from "@/lib/cbam/schema";
import { isCaseId } from "@/lib/cbam/case-id";
import { getCase } from "@/lib/functions/client";
import { getPreparationPacks } from "@/lib/functions/commerce-client";
import { getTypedAccountOverview } from "@/lib/functions/account-client";
import type { PreparationPackEntitlement } from "@/lib/functions/commerce-types";
import CaseWizardClient from "./CaseWizardClient";

function describeError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "The dossier workspace could not be loaded.";
}

export default function CasePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = use(params);
  const validCaseId = isCaseId(caseId);
  const { user, loading } = useAuth();
  const [initialCase, setInitialCase] = useState<AuditReadyCase | null>(null);
  const [availableEntitlements, setAvailableEntitlements] = useState<PreparationPackEntitlement[]>([]);
  const [availableCredits, setAvailableCredits] = useState(0);
  const [commerceHoldActive, setCommerceHoldActive] = useState(false);
  const [dataLoading, setDataLoading] = useState(validCaseId);
  const [error, setError] = useState("");
  const [commercialWarning, setCommercialWarning] = useState("");
  const [attempt, setAttempt] = useState(0);

  const malformedCaseError = validCaseId
    ? ""
    : "The case link is malformed. Open the dossier again from Cases.";

  useEffect(() => {
    if (loading || !user || !validCaseId) return;
    let cancelled = false;

    void Promise.allSettled([
      getCase(caseId),
      getPreparationPacks(),
      getTypedAccountOverview(),
    ])
      .then(([caseResult, entitlementResult, accountResult]) => {
        if (cancelled) return;
        if (caseResult.status === "rejected") {
          console.error("Case workspace load failed", caseResult.reason);
          setInitialCase(null);
          setAvailableEntitlements([]);
          setAvailableCredits(0);
          setCommerceHoldActive(false);
          setError(describeError(caseResult.reason));
          setDataLoading(false);
          return;
        }

        setInitialCase(caseResult.value);
        setError("");
        const warnings: string[] = [];

        if (entitlementResult.status === "fulfilled") {
          setAvailableEntitlements(entitlementResult.value);
        } else {
          console.error("Preparation Pack status could not be loaded", entitlementResult.reason);
          setAvailableEntitlements([]);
          warnings.push("Preparation Pack status is unavailable; sealing remains disabled.");
        }

        if (accountResult.status === "fulfilled") {
          setAvailableCredits(accountResult.value.credits.availableCredits);
          setCommerceHoldActive(accountResult.value.commerceHold.active);
          if (accountResult.value.commerceHold.active) {
            warnings.push("A commerce hold is active; pack unlock and sealing are blocked until administrative resolution.");
          }
        } else {
          console.error("Account credit status could not be loaded", accountResult.reason);
          setAvailableCredits(0);
          setCommerceHoldActive(false);
          warnings.push("Credit balance is unavailable; pack unlock remains disabled.");
        }

        setCommercialWarning(warnings.join(" "));
        setDataLoading(false);
      })
      .catch((unexpectedError: unknown) => {
        if (cancelled) return;
        console.error("Unexpected case workspace failure", unexpectedError);
        setInitialCase(null);
        setAvailableEntitlements([]);
        setAvailableCredits(0);
        setCommerceHoldActive(false);
        setError(describeError(unexpectedError));
        setDataLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [attempt, caseId, loading, user, validCaseId]);

  const retryLoading = () => {
    setDataLoading(true);
    setError("");
    setCommercialWarning("");
    setAttempt((current) => current + 1);
  };

  if (!loading && !user) return null;
  if (loading || dataLoading) {
    return (
      <main className="min-h-screen bg-background px-6 py-16 text-foreground">
        <section className="mx-auto flex max-w-xl flex-col items-center rounded-2xl border border-border bg-surface p-10 text-center shadow-sm" role="status" aria-live="polite">
          <Loader2 className="h-8 w-8 animate-spin text-accent" aria-hidden="true" />
          <h1 className="mt-5 font-serif text-2xl font-bold">Loading dossier workspace</h1>
          <p className="mt-2 text-sm text-muted">Retrieving the case, credit balance and case-scoped release capacity.</p>
        </section>
      </main>
    );
  }
  if (!user) return null;

  const effectiveError = malformedCaseError || error;
  if (effectiveError || !initialCase) {
    return (
      <main className="min-h-screen bg-background px-6 py-16 text-foreground">
        <section className="mx-auto max-w-xl rounded-2xl border border-red-300 bg-surface p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-700" aria-hidden="true" />
            <div>
              <h1 className="font-serif text-2xl font-bold">Dossier workspace could not be loaded</h1>
              <p className="mt-3 text-sm leading-relaxed text-muted">{effectiveError || "The case response was empty."}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted">Retrying this read does not create another draft.</p>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {validCaseId && <button type="button" onClick={retryLoading} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-surface hover:bg-accent-hover"><RefreshCw className="h-4 w-4" /> Retry Loading</button>}
            <Link href="/cases" className="inline-flex h-11 items-center justify-center rounded-md border border-border bg-surface px-5 text-sm font-semibold hover:bg-neutral-soft">Back to Cases</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <>
      {commercialWarning && <div role="status" className="mx-auto mt-6 max-w-6xl rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">{commercialWarning}</div>}
      <CaseWizardClient
        sessionUser={{ uid: user.uid, email: user.email || "" }}
        initialCase={initialCase}
        availableEntitlements={availableEntitlements}
        initialAvailableCredits={availableCredits}
        initialCommerceHoldActive={commerceHoldActive}
      />
    </>
  );
}
