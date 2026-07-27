/**
 * Single source of truth for public commercial pricing copy and amount checks.
 * Paddle catalog price must match amountMinor before paid launch.
 */
export const CANONICAL_PRICING = {
  displayPrice: "249",
  currency: "USD" as const,
  priceFormatted: "$249",
  /** Approximate display only; checkout bills in USD. */
  eurApproxFormatted: "≈ €229",
  /** Minor units for order/catalog assertions (24900 = $249.00). */
  amountMinor: 24900,
  packName: "Exporter Verification Preparation Pack",
  includedOperators: 1,
  includedInstallations: 1,
  includedReportingYears: 1,
  /**
   * Practical same-file reseal ceiling (abuse/storage). Customer copy must say
   * “same-file corrections included”, never “exactly N seals”.
   * Legacy unbound credit unlocks still use RELEASES_PER_PREPARATION_PACK=5 internally.
   */
  includedSealedReleases: 100,
  draftPolicy: "Unlimited drafts",
  correctionPolicy: "Same-file correction re-locks included",
  description: "Prepared for Independent Accredited Verification",
  /** Short customer/SEO line — case-scoped pay-at-lock. */
  valueSummary:
    "One working file for one operator, one installation, and one reporting year — draft free, pay once to lock, correct and re-lock the same file as needed.",
  /** Case-scoped pay-at-lock flow (customer SSOT). */
  paymentFlowSummary:
    "Draft free. Pay once when you lock this working file. Same file: correct and re-lock as needed at no extra charge. A new file needs a new payment. Failed locks charge nothing. Re-download is free.",
};
