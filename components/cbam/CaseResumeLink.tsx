"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { AuditReadyCase } from "@/lib/cbam/schema";
import { writeCaseWorkspaceCache } from "@/lib/cbam/workspace-cache";
import {
  prewarmCaseWorkspace,
  seedWorkspaceCase,
} from "@/lib/functions/workspace-loader";

export function CaseResumeLink({
  ownerUid,
  caseId,
  caseData,
  updatedAt,
}: {
  ownerUid: string;
  caseId: string;
  caseData: AuditReadyCase;
  updatedAt?: string;
}) {
  useEffect(() => {
    seedWorkspaceCase(caseId, caseData);
    try {
      writeCaseWorkspaceCache(ownerUid, caseId, caseData, updatedAt);
    } catch (error) {
      console.warn("Failed to prepare instant case navigation", caseId, error);
    }
  }, [caseData, caseId, ownerUid, updatedAt]);

  const prewarm = () => {
    seedWorkspaceCase(caseId, caseData);
    prewarmCaseWorkspace(caseId);
  };

  return (
    <Link
      href={`/cases/${caseId}`}
      prefetch
      onPointerEnter={prewarm}
      onFocus={prewarm}
      onTouchStart={prewarm}
      onClick={prewarm}
      className="bg-accent hover:bg-accent-hover text-surface text-xs font-semibold px-4 py-2 rounded-md transition-colors flex items-center gap-1 self-end sm:self-auto"
    >
      Resume Draft <ArrowRight className="w-3 h-3" />
    </Link>
  );
}
