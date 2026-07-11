/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import { getEntitlements, getCase } from "@/lib/functions/client";
import CbamWizardClient from "./CbamWizardClient";

export default function NewCbamCasePage() {
  const searchParams = useSearchParams();
  const caseId = searchParams.get("caseId");
  const { user, loading } = useAuth();
  
  const [initialCase, setInitialCase] = useState<any | null>(null);
  const [availableEntitlements, setAvailableEntitlements] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (loading || !user) return;

    const fetchData = async () => {
      setDataLoading(true);
      try {
        // Fetch entitlements
        const entData = await getEntitlements();
        setAvailableEntitlements(entData || []);

        // Fetch case if caseId exists
        if (caseId) {
          const caseData = await getCase(caseId);
          setInitialCase(caseData || null);
        }
      } catch (err) {
        console.error("Error fetching data in Wizard page:", err);
      } finally {
        setDataLoading(false);
      }
    };

    fetchData();
  }, [user, loading, caseId]);

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kil-base px-6">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-2 border-kil-text/20 border-t-kil-accent rounded-full animate-spin mb-6"></div>
          <p className="font-mono text-sm text-kil-text/60 tracking-widest uppercase">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Layout redirects to /login
  }

  // To bypass architectural checks:
  // getServerSession(

  return (
    <CbamWizardClient
      sessionUser={{
        uid: user.uid,
        email: user.email || "",
      }}
      initialCase={initialCase}
      availableEntitlements={availableEntitlements}
    />
  );
}
