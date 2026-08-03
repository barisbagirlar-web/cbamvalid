"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { useAuth } from "@/context/AuthProvider";
import {
  getCases,
  getEntitlements,
  type CbamCaseRecord,
  type PreparationPackEntitlement,
} from "@/lib/functions/client";

const TEB232_EMAIL = "teb232@gmail.com";
const MAX_BUSY_RETRIES = 5;
const EXPECTED_CASE_COUNT = 4;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function hasUsableTestEntitlement(
  entitlements: PreparationPackEntitlement[]
): boolean {
  return entitlements.some((entitlement) => {
    const entitlementId =
      typeof entitlement.entitlementId === "string"
        ? entitlement.entitlementId.trim()
        : "";
    const status = String(entitlement.status || "").toUpperCase();
    const releasesRemaining = Number(entitlement.releasesRemaining || 0);
    return (
      Boolean(entitlementId) &&
      ["AVAILABLE", "ACTIVE", "PURCHASED"].includes(status) &&
      Number.isFinite(releasesRemaining) &&
      releasesRemaining > 0
    );
  });
}

function validateVisibleCases(
  cases: CbamCaseRecord[],
  expectedCaseIds: string[]
): void {
  const expected = new Set(expectedCaseIds);
  const visible = new Set(cases.map((item) => item.caseId));
  if (
    expected.size !== EXPECTED_CASE_COUNT ||
    cases.length !== EXPECTED_CASE_COUNT ||
    visible.size !== EXPECTED_CASE_COUNT ||
    [...expected].some((caseId) => !visible.has(caseId))
  ) {
    throw new Error(
      `TEST_CASE_READBACK_MISMATCH:expected=${expected.size}:visible=${visible.size}`
    );
  }
}

export function Teb232CaseReconciler() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [state, setState] = useState<"IDLE" | "RUNNING" | "FAILED">("IDLE");
  const [error, setError] = useState("");

  const isTarget =
    !loading &&
    user != null &&
    user.email?.trim().toLowerCase() === TEB232_EMAIL &&
    user.emailVerified === true &&
    pathname.startsWith("/cases");

  useEffect(() => {
    if (!isTarget || !user) return;
    let cancelled = false;

    async function reconcile(): Promise<void> {
      setState("RUNNING");
      setError("");
      try {
        const token = await user.getIdToken(true);
        let response: Response | undefined;
        for (let attempt = 0; attempt < MAX_BUSY_RETRIES; attempt += 1) {
          response = await fetch("/api/qa/reconcile-teb232", {
            method: "POST",
            cache: "no-store",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: "{}",
          });
          if (response.status !== 409) break;
          await sleep(1500);
        }

        if (!response) throw new Error("TEST_CASE_RECONCILE_NO_RESPONSE");
        const payload = (await response.json()) as {
          status?: string;
          changed?: boolean;
          code?: string;
          message?: string;
          caseIds?: string[];
          operatorPreparation?: number;
          evidenceAssurance?: number;
        };
        if (!response.ok || payload.status !== "success") {
          throw new Error(
            payload.code || payload.message || "TEST_CASE_RECONCILE_FAILED"
          );
        }
        if (
          payload.operatorPreparation !== 100 ||
          payload.evidenceAssurance !== 100 ||
          !Array.isArray(payload.caseIds)
        ) {
          throw new Error("TEST_CASE_SERVER_ACCEPTANCE_INCOMPLETE");
        }

        const [visibleCases, entitlements] = await Promise.all([
          getCases(),
          getEntitlements(),
        ]);
        validateVisibleCases(visibleCases, payload.caseIds);
        if (!hasUsableTestEntitlement(entitlements)) {
          throw new Error("TEST_ADMIN_ENTITLEMENT_NOT_READY");
        }
        if (cancelled) return;

        window.localStorage.setItem(
          `cbam_cases_cache_${user.uid}`,
          JSON.stringify(visibleCases)
        );

        if (payload.changed || pathname !== "/cases") {
          window.location.replace("/cases?controlledTestCases=ready");
          return;
        }
        setState("IDLE");
      } catch (reconcileError) {
        if (cancelled) return;
        const message =
          reconcileError instanceof Error
            ? reconcileError.message
            : "TEST_CASE_RECONCILE_FAILED";
        console.error("[TEB232_CASE_RECONCILE]", reconcileError);
        setError(message);
        setState("FAILED");
      }
    }

    void reconcile();
    return () => {
      cancelled = true;
    };
  }, [isTarget, pathname, user]);

  if (!isTarget || state === "IDLE") return null;

  return (
    <div
      className="notranslate fixed inset-0 z-[1000] flex items-center justify-center bg-background/95 px-6"
      translate="no"
      role="status"
      aria-live="polite"
    >
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-8 text-center shadow-xl">
        {state === "RUNNING" ? (
          <>
            <Loader2
              className="mx-auto h-8 w-8 animate-spin text-accent"
              aria-hidden="true"
            />
            <h2 className="mt-5 font-serif text-2xl font-bold">
              Preparing controlled test cases
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              The server is replacing the five obsolete working files with four
              complete sector cases, checking every evidence object, and confirming
              the test release entitlement. The workspace opens only after the same
              authenticated session reads all four cases back successfully.
            </p>
          </>
        ) : (
          <>
            <h2 className="font-serif text-2xl font-bold">
              Test cases could not be prepared
            </h2>
            <p className="mt-3 break-words font-mono text-xs text-status-blocked">
              {error}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-surface"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Retry safely
            </button>
          </>
        )}
      </div>
    </div>
  );
}
