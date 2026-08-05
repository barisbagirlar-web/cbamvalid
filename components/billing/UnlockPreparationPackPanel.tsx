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

  // Already sealing-capable: do not push a second activation path (main confusion source).
  if (hasActivePack) return null;
  if (!canUnlock) return null;

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
          : "Activated one pack balance (included balance — no new card charge)."
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
          <h3 className="font-serif text-lg text-foreground">Activate your pack balance</h3>
          <p className="text-sm leading-relaxed text-muted">
            You have unused pack balance from an earlier purchase. Activate it to unlock locking
            capacity without a new card charge. The normal path is pay-at-lock on a working file —
            this panel is only for leftover balance.
          </p>
          <p className="font-mono text-xs text-muted">
            Packs ready to activate: {unlockablePacks}
            {RELEASES_PER_PREPARATION_PACK ? ` · ${RELEASES_PER_PREPARATION_PACK} locks per pack` : ""}
          </p>
          <button
            type="button"
            onClick={() => void handleUnlock()}
            disabled={unlocking}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-surface transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {unlocking ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Activate pack balance
          </button>
          {status ? <p className="text-xs text-muted">{status}</p> : null}
        </div>
      </div>
    </div>
  );
}
