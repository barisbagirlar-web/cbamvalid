/**
 * Server-side mirror of case-scoped pay-at-lock commercial constants.
 * Keep aligned with lib/billing/case-commercial-contract.ts.
 */

export const CASE_COMMERCIAL_SERVER = {
  billingModel: "CASE_PAY_AT_LOCK" as const,
  /** Abuse/storage ceiling for reseals on one paid case (customer: unlimited corrections). */
  maxReleasesPerPaidCase: 100,
} as const;
