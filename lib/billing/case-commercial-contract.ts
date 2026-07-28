/**
 * Case-scoped pay-at-lock commercial contract + public messaging SSOT.
 *
 * Customer truth:
 * Work free → pay once to lock this working file → correct/re-lock same file free
 * → new file = new payment. Not accredited verification.
 *
 * Practical maxReleases is a storage/abuse ceiling, not a customer “5 pack” meter.
 */

import { CANONICAL_PRICING } from "@/lib/billing/pricing-config";

export const CASE_COMMERCIAL = {
  billingModel: "CASE_PAY_AT_LOCK" as const,
  amountMinor: CANONICAL_PRICING.amountMinor,
  priceFormatted: CANONICAL_PRICING.priceFormatted,
  packName: CANONICAL_PRICING.packName,
  /** Abuse/storage ceiling — presented to customers as unlimited corrections on this file. */
  maxReleasesPerPaidCase: 100,
  customerOneLiner:
    "Work free. Pay once to lock this file. Correct and re-lock this same file as needed. A new file needs a new payment.",
  paymentCtaLabel: `Pay ${CANONICAL_PRICING.priceFormatted} to lock this file`,
  paidLockCtaLabel: "Lock & download package",
  /** Hero / AEO speakable sentence (English only). */
  speakableAnswer: `USD ${CANONICAL_PRICING.displayPrice} unlocks lock-and-download for one working file: one operator, one installation, and one reporting year. Drafting is free. Pay when you lock. Same file: correct and re-lock as needed at no extra charge. A new file needs a new payment. Not an accredited verification opinion.`,
  valuePitch:
    "You only pay when the deliverable matters — when you lock a verifier-preparation package for a defined factory and year. Corrections on that same file stay included so buyer feedback does not mean another checkout.",
} as const;

/** Ordered topic cards for pricing / how-it-works / legal mirrors. */
export const COMMERCIAL_TOPIC_CARDS = [
  {
    id: "draft-free",
    title: "Draft free",
    body: "Create and edit a working file with unlimited drafts. No card is required until you lock.",
  },
  {
    id: "pay-at-lock",
    title: "Pay once when you lock",
    body: `Your card is charged ${CANONICAL_PRICING.priceFormatted} when you unlock lock-and-download for that specific working file — not while you edit drafts.`,
  },
  {
    id: "same-file-corrections",
    title: "Same file: corrections included",
    body: "After payment, correct evidence or numbers and re-lock the same working file as needed. Failed locks charge nothing. Re-download is free.",
  },
  {
    id: "new-file-new-payment",
    title: "New file = new payment",
    body: "Another installation, another reporting year, or a new working file requires a new payment. One payment cannot unlock many unrelated CBAM files.",
  },
  {
    id: "scope-lock",
    title: "Strict commercial scope",
    body: "Each paid file covers one legal operator/exporter, one production installation, and one reporting year with defined processes and linked goods.",
  },
  {
    id: "not-verification",
    title: "Verifier preparation — not EU approval",
    body: "CBAMValid produces an operator-prepared dossier for independent accredited verification. It is not an accredited opinion, customs approval, or registry acceptance.",
  },
] as const;

export const COMMERCIAL_PUBLIC_FAQ = [
  {
    question: "When is my card charged?",
    answer: `Drafting and editing are free. Your card is charged ${CANONICAL_PRICING.priceFormatted} when you pay to lock a specific working file. Sealing that paid file does not charge again for ordinary corrections on the same file.`,
  },
  {
    question: `What exactly does ${CANONICAL_PRICING.priceFormatted} unlock?`,
    answer: `Lock-and-download for one working file scoped to one legal operator, one installation, and one reporting year — including unlimited drafts on that file and correction re-locks on that same file. It is a verifier-preparation dossier, not a subscription and not an Excel-only export.`,
  },
  {
    question: "If my buyer asks for corrections, do I pay again?",
    answer:
      "No — not for the same paid working file. Correct the data, clear blockers, and re-lock. A new factory, year, or separate working file needs a new payment.",
  },
  {
    question: "Can one payment cover several CBAM files?",
    answer:
      "No. Payment is bound to one working file (case). Cloning or creating another file does not inherit payment. This protects honest buyers from open-ended multi-site abuse while keeping correction work fair.",
  },
  {
    question: "What if a lock fails?",
    answer:
      "A blocked or failed lock does not complete delivery and does not consume the paid unlock for that file. Fix the blockers and try again. Re-download of an already sealed package is free.",
  },
  {
    question: "Is this official EU verification or customs approval?",
    answer:
      "No. CBAMValid prepares an operator dossier for independent accredited verification. It does not issue an accredited verification opinion, customs approval, registry acceptance, or EU approval.",
  },
  {
    question: "Do you offer refunds?",
    answer:
      "Yes. If you paid for a working file and have not yet completed a successful sealed lock, you may request a refund within 14 days. Duplicate charges and confirmed failed deliveries are refundable. See the Refund Policy.",
  },
  {
    question: "Can I pay in EUR?",
    answer:
      "Displayed EUR figures are approximate. Billing settles in USD at checkout; your card issuer handles conversion at its own rate.",
  },
] as const;

/** Terms / contract clauses (English, customer-facing). */
export const COMMERCIAL_LEGAL_CLAUSES = [
  {
    title: "Commercial unit",
    body: `The purchasable unit is lock-and-download for one Working File covering one legal operator/exporter, one production installation, and one reporting year (the “Commercial Scope”), currently priced at ${CANONICAL_PRICING.priceFormatted} unless otherwise stated at checkout.`,
  },
  {
    title: "When payment is due",
    body: "Drafting and editing a Working File are free. Payment is due to unlock lock-and-download for that Working File. Checkout is bound to a specific Working File identifier (caseId). Payment does not unlock other Working Files.",
  },
  {
    title: "Corrections on the same Working File",
    body: "After a successful payment for a Working File, the customer may correct inputs and create further sealed releases for that same Working File without an additional charge, subject to acceptable use and platform integrity limits. Prior sealed releases remain immutable and downloadable.",
  },
  {
    title: "New Working File requires new payment",
    body: "A new Working File, a material change of Commercial Scope (operator, installation, or reporting year) that requires a new Working File, or a clone/copy of a Working File does not inherit prior payment. Each such file requires its own checkout.",
  },
  {
    title: "Failed locks and re-download",
    body: "A blocked or failed sealing attempt does not complete delivery and does not require a new payment for the already-paid Working File. Re-download of an already sealed package does not require a new payment.",
  },
  {
    title: "No verification claim",
    body: "CBAMValid provides operator/exporter preparation software and sealed packages prepared for independent accredited verification. Purchase does not create an accredited verification opinion, reasonable assurance, EU approval, customs approval, or registry acceptance.",
  },
] as const;

export type CaseCommercialStatus = "UNPAID" | "PENDING" | "PAID";

export function isCasePaidForSealing(input: {
  scopedEntitlement?: { scopeCaseId?: string; status?: string; releasesRemaining?: number } | null;
  caseId: string;
}): boolean {
  const ent = input.scopedEntitlement;
  if (!ent) return false;
  if (ent.scopeCaseId && ent.scopeCaseId !== input.caseId) return false;
  const status = String(ent.status || "").toUpperCase();
  if (!["AVAILABLE", "ACTIVE", "PURCHASED", "RESERVED"].includes(status)) return false;
  return Number(ent.releasesRemaining || 0) > 0 || status === "AVAILABLE";
}
