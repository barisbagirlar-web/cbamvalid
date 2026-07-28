import { describe, expect, it } from "vitest";
import { WORKFLOW_STEPS_PLAIN } from "@/lib/product/customer-language";

describe("working-file plain steps contract", () => {
  it("exposes exactly eight plain-language steps for the wizard strip", () => {
    expect(WORKFLOW_STEPS_PLAIN).toHaveLength(8);
    expect(WORKFLOW_STEPS_PLAIN[0]?.title).toBe("Who and where");
    expect(WORKFLOW_STEPS_PLAIN[7]?.title).toBe("Lock & download");
    expect(WORKFLOW_STEPS_PLAIN.every((step, index) => step.num === index + 1)).toBe(true);
  });
});
