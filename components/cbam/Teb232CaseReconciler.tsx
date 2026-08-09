"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { useAuth } from "@/context/AuthProvider";
import {
  getCases,
  getEntitlements,
  type CbamCaseRecord,
  type PreparationPackEntitlement,
} from "@/lib/functions/client";

const TEB232_EMAIL = "teb232@gmail.com";
const MAX_BUSY_RETRIES = 5;
const EXPECTED_CANONICAL_CASE_COUNT = 4;
const EXPECTED_CASE_IDS = Object.freeze([
  "case_d8567b26ef12e5a748fc49c7753cfe53eb54c00a8e92b8d98912b5d25d8ab9c5",
  "case_a70c36b5348782cc69c7a2c9863bec28f8bb2ad8ac1bff1c6afe7a62966d4c62",
  "case_b71ffdbd980f658cd5a738437c27cce4d82546698df12fc2bf7a0bd31e9c286d",
  "case_39474ac5ffe36f8df1853df51b3038085edf457cd0561fa1e501ca8231b8b892",
]);
const EXPECTED_CASE_ID_SET = new Set(EXPECTED_CASE_IDS);

type ReconcilePayload = {
  status?: string;
  changed?: boolean;
  code?: string;
  message?: string;
  caseIds?: string[];
  preparedDraftCaseIds?: string[];
  alreadyReadyDraftCaseIds?: string[];
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
  const missingCaseIds = [...expected].filter((caseId) => !visible.has(caseId));

  if (
    expected.size !== EXPECTED_CANONICAL_CASE_COUNT ||
    missingCaseIds.length > 0
  ) {
    throw new Error(
      `TEST_CASE_READBACK_MISMATCH:expected=${expected.size}:visibleCanonical=${
        expected.size - missingCaseIds.length
      }:visibleTotal=${visible.size}`
    );
  }
}

function hasUserCreatedWorkingFiles(cases: CbamCaseRecord[]): boolean {
  return cases.some((item) => !EXPECTED_CASE_ID_SET.has(item.caseId));
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
  const [attempt, setAttempt] = useState(0);

  const isTarget =
    !loading &&
    user != null &&
    user.email?.trim().toLowerCase() === TEB232_EMAIL &&
    user.emailVerified === true &&
    pathname === "/cases";

  useEffect(() => {
    if (!isTarget || !user) return;
    const authenticatedUser = user;
    let cancelled = false;

    async function callRepairEndpoint(
      body: Record<string, unknown>
    ): Promise<ReconcilePayload> {
      const token = await authenticatedUser.getIdToken(true);
      let response: Response | undefined;
      for (let retry = 0; retry < MAX_BUSY_RETRIES; retry += 1) {
        response = await fetch("/api/qa/reconcile-teb232", {
          method: "POST",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
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
        payload.evidenceAssurance !== 100
      ) {
        throw new Error("TEST_CASE_SERVER_ACCEPTANCE_INCOMPLETE");
      }
      return payload;
    }

    async function bulkPrepareIfNeeded(
      visibleCases: CbamCaseRecord[]
    ): Promise<boolean> {
      if (!hasUserCreatedWorkingFiles(visibleCases)) return false;
      const payload = await callRepairEndpoint({ prepareAllDrafts: true });
      if (
        payload.preparedDraftCaseIds !== undefined &&
        !Array.isArray(payload.preparedDraftCaseIds)
      ) {
        throw new Error("TEST_DRAFT_PREPARATION_RESPONSE_INVALID");
      }
      return payload.changed === true;
    }

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

      if (changed) {
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
        // The canonical cases may coexist with any number of Teb232 test drafts.
        // If the canonical set is already healthy, independently upgrade every
        // additional DRAFT to a complete controlled scenario before accepting.
        try {
          const [visibleCases, entitlements] = await Promise.all([
            getCases(),
            getEntitlements(),
          ]);
          validateVisibleCases(visibleCases, EXPECTED_CASE_IDS);
          if (!hasUsableTestEntitlement(entitlements)) {
            throw new Error("TEST_ADMIN_ENTITLEMENT_NOT_READY");
          }
          const draftsChanged = await bulkPrepareIfNeeded(visibleCases);
          if (draftsChanged && !cancelled) {
            window.location.replace("/cases?controlledTestDrafts=ready");
            return;
          }
          await acceptVisibleCases(
            visibleCases,
            entitlements,
            EXPECTED_CASE_IDS,
            false
          );
          return;
        } catch {
          // Fall through to the authenticated canonical repair endpoint when the
          // four-case subset, release entitlement or bulk draft preparation is
          // not ready. The server preserves extra drafts during canonical repair.
        }

        const payload = await callRepairEndpoint({});
        if (!Array.isArray(payload.caseIds)) {
          throw new Error("TEST_CASE_SERVER_ACCEPTANCE_INCOMPLETE");
        }

        const [visibleCases, entitlements] = await Promise.all([
          getCases(),
          getEntitlements(),
        ]);
        const draftsChanged = await bulkPrepareIfNeeded(visibleCases);
        await acceptVisibleCases(
          visibleCases,
          entitlements,
          payload.caseIds,
          payload.changed === true || draftsChanged
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
  }, [attempt, isTarget, user]);

  if (!isTarget || state !== "FAILED") return null;

  return (
    <aside
      className="notranslate fixed right-4 top-24 z-[1000] w-[calc(100%-2rem)] max-w-md rounded-2xl border border-status-blocked/35 bg-surface p-5 shadow-xl"
      translate="no"
      role="alert"
      aria-live="polite"
    >
      <h2 className="font-serif text-lg font-bold">
        Controlled test refresh is unavailable
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Existing working files, new working files and case detail pages remain
        available. The controlled test refresh can be retried separately.
      </p>
      <p className="mt-3 break-words font-mono text-xs text-status-blocked">
        {error}
      </p>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => setAttempt((current) => current + 1)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-semibold hover:bg-neutral-soft"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Retry refresh
        </button>
        <Link
          href="/cases/new"
          className="inline-flex h-10 items-center justify-center rounded-md bg-accent px-4 text-sm font-semibold text-surface hover:bg-accent-hover"
        >
          Start new working file
        </Link>
      </div>
    </aside>
  );
}
