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
const EXPECTED_CASE_IDS = Object.freeze([
  "case_d8567b26ef12e5a748fc49c7753cfe53eb54c00a8e92b8d98912b5d25d8ab9c5",
  "case_a70c36b5348782cc69c7a2c9863bec28f8bb2ad8ac1bff1c6afe7a62966d4c62",
  "case_b71ffdbd980f658cd5a738437c27cce4d82546698df12fc2bf7a0bd31e9c286d",
  "case_39474ac5ffe36f8df1853df51b3038085edf457cd0561fa1e501ca8231b8b892",
]);

type ReconcilePayload = {
  status?: string;
  changed?: boolean;
  code?: string;
  message?: string;
  caseIds?: string[];
  operatorPreparation?: number;
  evidenceAssurance?: number;
};

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
  expectedCaseIds: readonly string[]
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

function currentCaseId(pathname: string): string | null {
  const match = pathname.match(/^\/cases\/([^/]+)$/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

async function readReconcilePayload(response: Response): Promise<ReconcilePayload> {
  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  if (!contentType.includes("application/json")) {
    await response.text().catch(() => "");
    throw new Error(`TEST_CASE_RECONCILE_HTTP_${response.status}`);
  }

  try {
    return (await response.json()) as ReconcilePayload;
  } catch {
    throw new Error(`TEST_CASE_RECONCILE_INVALID_JSON_${response.status}`);
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
    const authenticatedUser = user;
    let cancelled = false;

    async function acceptVisibleCases(
      visibleCases: CbamCaseRecord[],
      entitlements: PreparationPackEntitlement[],
      expectedCaseIds: readonly string[],
      changed: boolean
    ): Promise<boolean> {
      validateVisibleCases(visibleCases, expectedCaseIds);
      if (!hasUsableTestEntitlement(entitlements)) {
        throw new Error("TEST_ADMIN_ENTITLEMENT_NOT_READY");
      }
      if (cancelled) return true;

      window.localStorage.setItem(
        `cbam_cases_cache_${authenticatedUser.uid}`,
        JSON.stringify(visibleCases)
      );

      const openCaseId = currentCaseId(pathname);
      const staleCaseRoute =
        openCaseId !== null && !expectedCaseIds.includes(openCaseId);
      if (changed || staleCaseRoute) {
        window.location.replace("/cases?controlledTestCases=ready");
        return true;
      }

      setState("IDLE");
      return true;
    }

    async function reconcile(): Promise<void> {
      setState("RUNNING");
      setError("");
      try {
        // The four canonical cases are already persisted for this controlled
        // account in normal operation. Read them first so a stale or missing
        // one-time reconciliation route cannot block every user navigation.
        try {
          const [visibleCases, entitlements] = await Promise.all([
            getCases(),
            getEntitlements(),
          ]);
          await acceptVisibleCases(
            visibleCases,
            entitlements,
            EXPECTED_CASE_IDS,
            false
          );
          return;
        } catch {
          // Fall through to the authenticated repair endpoint only when the
          // exact four-case readback or release entitlement is not ready.
        }

        const token = await authenticatedUser.getIdToken(true);
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
        const payload = await readReconcilePayload(response);
        if (!response.ok || payload.status !== "success") {
          throw new Error(
            payload.code || payload.message || `TEST_CASE_RECONCILE_HTTP_${response.status}`
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
        await acceptVisibleCases(
          visibleCases,
          entitlements,
          payload.caseIds,
          payload.changed === true
        );
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
              The workspace is validating the four complete sector cases and the
              available preparation-pack entitlement. An authenticated repair runs
              only when the exact persisted state is incomplete.
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
