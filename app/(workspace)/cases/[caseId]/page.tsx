"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { useAuth } from "@/context/AuthProvider";
import type { AuditReadyCase } from "@/lib/cbam/schema";
import { isCaseId } from "@/lib/cbam/case-id";
import {
  getCase,
  getEntitlements,
  type PreparationPackEntitlement,
} from "@/lib/functions/client";
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
  const [dataLoading, setDataLoading] = useState(validCaseId);
  const [error, setError] = useState("");
  const [entitlementWarning, setEntitlementWarning] = useState("");
  const [attempt, setAttempt] = useState(0);

  const malformedCaseError = validCaseId
    ? ""
    : "The case link is malformed. Open the dossier again from Cases.";

  useEffect(() => {
    if (loading || !user || !validCaseId) return;

    let cancelled = false;

    void Promise.allSettled([getCase(caseId), getEntitlements()])
      .then(([caseResult, entitlementResult]) => {
        if (cancelled) return;

        if (caseResult.status === "rejected") {
          console.error("Case workspace load failed", caseResult.reason);
          setInitialCase(null);
          setAvailableEntitlements([]);
          setError(describeError(caseResult.reason));
          setDataLoading(false);
          return;
        }

        setInitialCase(caseResult.value);
        setError("");

        if (entitlementResult.status === "fulfilled") {
          setAvailableEntitlements(entitlementResult.value);
          setEntitlementWarning("");
        } else {
          console.error("Entitlement status could not be loaded", entitlementResult.reason);
          setAvailableEntitlements([]);
          setEntitlementWarning(
            "Preparation Pack status is temporarily unavailable. Draft editing remains available; sealing stays disabled until status can be verified."
          );
        }

        setDataLoading(false);
      })
      .catch((unexpectedError: unknown) => {
        if (cancelled) return;
        console.error("Unexpected case workspace failure", unexpectedError);
        setInitialCase(null);
        setAvailableEntitlements([]);
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
    setEntitlementWarning("");
    setAttempt((current) => current + 1);
  };

  if (!loading && !user) return null;

  if (loading || dataLoading) {
    return (
      <main className="min-h-screen bg-background px-6 py-16 text-foreground">
        <section
          className="mx-auto flex max-w-xl flex-col items-center rounded-2xl border border-border bg-surface p-10 text-center shadow-sm"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-8 w-8 animate-spin text-accent" aria-hidden="true" />
          <h1 className="mt-5 font-serif text-2xl font-bold">Loading dossier workspace</h1>
          <p className="mt-2 text-sm text-muted">Retrieving the case record and verified release capacity.</p>
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
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {effectiveError || "The case response was empty."}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                You remain on the case route so the failure is visible. No additional draft is created by retrying this read operation.
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {validCaseId && (
              <button
                type="button"
                onClick={retryLoading}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-surface hover:bg-accent-hover"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> Retry Loading
              </button>
            )}
            <Link
              href="/cases"
              className="inline-flex h-11 items-center justify-center rounded-md border border-border bg-surface px-5 text-sm font-semibold hover:bg-neutral-soft"
            >
              Back to Cases
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <>
      {entitlementWarning && (
        <div
          role="status"
          className="mx-auto mt-6 max-w-6xl rounded-lg border border-accent/20 bg-accent/5 px-4 py-3 text-sm text-accent"
        >
          {entitlementWarning}
        </div>
      )}
      <CaseWizardClient
        sessionUser={{ uid: user.uid, email: user.email || "" }}
        initialCase={initialCase}
        availableEntitlements={availableEntitlements}
      />
    </>
  );
}
