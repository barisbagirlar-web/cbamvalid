/**
 * Case-scoped pay-at-lock commercial contract + public messaging SSOT.
 *
 * Customer truth:
 * Work free → pay once to unlock software lock-and-download for this working file
 * → correct/re-lock same file free → new file = new payment.
 */

import { CANONICAL_PRICING } from "@/lib/billing/pricing-config";

export const CASE_COMMERCIAL = {
  billingModel: "CASE_PAY_AT_LOCK" as const,
  amountMinor: CANONICAL_PRICING.amountMinor,
  priceFormatted: CANONICAL_PRICING.priceFormatted,
  packName: CANONICAL_PRICING.packName,
  /** Abuse/storage ceiling — presented to customers as corrections included on this file. */
  maxReleasesPerPaidCase: 100,
  customerOneLiner:
    "Work free. Pay once to lock this file. Correct and re-lock this same file as needed. A new file needs a new payment.",
  paymentCtaLabel: `Pay ${CANONICAL_PRICING.priceFormatted} to lock this file`,
  paidLockCtaLabel: "Lock & download digital files",
  /** Hero / AEO speakable sentence (English only). */
  speakableAnswer: `USD ${CANONICAL_PRICING.displayPrice} unlocks software lock-and-download for one customer-controlled working file: one operator, one installation, and one reporting year. Drafting is free. Same-file corrections and re-locks are included. A new file needs a new payment.`,
  valuePitch:
    "You pay only when the automated digital outputs matter — when you lock a defined working file for one operator, installation and reporting year. Corrections on that same file remain included.",
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
    body: `Your card is charged ${CANONICAL_PRICING.priceFormatted} when you unlock software lock-and-download for that specific working file — not while you edit drafts.`,
  },
  {
    id: "same-file-corrections",
    title: "Same file: corrections included",
    body: "After payment, ordinary data and evidence corrections on the same working file can be re-locked without another charge. Failed locks charge nothing. Re-download is free. This is not an unlimited free remake for every mid-year EU methodology change.",
  },
  {
    id: "new-file-new-payment",
    title: "New file = new payment",
    body: "Another installation, another reporting year, or a new working file requires a new payment. One payment cannot unlock unrelated files.",
  },
  {
    id: "scope-lock",
    title: "Defined software scope",
    body: "Each paid unlock covers one legal operator/exporter, one production installation, and one reporting year with customer-controlled processes and linked goods.",
  },
  {
    id: "customer-responsibility",
    title: "Customer-controlled downstream use",
    body: "CBAMValid generates digital files from customer-entered data. Customers remain responsible for external submissions and any independent review required for their workflow.",
  },
] as const;

export const COMMERCIAL_PUBLIC_FAQ = [
  {
    question: "When is my card charged?",
    answer: `Drafting and editing are free. Your card is charged ${CANONICAL_PRICING.priceFormatted} when you pay to lock a specific working file. Re-locking that paid file after ordinary corrections does not charge again.`,
  },
  {
    question: `What exactly does ${CANONICAL_PRICING.priceFormatted} unlock?`,
    answer: `Software lock-and-download for one working file scoped to one legal operator, one installation, and one reporting year — including unlimited drafts and same-file correction re-locks. Automated PDF, JSON and XLSX files are generated after a successful lock.`,
  },
  {
    question: "If my buyer asks for corrections, do I pay again?",
    answer:
      "No — not for ordinary data or evidence corrections on the same paid working file. Correct the data, clear blockers, and re-lock. A new factory, year, or separate working file needs a new payment. Free re-locks are not an unlimited remake for every later EU ruleset change.",
  },
  {
    question: "Can one payment cover several working files?",
    answer:
      "No. Payment is bound to one working file. Cloning or creating another file does not inherit payment.",
  },
  {
    question: "What if a lock fails?",
    answer:
      "A blocked or failed lock does not complete delivery and does not consume the paid unlock for that file. Fix the blockers and try again. Re-download of an already sealed package is free.",
  },
  {
    question: "What does CBAMValid provide?",
    answer:
      "CBAMValid provides self-service software access, automated calculations, automated quality controls and automated digital file generation from customer-entered data.",
  },
  {
    question: "Do you offer refunds?",
    answer:
      "Yes. If you paid for a working file and have not yet completed a successful sealed lock, you may request a refund within 14 days. Duplicate charges and confirmed failed deliveries are refundable. See /refund-policy.",
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
    body: `The purchasable unit is software lock-and-download for one Working File covering one legal operator/exporter, one production installation, and one reporting year (the “Commercial Scope”), currently priced at ${CANONICAL_PRICING.priceFormatted} unless otherwise stated at checkout.`,
  },
  {
    title: "When payment is due",
    body: "Drafting and editing a Working File are free. Payment is due to unlock software lock-and-download for that Working File. Checkout is bound to a specific Working File identifier (caseId). Payment does not unlock other Working Files.",
  },
  {
    title: "Corrections on the same Working File",
    body: "After a successful payment for a Working File, the customer may correct ordinary inputs and evidence and create further sealed releases for that same Working File without an additional charge, subject to acceptable use and platform integrity limits. Each sealed release pins the ruleset and engine versions recorded at seal and remains immutable. Same-file correction re-locks are not an unlimited free obligation to re-engineer every later Commission methodology change; staying aligned with a newer published ruleset may require re-calculation under that newer pin.",
  },
  {
    title: "New Working File requires new payment",
    body: "A new Working File, a material change of Commercial Scope that requires a new Working File, or a clone/copy of a Working File does not inherit prior payment. Each such file requires its own checkout.",
  },
  {
    title: "Failed locks and re-download",
    body: "A blocked or failed sealing attempt does not complete delivery and does not require a new payment for the already-paid Working File. Re-download of an already sealed package does not require a new payment.",
  },
  {
    title: "Software output boundary",
    body: "The purchase provides self-service software access and automated digital outputs generated from customer-entered data. Customers remain responsible for external submissions, professional advice and any independent review required for their workflow.",
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
