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
  includedSealedReleases: 5,
  draftPolicy: "Unlimited drafts",
  description: "Prepared for Independent Accredited Verification",
  /** Short customer/SEO line. */
  valueSummary:
    "One locked working file for one operator, one installation, and one reporting year — unlimited drafts, five successful sealed releases.",
  /** Correct payment flow (not “pay at seal”). */
  paymentFlowSummary:
    "Draft free. Buy the pack once at checkout. Each successful seal uses one of five releases. Failed seals use none. Re-download is free.",
};
