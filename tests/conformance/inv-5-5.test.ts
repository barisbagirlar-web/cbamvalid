import { describe, expect, it } from "vitest";
import { validateDataAssetPrivacy } from "../../scripts/seo/content-governance-v6";

describe("INV-5.5 negative fixture", () => {
  it("blocks customer-derived public data without approved privacy review", () => {
    const blocks = validateDataAssetPrivacy([
      {
        id: "customer_benchmark_fixture",
        sourceClass: "user_derived",
        purpose: "fixture",
        containsPersonalData: "unknown",
        privacyReview: { required: true, status: "pending", decisionId: null },
        publicPublicationAllowed: true,
      },
    ]);
    expect(blocks.some((block) => block.includes("INV-5.5") && block.includes("customer_benchmark_fixture"))).toBe(true);
  });

  it("blocks private customer evidence from becoming a public data asset even with a review marker", () => {
    const blocks = validateDataAssetPrivacy([
      {
        id: "private_evidence_fixture",
        sourceClass: "user_private",
        purpose: "fixture",
        containsPersonalData: "possible",
        privacyReview: { required: true, status: "approved", decisionId: "privacy_fixture" },
        publicPublicationAllowed: true,
      },
    ]);
    expect(blocks.some((block) => block.includes("INV-5.5") && block.includes("private customer evidence"))).toBe(true);
  });
});
