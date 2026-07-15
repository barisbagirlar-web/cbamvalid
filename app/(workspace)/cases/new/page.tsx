"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import { saveCase } from "@/lib/functions/client";
import { createEmptyInput, type AuditReadyCase } from "@/lib/cbam/schema";

function createInitialDraft(ownerId: string): AuditReadyCase {
  return {
    status: "DRAFT",
    version: 1,
    ownerId,
    importerIdentity: {
      legalName: createEmptyInput(),
      eoriNumber: createEmptyInput(),
    },
    exporterIdentity: {
      legalName: createEmptyInput(),
    },
    reportingPeriod: {
      year: createEmptyInput(),
      quarter: createEmptyInput(),
    },
    goods: [],
    installation: {
      name: createEmptyInput(),
      country: createEmptyInput(),
      productionRoute: createEmptyInput(),
      systemBoundaries: "",
    },
    directEmissions: createEmptyInput("tCO2e"),
    electricityConsumed: createEmptyInput("MWh"),
    gridEmissionFactor: createEmptyInput("tCO2e/MWh"),
    precursors: [],
    carbonPriceRecords: [],
    evidenceRegister: [],
    calculationTrace: [],
    gapAssessment: [],
    methodologyDecisions: [],
    auditEvents: [{
      eventId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      actor: ownerId,
      action: "CASE_CREATED",
    }],
  };
}

function describeCreationError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "The new draft could not be created. Your existing cases were not changed.";
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

    const initializeNewCase = async () => {
      try {
        const newCaseId = await saveCase(createInitialDraft(user.uid));
        router.replace(`/cases/${newCaseId}`);
      } catch (creationError) {
        console.error("Failed to initialize new case", creationError);
        setError(describeCreationError(creationError));
        requestInFlight.current = false;
      }
    };

    void initializeNewCase();
  }, [attempt, loading, router, user]);

  if (!loading && !user) return null;

  if (error) {
    return (
      <main className="min-h-screen bg-background px-6 py-16 text-foreground">
        <section className="mx-auto max-w-xl rounded-2xl border border-red-300 bg-surface p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-700" aria-hidden="true" />
            <div>
              <h1 className="font-serif text-2xl font-bold">New case could not be created</h1>
              <p className="mt-3 text-sm leading-relaxed text-muted">{error}</p>
              <p className="mt-2 text-xs text-muted">
                The application will not silently return you to the dashboard. Retry the creation request or return to your complete case list.
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setAttempt((current) => current + 1)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-surface hover:bg-accent-hover"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Retry Draft Creation
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
      <section className="mx-auto flex max-w-xl flex-col items-center rounded-2xl border border-border bg-surface p-10 text-center shadow-sm" role="status" aria-live="polite">
        <Loader2 className="h-8 w-8 animate-spin text-accent" aria-hidden="true" />
        <h1 className="mt-5 font-serif text-2xl font-bold">Creating your new CBAM case</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          A clean draft is being created. You will be taken directly to the eight-step dossier workspace.
        </p>
      </section>
    </main>
  );
}
