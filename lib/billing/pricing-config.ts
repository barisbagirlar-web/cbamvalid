/**
 * Single source of truth for public commercial pricing copy and amount checks.
 * Paddle catalog price must match amountMinor before paid launch.
 *
 * Owner mandate 2026-07-28 (FAZ 2): Single Pack list price $249 → $449.
 * Existing fulfilled $249 unlocks remain grandfathered at the ledger amount charged.
 */
export const CANONICAL_PRICING = {
  displayPrice: "449",
  currency: "USD" as const,
  priceFormatted: "$449",
  /** Approximate display only; checkout bills in USD. */
  eurApproxFormatted: "≈ €415",
  /** Minor units for order/catalog assertions (44900 = $449.00). */
  amountMinor: 44900,
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
  grandfatherNote:
    "Working files already unlocked at a prior checkout amount remain paid for that file. New lock checkouts use the current Single Pack price.",
} as const;

/** Public self-service tier architecture (Draft + Single Pack). */
export const PRICING_TIERS = [
  {
    id: "draft",
    name: "Draft",
    priceLabel: "$0",
    cadence: "forever",
    highlight: false,
    contactSales: false,
    ctaHref: "/register?next=/cases/new",
    ctaLabel: "Start Free Draft",
    scope: "Unlimited drafts, QC engine, and gap analysis — no card until lock.",
    features: [
      "Create and edit working files",
      "Real-time quality controls",
      "Evidence and data gap review",
      "Lock requires Single Pack payment for that file",
    ],
  },
  {
    id: "single-pack",
    name: "Single Pack",
    priceLabel: "$449",
    cadence: "one-time · pay at lock",
    highlight: true,
    contactSales: false,
    ctaHref: "/register?next=/cases/new",
    ctaLabel: "Start free — pay when you lock",
    scope: "1 operator / 1 installation / 1 reporting year · same-file re-locks included.",
    features: [
      "1 legal operator / exporter",
      "1 production installation",
      "1 reporting year",
      "Unlimited drafts on that working file",
      "Pay once to lock — corrections on same file included",
      "Evidence-linked calculations and QC checks",
      "Sealed PDF, JSON, and O3CI field-mapped export",
      "Immutable sealed versions + free re-download",
      "Buyer share link (/d/token)",
    ],
  },
] as const;
