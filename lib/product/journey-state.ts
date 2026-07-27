import {
  packsUnlockableFromCredits,
  RELEASES_PER_PREPARATION_PACK,
} from "@/lib/billing/credit-contract";
import { CANONICAL_PRICING } from "@/lib/billing/pricing-config";
import { CUSTOMER_LANGUAGE } from "@/lib/product/customer-language";

/**
 * P0 acceptance (10/10 customer journey layer):
 * 1. Every login lands on one “Where you are” truth.
 * 2. Exactly one primary CTA is shown for the current state.
 * 3. Working file ≠ locked package is obvious in plain language.
 * 4. Pack purchase and seal timing stay: draft free → pay at checkout → seal uses a release.
 * 5. SEO/public registry and Paddle amount SSOT are unchanged by this layer.
 *
 * Scenario matrix (must stay green in unit tests):
 * | # | files | locked | releasesLeft | unlockablePacks | state |
 * |---|-------|--------|--------------|-----------------|-------|
 * | A | 0 | 0 | 0 | 0 | NO_FILE |
 * | B | 0 | 0 | 0 | ≥1 | PACK_READY_TO_ACTIVATE |
 * | C | ≥1 | 0 | 0 | 0 | READY_NO_PACK (or FILE_IN_PROGRESS if we prioritize continue) |
 * | D | ≥1 | 0 | ≥1 | * | READY_TO_SEAL |
 * | E | ≥1 | ≥1 | ≥1 | * | SEALED_WITH_RELEASES |
 * | F | ≥1 | ≥1 | 0 | 0 | SEALED_NO_RELEASES |
 * | G | ≥1 | ≥1 | 0 | ≥1 | PACK_READY_TO_ACTIVATE |
 * | H | ≥1 | * | ≥1 | * | blockers>0 | BLOCKERS_OPEN |
 */
export type JourneyStateId =
  | "NO_FILE"
  | "FILE_IN_PROGRESS"
  | "BLOCKERS_OPEN"
  | "READY_NO_PACK"
  | "PACK_READY_TO_ACTIVATE"
  | "READY_TO_SEAL"
  | "SEALED_WITH_RELEASES"
  | "SEALED_NO_RELEASES";

export type JourneyInput = {
  workingFileCount: number;
  lockedPackageCount: number;
  releasesRemaining: number;
  availableCredits: number;
  /** Prefer continuing this file when present. */
  primaryWorkingFileId?: string | null;
  postPurchase?: boolean;
  /** Open QC blockers on the primary working file (0 = none / unknown). */
  blockersOpen?: number;
  completenessPercentage?: number;
};

export type JourneyView = {
  state: JourneyStateId;
  headline: string;
  explanation: string;
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  packSummary: string;
};

export function resolveJourneyState(input: JourneyInput): JourneyView {
  const unlockable = packsUnlockableFromCredits(input.availableCredits);
  const hasFile = input.workingFileCount > 0;
  const hasLocked = input.lockedPackageCount > 0;
  const hasReleases = input.releasesRemaining > 0;
  const fileHref = input.primaryWorkingFileId
    ? `/cases/${input.primaryWorkingFileId}`
    : "/cases/new";

  const packSummary = hasReleases
    ? `${input.releasesRemaining} sealed release${input.releasesRemaining === 1 ? "" : "s"} left on your Preparation Pack.`
    : unlockable > 0
      ? `${unlockable} Preparation Pack${unlockable === 1 ? "" : "s"} ready to activate.`
      : `No active Preparation Pack. ${CANONICAL_PRICING.priceFormatted} unlocks ${RELEASES_PER_PREPARATION_PACK} sealed releases.`;

  if (input.postPurchase && hasReleases && hasFile) {
    return {
      state: "READY_TO_SEAL",
      headline: "Pack purchased — finish your working file, then lock it",
      explanation:
        "Payment is done. Complete quality checks on your working file, then lock and download. Each successful lock uses one sealed release.",
      primaryCta: { label: CUSTOMER_LANGUAGE.continueFile, href: fileHref },
      secondaryCta: { label: "View sample package", href: "/sample-dossier" },
      packSummary,
    };
  }

  if (input.postPurchase && hasReleases && !hasFile) {
    return {
      state: "NO_FILE",
      headline: "Pack purchased — create your working file",
      explanation: CUSTOMER_LANGUAGE.oneLineStory,
      primaryCta: { label: CUSTOMER_LANGUAGE.createFile, href: "/cases/new" },
      secondaryCta: { label: "View sample package", href: "/sample-dossier" },
      packSummary,
    };
  }

  if (!hasFile && unlockable > 0) {
    return {
      state: "PACK_READY_TO_ACTIVATE",
      headline: "Activate your Preparation Pack, then create a working file",
      explanation:
        "You have unused pack balance. Activate it so sealing is available, then create one working file for one factory and one year.",
      primaryCta: { label: CUSTOMER_LANGUAGE.activatePack, href: "/account" },
      secondaryCta: { label: CUSTOMER_LANGUAGE.createFile, href: "/cases/new" },
      packSummary,
    };
  }

  if (!hasFile) {
    return {
      state: "NO_FILE",
      headline: "Start with one working file",
      explanation: CUSTOMER_LANGUAGE.oneLineStory,
      primaryCta: { label: CUSTOMER_LANGUAGE.createFile, href: "/cases/new" },
      secondaryCta: {
        label: `${CUSTOMER_LANGUAGE.buyPack} — ${CANONICAL_PRICING.priceFormatted}`,
        href: "/credits/buy",
      },
      packSummary,
    };
  }

  const blockers = Math.max(0, Number(input.blockersOpen || 0));
  if (blockers > 0 && hasReleases) {
    return {
      state: "BLOCKERS_OPEN",
      headline: `Fix ${blockers} blocker${blockers === 1 ? "" : "s"} before you can lock`,
      explanation:
        "Your Preparation Pack is ready. Open the working file, clear quality blockers, then lock and download. A failed lock uses zero releases.",
      primaryCta: { label: CUSTOMER_LANGUAGE.continueFile, href: fileHref },
      secondaryCta: { label: "Open quality step", href: `${fileHref}` },
      packSummary,
    };
  }

  if (blockers > 0 && !hasReleases) {
    return {
      state: "FILE_IN_PROGRESS",
      headline: `Continue your working file (${blockers} blocker${blockers === 1 ? "" : "s"} open)`,
      explanation:
        "Keep editing for free. Buy or activate a Preparation Pack when you are ready to lock. Blockers must be cleared before a successful lock.",
      primaryCta: { label: CUSTOMER_LANGUAGE.continueFile, href: fileHref },
      secondaryCta: {
        label: unlockable > 0 ? CUSTOMER_LANGUAGE.activatePack : `${CUSTOMER_LANGUAGE.buyPack} — ${CANONICAL_PRICING.priceFormatted}`,
        href: unlockable > 0 ? "/account" : "/credits/buy",
      },
      packSummary,
    };
  }

  if (!hasReleases && unlockable > 0) {
    return {
      state: "PACK_READY_TO_ACTIVATE",
      headline: "Activate a Preparation Pack to lock your file",
      explanation:
        "Your working file can be edited freely. To lock and download, activate unused pack balance (or buy another pack).",
      primaryCta: { label: CUSTOMER_LANGUAGE.activatePack, href: "/account" },
      secondaryCta: { label: CUSTOMER_LANGUAGE.continueFile, href: fileHref },
      packSummary,
    };
  }

  if (!hasReleases) {
    return {
      state: hasLocked ? "SEALED_NO_RELEASES" : "READY_NO_PACK",
      headline: hasLocked
        ? "All sealed releases used — buy another pack for more locks"
        : "Buy a Preparation Pack when you are ready to lock",
      explanation: hasLocked
        ? "Your locked packages stay downloadable. Another factory, year, or more locks needs another Preparation Pack."
        : "Keep editing your working file for free. Your card is charged only when you buy the pack at checkout — not when you click lock.",
      primaryCta: {
        label: `${CUSTOMER_LANGUAGE.buyPack} — ${CANONICAL_PRICING.priceFormatted}`,
        href: "/credits/buy",
      },
      secondaryCta: { label: CUSTOMER_LANGUAGE.continueFile, href: fileHref },
      packSummary,
    };
  }

  if (hasLocked) {
    return {
      state: "SEALED_WITH_RELEASES",
      headline: "Download again, or lock a correction version",
      explanation:
        "Locked packages never change. To fix something, edit the working file and lock again — that uses one more sealed release.",
      primaryCta: { label: CUSTOMER_LANGUAGE.continueFile, href: fileHref },
      secondaryCta: { label: `Open ${CUSTOMER_LANGUAGE.lockedPackages.toLowerCase()}`, href: "/reports" },
      packSummary,
    };
  }

  return {
    state: "READY_TO_SEAL",
    headline: "Finish checks, then lock & download",
    explanation:
      "You have an active Preparation Pack. Complete the working file steps, clear blockers, then lock. A failed lock uses zero releases.",
    primaryCta: { label: CUSTOMER_LANGUAGE.continueFile, href: fileHref },
    secondaryCta: { label: CUSTOMER_LANGUAGE.sealAction, href: fileHref },
    packSummary,
  };
}
