"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import { saveCase } from "@/lib/functions/client";
import { createEmptyInput, AuditReadyCase } from "@/lib/cbam/schema";

export default function NewCaseRedirectPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || !user) return;

    const initializeNewCase = async () => {
      try {
        const emptyCase: AuditReadyCase = {
          status: "DRAFT",
          version: 1,
          ownerId: user.uid,
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
          },
          directEmissions: createEmptyInput("tCO2e"),
          electricityConsumed: createEmptyInput("MWh"),
          gridEmissionFactor: createEmptyInput("tCO2e/MWh"),
          precursors: [],
          carbonPriceRecords: [],
          evidenceRegister: [],
          calculationTrace: [],
          gapAssessment: [],
          auditEvents: []
        };

        const newCaseId = await saveCase(emptyCase);
        router.push(`/cases/${newCaseId}`);
      } catch (e) {
        console.error("Failed to initialize new case", e);
        // Fallback to dashboard on error
        router.push("/dashboard");
      }
    };

    initializeNewCase();
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-kil-base px-6">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 border-2 border-kil-text/20 border-t-kil-accent rounded-full animate-spin mb-6"></div>
        <p className="font-mono text-sm text-kil-text/60 tracking-widest uppercase">
          Initializing Case...
        </p>
      </div>
    </div>
  );
}
