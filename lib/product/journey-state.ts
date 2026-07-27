import {
  packsUnlockableFromCredits,
} from "@/lib/billing/credit-contract";
import { CANONICAL_PRICING } from "@/lib/billing/pricing-config";
import { CASE_COMMERCIAL } from "@/lib/billing/case-commercial-contract";
import { CUSTOMER_LANGUAGE } from "@/lib/product/customer-language";

/**
 * P0 acceptance (10/10 customer journey layer):
 * 1. Every login lands on one “Where you are” truth.
 * 2. Exactly one primary CTA is shown for the current state.
 * 3. Working file ≠ locked package is obvious in plain language.
 * 4. Pack purchase and seal timing: draft free → pay at lock for this file → same-file corrections included.
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
    ? "Paid unlock is active for at least one working file — same-file correction re-locks stay included."
    : unlockable > 0
      ? `${unlockable} legacy Preparation Pack${unlockable === 1 ? "" : "s"} ready to activate (grandfather balance — not a new card charge).`
      : `Draft free. Pay ${CANONICAL_PRICING.priceFormatted} once when you lock a working file. Same file: unlimited corrections. New file = new payment.`;

  if (input.postPurchase && hasReleases && hasFile) {
    return {
      state: "READY_TO_SEAL",
      headline: "Payment confirmed — finish your working file, then lock it",
      explanation:
        "Payment is done for this working file. Complete quality checks, then lock and download. Same-file corrections and re-locks stay included.",
      primaryCta: { label: CUSTOMER_LANGUAGE.continueFile, href: fileHref },
      secondaryCta: { label: "View sample package", href: "/sample-dossier" },
      packSummary,
    };
  }

  if (input.postPurchase && hasReleases && !hasFile) {
    return {
      state: "NO_FILE",
      headline: "Payment confirmed — create your working file",
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
        label: `${CASE_COMMERCIAL.paymentCtaLabel}`,
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
        "This working file is paid. Open it, clear quality blockers, then lock and download. A failed lock charges nothing.",
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
        "Keep editing for free. Pay once when you are ready to lock this file. Blockers must be cleared before a successful lock.",
      primaryCta: { label: CUSTOMER_LANGUAGE.continueFile, href: fileHref },
      secondaryCta: {
        label: unlockable > 0 ? CUSTOMER_LANGUAGE.activatePack : CASE_COMMERCIAL.paymentCtaLabel,
        href: unlockable > 0 ? "/account" : input.primaryWorkingFileId
          ? `/credits/buy?caseId=${encodeURIComponent(input.primaryWorkingFileId)}`
          : "/credits/buy",
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
        ? "This locked work stays available — a new file needs a new payment"
        : "Work free — pay once when you lock this file",
      explanation: hasLocked
        ? "Downloads of prior locked packages stay free. Start a new working file for another factory or year, then pay when you lock that file."
        : CASE_COMMERCIAL.customerOneLiner,
      primaryCta: hasFile
        ? {
            label: CASE_COMMERCIAL.paymentCtaLabel,
            href: input.primaryWorkingFileId
              ? `/credits/buy?caseId=${encodeURIComponent(input.primaryWorkingFileId)}`
              : "/credits/buy",
          }
        : {
            label: CUSTOMER_LANGUAGE.createFile,
            href: "/cases/new",
          },
      secondaryCta: hasFile
        ? { label: CUSTOMER_LANGUAGE.continueFile, href: fileHref }
        : undefined,
      packSummary,
    };
  }

  if (hasLocked) {
    return {
      state: "SEALED_WITH_RELEASES",
      headline: "Download again, or lock a correction version",
      explanation:
        "Locked packages never change. To fix something, edit the same paid working file and lock again — same-file corrections stay included.",
      primaryCta: { label: CUSTOMER_LANGUAGE.continueFile, href: fileHref },
      secondaryCta: { label: `Open ${CUSTOMER_LANGUAGE.lockedPackages.toLowerCase()}`, href: "/reports" },
      packSummary,
    };
  }

  return {
    state: "READY_TO_SEAL",
    headline: "Finish checks, then lock & download",
    explanation:
      "This working file is paid. Complete the steps, clear blockers, then lock. A failed lock charges nothing. Same-file corrections stay included.",
    primaryCta: { label: CUSTOMER_LANGUAGE.continueFile, href: fileHref },
    secondaryCta: { label: CUSTOMER_LANGUAGE.sealAction, href: fileHref },
    packSummary,
  };
}
