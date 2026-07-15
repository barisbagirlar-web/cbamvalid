"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import { createNewCaseDraft } from "@/lib/cbam/new-case";
import { saveCase } from "@/lib/functions/client";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "The new case could not be created. No existing dossier was changed.";
}

export default function NewCasePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const requestInFlight = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading || !user || requestInFlight.current) return;

    requestInFlight.current = true;
    setError("");

    const createAndOpenCase = async () => {
      try {
        const draft = createNewCaseDraft(user.uid);
        const newCaseId = await saveCase(draft);
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
        <section className="mx-auto max-w-xl rounded-2xl border border-red-300 bg-surface p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-700" aria-hidden="true" />
            <div>
              <h1 className="font-serif text-2xl font-bold">New case could not be opened</h1>
              <p className="mt-3 text-sm leading-relaxed text-muted">{error}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                The failure is kept on this page instead of silently returning to Dashboard. Retry once or return to Cases without creating another duplicate request.
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setAttempt((current) => current + 1)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-surface hover:bg-accent-hover"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Retry New Case
            </button>
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
    <main className="min-h-screen bg-background px-6 py-16 text-foreground">
      <section
        className="mx-auto flex max-w-xl flex-col items-center rounded-2xl border border-border bg-surface p-10 text-center shadow-sm"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-8 w-8 animate-spin text-accent" aria-hidden="true" />
        <h1 className="mt-5 font-serif text-2xl font-bold">Creating and opening your case</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          CBAMValid is creating one clean draft and loading the eight-step dossier workspace.
        </p>
      </section>
    </main>
  );
}
