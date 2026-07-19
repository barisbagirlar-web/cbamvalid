"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, CreditCard, Loader2, LockKeyhole, RefreshCw } from "lucide-react";
import { COMMERCIAL_CONTRACT, formatCommercialPrice } from "@/lib/billing/commercial-contract";
import { assessCaseReadiness } from "@/lib/cbam/validation/readiness-assessor";
import {
  getPreparationPacks,
  unlockPreparationPack,
} from "@/lib/functions/commerce-client";
import type { PreparationPackEntitlement } from "@/lib/functions/commerce-types";
import { getCase, sealReport } from "@/lib/functions/client";

interface CaseCommercialPanelProps {
  caseId: string;
  initialEntitlements: PreparationPackEntitlement[];
  initialAvailableCredits: number;
  initialCommerceHoldActive: boolean;
}

function describeError(error: unknown): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : "The commercial operation failed.";
}

export default function CaseCommercialPanel({
  caseId,
  initialEntitlements,
  initialAvailableCredits,
  initialCommerceHoldActive,
}: CaseCommercialPanelProps) {
  const router = useRouter();
  const unlockRequestId = useRef<string>(crypto.randomUUID());
  const sealRequestId = useRef<string>(crypto.randomUUID());
  const [entitlements, setEntitlements] = useState(initialEntitlements);
  const [availableCredits, setAvailableCredits] = useState(initialAvailableCredits);
  const [commerceHoldActive] = useState(initialCommerceHoldActive);
  const [correctionReason, setCorrectionReason] = useState("");
  const [status, setStatus] = useState("");
  const [tone, setTone] = useState<"neutral" | "success" | "error">("neutral");
  const [unlocking, setUnlocking] = useState(false);
  const [sealing, setSealing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const compatiblePacks = useMemo(() => entitlements
    .filter((entitlement) =>
      entitlement.status === "AVAILABLE" &&
      entitlement.scopeCaseId === caseId &&
      entitlement.releasesRemaining > 0
    )
    .sort((left, right) => left.entitlementId.localeCompare(right.entitlementId)),
  [caseId, entitlements]);
  const activePack = compatiblePacks[0];
  const nextRelease = activePack ? activePack.releasesCount + 1 : 1;
  const requiresCorrectionReason = nextRelease > 1;

  const refresh = async () => {
    setRefreshing(true);
    setStatus("");
    try {
      const next = await getPreparationPacks();
      setEntitlements(next);
      setTone("success");
      setStatus("Preparation Pack capacity refreshed.");
    } catch (error: unknown) {
      setTone("error");
      setStatus(describeError(error));
    } finally {
      setRefreshing(false);
    }
  };

  const unlock = async () => {
    if (commerceHoldActive) {
      setTone("error");
      setStatus("COMMERCE_HOLD_ACTIVE");
      return;
    }
    if (activePack) {
      setTone("neutral");
      setStatus("This case already has an active Preparation Pack.");
      return;
    }
    if (availableCredits < COMMERCIAL_CONTRACT.creditsRequiredToUnlock) {
      setTone("error");
      setStatus(`${COMMERCIAL_CONTRACT.creditsRequiredToUnlock} credits are required to unlock one Preparation Pack.`);
      return;
    }

    setUnlocking(true);
    setStatus("");
    try {
      const result = await unlockPreparationPack(unlockRequestId.current, caseId);
      const next = await getPreparationPacks();
      setAvailableCredits(result.balanceAfter);
      setEntitlements(next);
      setTone("success");
      setStatus(result.message);
    } catch (error: unknown) {
      setTone("error");
      setStatus(describeError(error));
    } finally {
      setUnlocking(false);
    }
  };

  const seal = async () => {
    if (commerceHoldActive) {
      setTone("error");
      setStatus("COMMERCE_HOLD_ACTIVE");
      return;
    }
    if (!activePack) {
      setTone("error");
      setStatus("Unlock a Preparation Pack for this case before sealing.");
      return;
    }
    if (requiresCorrectionReason && correctionReason.trim().length < 10) {
      setTone("error");
      setStatus("A correction reason of at least 10 characters is required for release 2–5.");
      return;
    }

    setSealing(true);
    setStatus("");
    try {
      const latestCase = await getCase(caseId);
      const readiness = assessCaseReadiness(latestCase);
      if (!readiness.isEligibleForSealing) {
        throw new Error(`SEALING_BLOCKED:${readiness.status}:${readiness.allGaps.length}_GAPS`);
      }
      const response = await sealReport(
        caseId,
        activePack.entitlementId,
        sealRequestId.current,
        requiresCorrectionReason ? correctionReason.trim() : undefined
      );
      if (!response.report.reportId) throw new Error("SEALED_REPORT_ID_MISSING");
      router.push(`/cbam/reports/${response.report.reportId}`);
    } catch (error: unknown) {
      setTone("error");
      setStatus(describeError(error));
    } finally {
      setSealing(false);
    }
  };

  const toneClass = tone === "success"
    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
    : tone === "error"
      ? "border-red-300 bg-red-50 text-red-900"
      : "border-border bg-neutral-soft text-foreground";

  return (
    <section className="mx-auto mt-6 max-w-6xl rounded-2xl border border-border bg-surface p-5 shadow-sm md:p-6" aria-labelledby="commercial-release-heading">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Server-controlled commercial release</p>
          <h2 id="commercial-release-heading" className="mt-2 font-serif text-2xl font-bold">Preparation Pack and sealed versions</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Save the case draft in the wizard below. This panel reloads the latest server case, verifies every readiness blocker, and consumes a release only after the signed artifact transaction completes.
          </p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={refreshing || unlocking || sealing} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border px-4 text-sm font-semibold hover:bg-neutral-soft disabled:opacity-50">
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh capacity
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-neutral-soft p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Account credits</p>
          <p className="mt-2 font-mono text-3xl font-bold">{availableCredits}</p>
          <p className="mt-1 text-xs text-muted">{COMMERCIAL_CONTRACT.creditsRequiredToUnlock} credits unlock one case pack.</p>
        </div>
        <div className="rounded-xl border border-border bg-neutral-soft p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Case pack</p>
          <p className="mt-2 text-lg font-bold">{activePack ? "Active" : "Not unlocked"}</p>
          <p className="mt-1 text-xs text-muted">{activePack ? `${activePack.releasesRemaining} of ${activePack.maxReleases} sealed versions remain.` : "No release can be consumed until explicit unlock."}</p>
        </div>
        <div className="rounded-xl border border-border bg-neutral-soft p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Next release</p>
          <p className="mt-2 text-lg font-bold">{activePack ? `${nextRelease}/${activePack.maxReleases}` : "—"}</p>
          <p className="mt-1 text-xs text-muted">Release 2–5 requires a recorded correction reason.</p>
        </div>
      </div>

      {commerceHoldActive && (
        <div role="alert" className="mt-5 flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0" /> A refund-related commerce hold blocks pack unlock and sealing until administrative resolution.
        </div>
      )}

      {!activePack && !commerceHoldActive && (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          {availableCredits >= COMMERCIAL_CONTRACT.creditsRequiredToUnlock ? (
            <button type="button" onClick={() => void unlock()} disabled={unlocking || sealing} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-accent px-5 font-semibold text-surface hover:bg-accent-hover disabled:opacity-50">
              {unlocking ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />} Unlock this case for {COMMERCIAL_CONTRACT.creditsRequiredToUnlock} credits
            </button>
          ) : (
            <Link href="/credits/buy" className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md bg-accent px-5 font-semibold text-surface hover:bg-accent-hover">
              Purchase {COMMERCIAL_CONTRACT.creditsGranted} credits — {formatCommercialPrice()}
            </Link>
          )}
        </div>
      )}

      {activePack && (
        <div className="mt-5 space-y-4">
          {requiresCorrectionReason && (
            <div>
              <label htmlFor="correction-reason" className="mb-1 block text-xs font-bold">Correction reason for sealed release {nextRelease}</label>
              <textarea id="correction-reason" value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} minLength={10} rows={4} placeholder="State the corrected data, evidence or methodology and why a new sealed version is required." className="w-full rounded-md border border-border bg-background p-3 text-sm" />
            </div>
          )}
          <button type="button" onClick={() => void seal()} disabled={sealing || unlocking || commerceHoldActive} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-accent px-5 font-semibold text-surface hover:bg-accent-hover disabled:opacity-50">
            {sealing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Validate latest saved draft and generate release {nextRelease}/{activePack.maxReleases}
          </button>
        </div>
      )}

      {status && <div role="status" className={`mt-5 rounded-lg border p-4 text-sm ${toneClass}`}>{status}</div>}
      <p className="mt-4 text-xs leading-relaxed text-muted">The legacy wizard seal control receives no entitlement and remains disabled. This panel is the only client path for unlock and release generation.</p>
    </section>
  );
}
