import { describe, expect, it } from "vitest";
import { calculateDefaultValuePenalty } from "@/lib/billing/roi-calculator";
import { CANONICAL_PRICING } from "@/lib/billing/pricing-config";

describe("ROI calculator fail-closed", () => {
  it("blocks missing volume instead of treating as zero", () => {
    const result = calculateDefaultValuePenalty({
      sector: "STEEL",
      volumeTonnes: null,
      actualSeeTPerT: 1.2,
      packPriceUsd: Number(CANONICAL_PRICING.displayPrice),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("ROI_VOLUME_MISSING");
  });

  it("blocks missing actual SEE", () => {
    const result = calculateDefaultValuePenalty({
      sector: "STEEL",
      volumeTonnes: 1000,
      actualSeeTPerT: null,
      packPriceUsd: Number(CANONICAL_PRICING.displayPrice),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("ROI_ACTUAL_SEE_MISSING");
  });

  it("computes default-value penalty with official Q2 2026 certificate price", () => {
    const result = calculateDefaultValuePenalty({
      sector: "STEEL",
      volumeTonnes: 1000,
      actualSeeTPerT: 1.0,
      packPriceUsd: Number(CANONICAL_PRICING.displayPrice),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // STEEL default SEE = 1.89 + 0.42 = 2.31; cert = 75.28
    // penalty = 1000 * (2.31 - 1.0) * 75.28
    expect(result.certificatePriceEurPerT).toBe(75.28);
    expect(result.defaultSeeTPerT).toBeCloseTo(2.31, 6);
    expect(result.defaultValuePenaltyEur).toBeCloseTo(1000 * 1.31 * 75.28, 2);
    expect(result.packPriceUsd).toBe(449);
  });
});
