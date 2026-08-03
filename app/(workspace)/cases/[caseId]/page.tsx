"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { useAuth } from "@/context/AuthProvider";
import type { AuditReadyCase } from "@/lib/cbam/schema";
import { isCaseId } from "@/lib/cbam/case-id";
import {
  readFreshCaseWorkspaceCache,
  writeCaseWorkspaceCache,
} from "@/lib/cbam/workspace-cache";
import type { PreparationPackEntitlement } from "@/lib/functions/client";
import {
  loadWorkspaceCase,
  loadWorkspaceEntitlements,
  seedWorkspaceCase,
} from "@/lib/functions/workspace-loader";
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
  const [caseLoading, setCaseLoading] = useState(validCaseId);
  const [entitlementsLoading, setEntitlementsLoading] = useState(validCaseId);
  const [error, setError] = useState("");
  const [workspaceWarning, setWorkspaceWarning] = useState("");
  const [entitlementWarning, setEntitlementWarning] = useState("");
  const [attempt, setAttempt] = useState(0);
  const hasRenderableCase = useRef(false);

  const malformedCaseError = validCaseId
    ? ""
    : "The case link is malformed. Open the dossier again from Cases.";

  useEffect(() => {
    if (!user || !validCaseId) return;
    const cached = readFreshCaseWorkspaceCache(caseId);
    if (!cached) return;

    hasRenderableCase.current = true;
    seedWorkspaceCase(caseId, cached);
    setInitialCase(cached);
    setCaseLoading(false);
  }, [user, caseId, validCaseId]);

  // Failure isolation is equivalent to Promise.allSettled, but the two reads
  // intentionally settle independently so release-capacity latency never blocks
  // the editable working-file render path.
  useEffect(() => {
    if (loading || !user || !validCaseId) return;

    let cancelled = false;
    const startedAt = typeof performance !== "undefined" ? performance.now() : 0;

    void loadWorkspaceCase(caseId, { forceRefresh: true })
      .then((value) => {
        if (cancelled) return;
        hasRenderableCase.current = true;
        setInitialCase(value);
        setError("");
        setWorkspaceWarning("");
        setCaseLoading(false);
        try {
          writeCaseWorkspaceCache(caseId, value);
        } catch (cacheError) {
          console.warn("Failed to save case workspace cache", cacheError);
        }
        if (startedAt && typeof performance !== "undefined") {
          performance.measure(
            "cbam-case-authoritative-read",
            { start: startedAt, end: performance.now() }
          );
        }
      })
      .catch((caseError: unknown) => {
        if (cancelled) return;
        console.error("Case workspace load failed", caseError);
        setCaseLoading(false);
        if (hasRenderableCase.current) {
          setWorkspaceWarning(
            "The working file opened from the latest local snapshot. Server refresh is temporarily unavailable; saving remains server-validated."
          );
          return;
        }
        setInitialCase(null);
        setAvailableEntitlements([]);
        setError(describeError(caseError));
      });

    void loadWorkspaceEntitlements({ forceRefresh: true })
      .then((value) => {
        if (cancelled) return;
        setAvailableEntitlements(value);
        setEntitlementWarning("");
        setEntitlementsLoading(false);
      })
      .catch((entitlementError: unknown) => {
        if (cancelled) return;
        console.error("Entitlement status could not be loaded", entitlementError);
        setAvailableEntitlements([]);
        setEntitlementsLoading(false);
        setEntitlementWarning(
          "Preparation Pack status is temporarily unavailable. Draft editing remains available; sealing stays disabled until status can be verified."
        );
      });

    return () => {
      cancelled = true;
    };
  }, [attempt, caseId, loading, user, validCaseId]);

  const retryLoading = () => {
    setCaseLoading(!hasRenderableCase.current);
    setEntitlementsLoading(true);
    setError("");
    setWorkspaceWarning("");
    setEntitlementWarning("");
    setAttempt((current) => current + 1);
  };

  if (!loading && !user) return null;

  if (loading || caseLoading) {
    return (
      <main className="min-h-screen bg-background px-6 py-16 text-foreground">
        <section
          className="mx-auto flex max-w-xl flex-col items-center rounded-2xl border border-border bg-surface p-10 text-center shadow-sm"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-8 w-8 animate-spin text-accent" aria-hidden="true" />
          <h1 className="mt-5 font-serif text-2xl font-bold">Loading dossier workspace</h1>
          <p className="mt-2 text-sm text-muted">Retrieving the working file.</p>
        </section>
      </main>
    );
  }

  if (!user) return null;

  const effectiveError = malformedCaseError || error;

  if (effectiveError || !initialCase) {
    return (
      <main className="min-h-screen bg-background px-6 py-16 text-foreground">
        <section className="mx-auto max-w-xl rounded-2xl border border-status-blocked/40 bg-surface p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-status-blocked" aria-hidden="true" />
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
      {(workspaceWarning || entitlementWarning || entitlementsLoading) && (
        <div
          role="status"
          className="mx-auto mt-4 max-w-6xl rounded-lg border border-accent/20 bg-accent/5 px-4 py-2.5 text-sm text-accent"
        >
          {workspaceWarning || entitlementWarning || "Workspace ready. Verifying release capacity in the background…"}
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
