/**
 * Public trust / proof-chain SSOT.
 * H2: every public claim must pin to VERIFIED, SAMPLE, EMPTY_BY_DESIGN, or OWNER_ACTION.
 * Never upgrade status without evidence bytes or an API proof.
 */
import { isLegalIdentityComplete, LEGAL_IDENTITY } from "@/lib/legal-identity";
import { CANONICAL_PRICING } from "@/lib/billing/pricing-config";
import { STRUCTURE_REVIEW_PUBLIC } from "@/lib/trust/verifier-structure-review";

export type EvidenceStatus =
  | "VERIFIED"
  | "SAMPLE"
  | "EMPTY_BY_DESIGN"
  | "OWNER_ACTION"
  | "CODE_PROVEN"
  | "EXTERNAL_BLOCKER";

export interface TrustEvidenceItem {
  id: string;
  layer: "identity" | "commercial" | "structure" | "customer" | "security" | "independence";
  title: string;
  status: EvidenceStatus;
  proof: string;
  publicHref?: string;
  ownerAction?: string;
}

function identityStatus(): EvidenceStatus {
  return isLegalIdentityComplete() ? "VERIFIED" : "OWNER_ACTION";
}

export const TRUST_EVIDENCE_ITEMS: readonly TrustEvidenceItem[] = [
  {
    id: "legal-entity-name",
    layer: "identity",
    title: "Legal entity name",
    status: "VERIFIED",
    proof: `${LEGAL_IDENTITY.legalEntityName} trading as ${LEGAL_IDENTITY.tradingName}`,
    publicHref: "/legal-notice",
  },
  {
    id: "jurisdiction",
    layer: "identity",
    title: "Governing jurisdiction",
    status: "VERIFIED",
    proof: "Ireland · Irish law on Terms / Legal Notice",
    publicHref: "/terms",
  },
  {
    id: "support-email",
    layer: "identity",
    title: "Support / privacy contacts",
    status: "VERIFIED",
    proof: `${LEGAL_IDENTITY.supportEmail} · ${LEGAL_IDENTITY.privacyEmail}`,
    publicHref: "/contact",
  },
  {
    id: "cro-vat-address-phone",
    layer: "identity",
    title: "CRO / VAT / registered address / phone",
    status: identityStatus(),
    proof: isLegalIdentityComplete()
      ? `CRO ${LEGAL_IDENTITY.companyRegistrationNumber} · VAT ${LEGAL_IDENTITY.vatId} · ${LEGAL_IDENTITY.registeredAddress} · ${LEGAL_IDENTITY.supportPhone}`
      : "Fields remain null until owner supplies proven CRO, VAT, address, and phone — half-identity is never published",
    publicHref: "/legal-notice",
    ownerAction: isLegalIdentityComplete()
      ? undefined
      : "Set LEGAL_CRO, LEGAL_VAT, LEGAL_REGISTERED_ADDRESS, LEGAL_SUPPORT_PHONE, LEGAL_DPO (or fill lib/legal-identity.ts) and redeploy",
  },
  {
    id: "pricing-ssot",
    layer: "commercial",
    title: "Public list price SSOT",
    status: "CODE_PROVEN",
    proof: `${CANONICAL_PRICING.priceFormatted} · amountMinor=${CANONICAL_PRICING.amountMinor} in pricing-config + functions catalog`,
    publicHref: "/pricing",
  },
  {
    id: "paddle-sandbox-price",
    layer: "commercial",
    title: "Paddle sandbox catalog price",
    status: "VERIFIED",
    proof: "Sandbox price ID unit_price.amount proven = 44900 USD via Paddle API + owner dashboard screenshot (2026-07-28)",
    publicHref: "/pricing",
  },
  {
    id: "paddle-live-price",
    layer: "commercial",
    title: "Paddle live catalog price",
    status: "EXTERNAL_BLOCKER",
    proof: "Live Paddle API not queryable with current sandbox key (HTTP 403) — owner must set live price to $449 and prove",
    publicHref: "/pricing",
    ownerAction: "In Paddle live dashboard set the checkout price ID to USD 449.00, then run npm run prove:paddle-amount",
  },
  {
    id: "structure-sample",
    layer: "structure",
    title: "Watermarked SAMPLE structure document",
    status: "SAMPLE",
    proof: STRUCTURE_REVIEW_PUBLIC.sampleDocument.notice,
    publicHref: STRUCTURE_REVIEW_PUBLIC.path,
  },
  {
    id: "structure-letter-signed",
    layer: "structure",
    title: "Third-party signed structure letter",
    status: "OWNER_ACTION",
    proof: "Specimen letter only — no accredited-body signed PDF published",
    publicHref: STRUCTURE_REVIEW_PUBLIC.path,
    ownerAction: "Send outreach in docs/outreach/verifier-structure-review-outreach.md; publish signed PDF when received",
  },
  {
    id: "case-studies",
    layer: "customer",
    title: "Named customer references",
    status: "EMPTY_BY_DESIGN",
    proof: "No invented logos or testimonials — /case-studies stays empty until written permission",
    publicHref: "/case-studies",
    ownerAction: "Obtain written permission (name, logo, measurable outcome) then publish",
  },
  {
    id: "security-facts",
    layer: "security",
    title: "Security & DPA facts",
    status: "CODE_PROVEN",
    proof: "europe-west1, TLS, HttpOnly session, subprocessors, DPA draft PDF — no ISO/SOC claim",
    publicHref: "/security",
  },
  {
    id: "independence-boundary",
    layer: "independence",
    title: "Independence / non-verifier boundary",
    status: "VERIFIED",
    proof: "Preparation ≠ accredited verification opinion — published on homepage, legal notice, verifier-review",
    publicHref: "/legal-notice",
  },
] as const;

export function trustEvidenceSummary(items: readonly TrustEvidenceItem[] = TRUST_EVIDENCE_ITEMS) {
  const counts = {
    VERIFIED: 0,
    SAMPLE: 0,
    EMPTY_BY_DESIGN: 0,
    OWNER_ACTION: 0,
    CODE_PROVEN: 0,
    EXTERNAL_BLOCKER: 0,
  };
  for (const item of items) counts[item.status] += 1;
  const blocking = items.filter(
    (i) => i.status === "OWNER_ACTION" || i.status === "EXTERNAL_BLOCKER"
  );
  return { counts, blocking, total: items.length };
}

export const TRUST_PUBLIC = {
  path: "/trust",
  title: "Trust Evidence Registry",
  eyebrow: "Proof chain · H2 disciplined",
  headline: "Every claim pinned — or not published",
  lede:
    "This registry is the public court of truth for CBAMValid marketing claims. SAMPLE means watermarked specimen. EMPTY BY DESIGN means intentionally blank. OWNER ACTION and EXTERNAL BLOCKER are visible gaps — never filled with invented evidence.",
} as const;
