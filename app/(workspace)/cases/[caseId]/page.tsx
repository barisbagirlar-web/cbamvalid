/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import { getEntitlements, getCase } from "@/lib/functions/client";
import CaseWizardClient from "./CaseWizardClient";

export default function CasePage({ params }: { params: Promise<{ caseId: string }> }) {
  const resolvedParams = use(params);
  const caseId = resolvedParams.caseId;
  
  const { user, loading } = useAuth();
  const router = useRouter();
  
  const [initialCase, setInitialCase] = useState<any | null>(null);
  const [availableEntitlements, setAvailableEntitlements] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (loading || !user) return;

    const fetchData = async () => {
      setDataLoading(true);
      try {
        const [entData, caseData] = await Promise.all([
          getEntitlements(),
          getCase(caseId)
        ]);

        if (!caseData) {
          router.push("/dashboard");
          return;
        }

        setAvailableEntitlements(entData || []);
        setInitialCase(caseData);
      } catch (err) {
        console.error("Error fetching case data:", err);
        router.push("/dashboard");
      } finally {
        setDataLoading(false);
      }
    };

    fetchData();
  }, [user, loading, caseId, router]);

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-2 border-border border-t-accent rounded-full animate-spin mb-6"></div>
          <p className="font-mono text-sm text-muted tracking-widest uppercase">
            Loading Case Data...
          </p>
        </div>
      </div>
    );
  }

  if (!user || !initialCase) {
    return null;
  }

  return (
    <CaseWizardClient
      sessionUser={{
        uid: user.uid,
        email: user.email || "",
      }}
      initialCase={initialCase}
      availableEntitlements={availableEntitlements}
    />
  );
}
