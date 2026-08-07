"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { useAuth } from "@/context/AuthProvider";

const TEB232_EMAIL = "teb232@gmail.com";
const TARGET_CASE_ID =
  "case_80aeb60175ce08a0d3acb7bc46617f152f0442f97ee652435280a2f2dff5e7cc";
const TARGET_PATH = `/cases/${TARGET_CASE_ID}`;

type PreparePayload = {
  status?: string;
  changed?: boolean;
  code?: string;
  message?: string;
  caseId?: string;
  fixtureKey?: string;
  operatorPreparation?: number;
  evidenceAssurance?: number;
};

async function readPayload(response: Response): Promise<PreparePayload> {
  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  if (!contentType.includes("application/json")) {
    await response.text().catch(() => "");
    throw new Error(`TEB232_TARGET_PREPARE_HTTP_${response.status}`);
  }
  try {
    return (await response.json()) as PreparePayload;
  } catch {
    throw new Error(`TEB232_TARGET_PREPARE_INVALID_JSON_${response.status}`);
  }
}

export function Teb232TargetCasePreparer() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [state, setState] = useState<"IDLE" | "RUNNING" | "DONE" | "FAILED">("IDLE");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  const isTarget =
    !loading &&
    user != null &&
    user.email?.trim().toLowerCase() === TEB232_EMAIL &&
    user.emailVerified === true &&
    pathname === TARGET_PATH;

  useEffect(() => {
    if (!isTarget || !user) return;
    let cancelled = false;

    async function prepare(): Promise<void> {
      setState("RUNNING");
      setError("");
      try {
        const token = await user.getIdToken(true);
        const response = await fetch("/api/qa/reconcile-teb232", {
          method: "POST",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ targetCaseId: TARGET_CASE_ID }),
        });
        const payload = await readPayload(response);
        if (!response.ok || payload.status !== "success") {
          throw new Error(
            payload.code || payload.message || `TEB232_TARGET_PREPARE_HTTP_${response.status}`
          );
        }
        if (
          payload.caseId !== TARGET_CASE_ID ||
          payload.fixtureKey !== "STEEL_IN" ||
          payload.operatorPreparation !== 100 ||
          payload.evidenceAssurance !== 100
        ) {
          throw new Error("TEB232_TARGET_PREPARE_ACCEPTANCE_INCOMPLETE");
        }
        if (cancelled) return;

        if (payload.changed === true) {
          setState("DONE");
          window.location.replace(`${TARGET_PATH}?step=8&controlledTestPrepared=1`);
          return;
        }
        setState("DONE");
      } catch (prepareError) {
        if (cancelled) return;
        const message =
          prepareError instanceof Error
            ? prepareError.message
            : "TEB232_TARGET_PREPARE_FAILED";
        console.error("[TEB232_TARGET_CASE_PREPARE]", prepareError);
        setError(message);
        setState("FAILED");
      }
    }

    void prepare();
    return () => {
      cancelled = true;
    };
  }, [attempt, isTarget, user]);

  if (!isTarget || state === "IDLE" || state === "DONE") return null;

  if (state === "RUNNING") {
    return (
      <aside
        className="notranslate fixed right-4 top-24 z-[1100] flex max-w-md items-start gap-3 rounded-xl border border-accent/30 bg-surface px-4 py-3 shadow-xl"
        translate="no"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-accent" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold">Preparing controlled test working file</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Completing the approved synthetic steel data, evidence files and readiness checks. No payment or locked release is being created.
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="notranslate fixed right-4 top-24 z-[1100] w-[calc(100%-2rem)] max-w-md rounded-xl border border-status-blocked/35 bg-surface p-4 shadow-xl"
      translate="no"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-status-blocked" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">Controlled test preparation did not complete</p>
          <p className="mt-1 break-words font-mono text-[11px] text-status-blocked">{error}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setAttempt((current) => current + 1)}
        className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-semibold hover:bg-neutral-soft"
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" /> Retry preparation
      </button>
    </aside>
  );
}
