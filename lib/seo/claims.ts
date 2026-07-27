import { CANONICAL_PRICING } from "@/lib/billing/pricing-config";
import { siteConfig } from "@/lib/site-config";
import type { PublicClaim } from "./types";

/**
 * Commercial and trust claims allowed in public SEO surfaces.
 * Only `verified` claims may enter JSON-LD or LLM discovery docs.
 */
export const PRICE_CLAIM: PublicClaim<{
  amount: string;
  currency: "USD";
  formatted: string;
  packName: string;
}> = {
  value: {
    amount: CANONICAL_PRICING.displayPrice,
    currency: "USD",
    formatted: CANONICAL_PRICING.priceFormatted,
    packName: CANONICAL_PRICING.packName,
  },
  evidenceStatus: "verified",
  evidenceId: "CANONICAL_PRICING",
};

export const SUPPORT_EMAIL_CLAIM: PublicClaim<string> = {
  value: siteConfig.supportEmail,
  evidenceStatus: "verified",
  evidenceId: "siteConfig.supportEmail",
};

export const INDEPENDENCE_CLAIM: PublicClaim<string> = {
  value:
    "CBAMValid is an independent software service for exporter-to-importer evidence packaging. It is not an EU institution, customs authority, or accredited CBAM verifier. Actual emissions data must be independently verified where verification is legally required.",
  evidenceStatus: "verified",
  evidenceId: "AGENTS.md independence boundary",
};

export const PRODUCT_POSITIONING_CLAIM: PublicClaim<string> = {
  value: "CBAMValid Exporter Verification Preparation Pack — Prepared for Independent Accredited Verification",
  evidenceStatus: "verified",
  evidenceId: "AGENTS.md canonical product definition",
};

/** Explicitly unverified — must never appear in structured data or LLM docs. */
export const FORBIDDEN_SOCIAL_PROOF = {
  aggregateRating: { evidenceStatus: "unverified" as const },
  reviewCount: { evidenceStatus: "unverified" as const },
  customerTestimonials: { evidenceStatus: "unverified" as const },
  manufacturerCount: { evidenceStatus: "unverified" as const },
};

export function assertVerifiedClaim<T>(claim: PublicClaim<T>, label: string): T {
  if (claim.evidenceStatus !== "verified") {
    throw new Error(`SEO claim gate: unverified claim blocked (${label})`);
  }
  return claim.value;
}

export function collectVerifiedCommercialScalars(): {
  priceAmount: string;
  priceCurrency: "USD";
  priceFormatted: string;
  supportEmail: string;
} {
  const price = assertVerifiedClaim(PRICE_CLAIM, "PRICE_CLAIM");
  const supportEmail = assertVerifiedClaim(SUPPORT_EMAIL_CLAIM, "SUPPORT_EMAIL_CLAIM");
  return {
    priceAmount: price.amount,
    priceCurrency: price.currency,
    priceFormatted: price.formatted,
    supportEmail,
  };
}
