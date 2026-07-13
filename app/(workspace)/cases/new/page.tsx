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

    let started = false;
    const initializeNewCase = async () => {
      if (started) return;
      started = true;
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
            actor: user.uid,
            action: "CASE_CREATED",
          }]
        };

        const newCaseId = await saveCase(emptyCase);
        router.replace(`/cases/${newCaseId}`);
      } catch (error) {
        console.error("Failed to initialize new case", error);
        router.replace("/cbam");
      }
    };

    initializeNewCase();
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 border-2 border-border border-t-accent rounded-full animate-spin mb-6"></div>
        <p className="font-mono text-sm text-muted tracking-widest uppercase">
          Creating Your Draft Dossier…
        </p>
      </div>
    </div>
  );
}
