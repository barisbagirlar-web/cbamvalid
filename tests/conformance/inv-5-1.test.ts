import { describe, expect, it } from "vitest";
import { validateAiPublicationApprovals } from "../../scripts/seo/content-governance-v6";

describe("INV-5.1 negative fixture", () => {
  it("blocks AI-origin content published without explicit human approval", () => {
    const blocks = validateAiPublicationApprovals(
      [{
        id: "ai_fixture",
        path: "/fixture",
        origin: "ai_generated",
        publicationStatus: "published",
        lastMeaningfulChangeAt: "2026-08-09",
        lastReviewAt: "2026-08-09",
        regulatoryRisk: "low",
        expertReview: { required: false, status: "not_required", reviewerEvidence: null },
        humanApproval: { required: true, approved: false, decisionId: null },
      }],
      "",
    );
    expect(blocks.some((block) => block.includes("INV-5.1") && block.includes("ai_fixture"))).toBe(true);
  });
});
