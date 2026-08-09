"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import { createNewCaseDraft } from "@/lib/cbam/new-case";
import { saveCase } from "@/lib/functions/client";

const TEB232_EMAIL = "teb232@gmail.com";

type Teb232PreparationResponse = {
  status?: string;
  caseId?: string;
  operatorPreparation?: number;
  evidenceAssurance?: number;
  code?: string;
  message?: string;
};

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "The new working file could not be prepared safely. No existing dossier was overwritten.";
}

async function prepareTeb232CaseBeforeOpen(params: {
  user: NonNullable<ReturnType<typeof useAuth>["user"]>;
  caseId: string;
}): Promise<void> {
  const email = params.user.email?.trim().toLowerCase() || "";
  if (email !== TEB232_EMAIL || params.user.emailVerified !== true) return;

  const token = await params.user.getIdToken(true);
  const response = await fetch("/api/qa/reconcile-teb232", {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ targetCaseId: params.caseId }),
  });

  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  if (!contentType.includes("application/json")) {
    await response.text().catch(() => "");
    throw new Error(`TEB232_NEW_CASE_PREPARE_HTTP_${response.status}`);
  }

  const payload = (await response.json()) as Teb232PreparationResponse;
  if (
    !response.ok ||
    payload.status !== "success" ||
    payload.caseId !== params.caseId ||
    payload.operatorPreparation !== 100 ||
    payload.evidenceAssurance !== 100
  ) {
    throw new Error(
      payload.code ||
        payload.message ||
        "TEB232_NEW_CASE_PREPARATION_INCOMPLETE"
    );
  }
}

export default function NewCasePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const requestInFlight = useRef(false);
  const creationRequestId = useRef<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading || !user || requestInFlight.current) return;

    if (!creationRequestId.current) {
      creationRequestId.current = crypto.randomUUID();
    }

    requestInFlight.current = true;
    setError("");

    const createAndOpenCase = async () => {
      try {
        const draft = createNewCaseDraft(user.uid);
        const newCaseId = await saveCase(
          draft,
          undefined,
          creationRequestId.current ?? undefined
        );

        // The verified Teb232 account is a controlled QA identity. Its test
        // working files must never be opened as the intentionally incomplete
        // illustrative draft used for normal customers. Prepare and verify the
        // complete synthetic scenario before the first workspace render.
        await prepareTeb232CaseBeforeOpen({ user, caseId: newCaseId });

        router.replace(`/cases/${newCaseId}`);
      } catch (creationError) {
        console.error("Failed to create and open a new case", creationError);
        requestInFlight.current = false;
        setError(errorMessage(creationError));
      }
    };

    void createAndOpenCase();
  }, [attempt, loading, router, user]);

  if (!loading && !user) return null;

  if (error) {
    return (
      <main className="min-h-screen bg-background px-6 py-16 text-foreground">
        <section className="mx-auto max-w-xl rounded-2xl border border-status-blocked/40 bg-surface p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-status-blocked" aria-hidden="true" />
            <div>
              <h1 className="font-serif text-2xl font-bold">New working file could not be opened</h1>
              <p className="mt-3 text-sm leading-relaxed text-muted">{error}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Retry uses the same protected creation request. For the controlled Teb232 test identity, the workspace is not opened until the complete synthetic scenario and evidence set pass server-side sealing-readiness checks.
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setAttempt((current) => current + 1)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-surface hover:bg-accent-hover"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Retry new working file
            </button>
            <Link
              href="/cases"
              className="inline-flex h-11 items-center justify-center rounded-md border border-border bg-surface px-5 text-sm font-semibold hover:bg-neutral-soft"
            >
              Back to working files
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-6 py-16 text-foreground">
      <section
        className="mx-auto flex max-w-xl flex-col items-center rounded-2xl border border-border bg-surface p-10 text-center shadow-sm"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-8 w-8 animate-spin text-accent" aria-hidden="true" />
        <h1 className="mt-5 font-serif text-2xl font-bold">Creating your working file</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          CBAMValid is creating one idempotent working file and validating its opening state before the workspace is shown.
        </p>
      </section>
    </main>
  );
}
