/**
 * Public trust / proof-chain SSOT.
 * Every public claim must pin to published evidence, a sample, or an explicit non-claim.
 * Never upgrade status without evidence bytes or an API proof.
 */
import { isLegalIdentityComplete, LEGAL_IDENTITY } from "@/lib/legal-identity";
import { CANONICAL_PRICING } from "@/lib/billing/pricing-config";
import { STRUCTURE_REVIEW_PUBLIC } from "@/lib/trust/verifier-structure-review";

export type EvidenceStatus =
  | "VERIFIED"
  | "SAMPLE"
  | "EMPTY_BY_DESIGN"
  | "CODE_PROVEN";

export interface TrustEvidenceItem {
  id: string;
  layer: "identity" | "commercial" | "structure" | "customer" | "security" | "independence";
  title: string;
  status: EvidenceStatus;
  proof: string;
  publicHref?: string;
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
    status: isLegalIdentityComplete() ? "VERIFIED" : "EMPTY_BY_DESIGN",
    proof: isLegalIdentityComplete()
      ? `CRO ${LEGAL_IDENTITY.companyRegistrationNumber} · VAT ${LEGAL_IDENTITY.vatId} · ${LEGAL_IDENTITY.registeredAddress} · ${LEGAL_IDENTITY.supportPhone}`
      : "Legal identity details are not published unless supporting records are complete.",
    publicHref: "/legal-notice",
  },
  {
    id: "pricing-ssot",
    layer: "commercial",
    title: "Public list price SSOT",
    status: "CODE_PROVEN",
    proof: `${CANONICAL_PRICING.priceFormatted} per case-scoped working file at lock; same-file correction re-locks included`,
    publicHref: "/pricing",
  },
  {
    id: "paddle-sandbox-price",
    layer: "commercial",
    title: "Paddle sandbox catalog price",
    status: "VERIFIED",
    proof: "USD 449 catalog amount confirmed against the payment-provider catalog on 2026-07-28",
    publicHref: "/pricing",
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
    status: "EMPTY_BY_DESIGN",
    proof:
      "Owner waived — signed structure letters are not a competitive requirement. Package fitness stays on the SAMPLE structure-review surface.",
    publicHref: STRUCTURE_REVIEW_PUBLIC.path,
  },
  {
    id: "case-studies",
    layer: "customer",
    title: "Anonymized illustrative sector scenarios",
    status: "CODE_PROVEN",
    proof:
      "Four anonymized sector scenarios on /case-studies — no company names, logos, or testimonials. Named references remain permissioned-only.",
    publicHref: "/case-studies",
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
    CODE_PROVEN: 0,
  };
  for (const item of items) counts[item.status] += 1;
  return { counts, total: items.length };
}

export const TRUST_PUBLIC = {
  path: "/trust",
  title: "Trust Evidence Registry",
  eyebrow: "Public evidence register",
  headline: "Every claim pinned — or not published",
  lede:
    "This register links public claims to published evidence. SAMPLE means a watermarked specimen. EMPTY BY DESIGN means CBAMValid deliberately makes no claim where supporting evidence is absent or unnecessary.",
} as const;
