"use client";

import { useState } from "react";
import { Loader2, PackageCheck } from "lucide-react";
import {
  RELEASES_PER_PREPARATION_PACK,
  packsUnlockableFromCredits,
} from "@/lib/billing/credit-contract";
import { unlockCbamUses } from "@/lib/functions/client";

type UnlockPreparationPackPanelProps = {
  availableCredits: number;
  hasActivePack: boolean;
  onUnlocked?: (entitlementId?: string) => void | Promise<void>;
  compact?: boolean;
};

export function UnlockPreparationPackPanel({
  availableCredits,
  hasActivePack,
  onUnlocked,
  compact = false,
}: UnlockPreparationPackPanelProps) {
  const [unlocking, setUnlocking] = useState(false);
  const [status, setStatus] = useState("");
  const unlockablePacks = packsUnlockableFromCredits(availableCredits);
  const canUnlock = unlockablePacks > 0;

  if (!canUnlock && hasActivePack) return null;

  const handleUnlock = async () => {
    if (!canUnlock || unlocking) return;
    setUnlocking(true);
    setStatus("");
    try {
      const result = await unlockCbamUses(crypto.randomUUID());
      const entitlementId =
        typeof result.entitlementId === "string" ? result.entitlementId : undefined;
      setStatus(
        typeof result.message === "string"
          ? result.message
          : `Activated one Preparation Pack with ${RELEASES_PER_PREPARATION_PACK} sealed releases.`
      );
      await onUnlocked?.(entitlementId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Activation failed.";
      setStatus(message);
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div
      className={
        compact
          ? "rounded-lg border border-accent/25 bg-accent/5 p-4"
          : "rounded-sm border border-accent/25 bg-accent/5 p-5"
      }
    >
      <div className="flex items-start gap-3">
        <PackageCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-2">
          <h3 className="font-serif text-lg text-foreground">
            {hasActivePack ? "Activate another Preparation Pack" : "Activate Preparation Pack"}
          </h3>
          <p className="text-sm leading-relaxed text-muted">
            You have unused Preparation Pack balance from a purchase or grant. Activating a pack unlocks
            exactly {RELEASES_PER_PREPARATION_PACK} successful sealed releases for one operator, one
            installation, and one reporting year.
          </p>
          <p className="font-mono text-xs text-muted">
            Packs ready to activate: {unlockablePacks}
          </p>
          {canUnlock ? (
            <button
              type="button"
              onClick={() => void handleUnlock()}
              disabled={unlocking}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-surface transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {unlocking ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Activate pack (+{RELEASES_PER_PREPARATION_PACK} sealed releases)
            </button>
          ) : (
            <p className="text-sm text-muted">
              Buy a Preparation Pack at checkout to unlock five sealed releases.
            </p>
          )}
          {status ? <p className="text-xs text-muted">{status}</p> : null}
        </div>
      </div>
    </div>
  );
}
